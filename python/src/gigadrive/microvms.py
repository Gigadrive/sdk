"""microVMs: isolated Linux machines that start in about a second.

>>> from gigadrive import MicroVM
>>> with MicroVM.create(image="python3.13") as vm:
...     print(vm.run("python -c 'print(6 * 7)'").stdout)
42
"""

from __future__ import annotations

import base64
import json
import time
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, Iterator, List, Literal, Mapping, Optional, Sequence, Union
from urllib.parse import quote

from ._client import HttpClient
from .errors import CommandFailedError, MicroVmNotFoundError, MicroVmTimeoutError

Egress = Literal["allow", "deny"]
OnTimeout = Literal["stop", "pause"]

# One wait call on a detached command is capped server side.
_COMMAND_WAIT_SLICE_MS = 60_000
_POLL_INTERVAL_S = 0.5


def _vm_path(microvm_id: str) -> str:
    return f"/microvms/{quote(microvm_id, safe='')}"


def _ms(seconds: Optional[float]) -> Optional[int]:
    return None if seconds is None else int(seconds * 1000)


@dataclass(frozen=True)
class CommandResult:
    """A finished command. ``stdout`` and ``stderr`` are capped at 1 MiB each (``truncated``)."""

    command_id: str
    exit_code: Optional[int]
    signal: Optional[str]
    timed_out: bool
    stdout: str
    stderr: str
    truncated: bool
    duration_ms: Optional[int]

    @property
    def ok(self) -> bool:
        """Whether the command exited with code 0."""
        return self.exit_code == 0


@dataclass(frozen=True)
class OutputChunk:
    """Output a detached command wrote, as :meth:`Command.logs` yields it."""

    stream: Literal["stdout", "stderr"]
    data: bytes
    offset: int

    @property
    def text(self) -> str:
        return self.data.decode("utf-8", errors="replace")


@dataclass(frozen=True)
class FileEntry:
    """One file, directory or symlink in a microVM."""

    path: str
    name: str
    type: str
    size: int
    mode: str
    modified_at: Union[str, int, None]
    target: Optional[str] = None

    @classmethod
    def _from(cls, raw: Mapping[str, Any]) -> "FileEntry":
        return cls(
            path=raw["path"],
            name=raw.get("name", raw["path"].rsplit("/", 1)[-1]),
            type=raw.get("type", "file"),
            size=int(raw.get("size", 0)),
            mode=str(raw.get("mode", "")),
            modified_at=raw.get("modifiedAt"),
            target=raw.get("target"),
        )


class Command:
    """A command started with :meth:`MicroVM.spawn`. Its output stays in the microVM."""

    def __init__(self, http: HttpClient, microvm_id: str, info: Mapping[str, Any]) -> None:
        self._http = http
        self._microvm_id = microvm_id
        self.info: Dict[str, Any] = dict(info)

    @property
    def id(self) -> str:
        return self.info["id"]

    @property
    def status(self) -> str:
        return self.info["status"]

    @property
    def exit_code(self) -> Optional[int]:
        return self.info.get("exitCode")

    def _path(self) -> str:
        return f"{_vm_path(self._microvm_id)}/commands/{quote(self.id, safe='')}"

    def refresh(self) -> "Command":
        self.info = self._http.json("GET", self._path())
        return self

    def wait(self, timeout: Optional[float] = None) -> "Command":
        """Wait until the command exits, or raise :class:`MicroVmTimeoutError` after ``timeout`` seconds."""
        deadline = None if timeout is None else time.monotonic() + timeout
        while self.status != "exited":
            remaining_ms = _COMMAND_WAIT_SLICE_MS
            if deadline is not None:
                remaining_ms = min(remaining_ms, int((deadline - time.monotonic()) * 1000))
                if remaining_ms <= 0:
                    raise MicroVmTimeoutError(f"The command {self.id} is still running after {timeout} s")
            self.info = self._http.json("POST", f"{self._path()}/wait", json={"timeoutMs": remaining_ms})
        return self

    def kill(self, signal: str = "SIGTERM") -> None:
        self._http.request("POST", f"{self._path()}/signal", json={"signal": signal})

    def write(self, data: Union[str, bytes], *, eof: bool = False) -> None:
        """Write to the command's stdin (it must be started with ``stdin=True``)."""
        payload = data.encode() if isinstance(data, str) else data
        self._http.request(
            "POST",
            f"{self._path()}/stdin",
            content=payload,
            params={"eof": True if eof else None},
            headers={"Content-Type": "application/octet-stream"},
        )

    def logs(self, *, follow: bool = True) -> Iterator[OutputChunk]:
        """Yield the command's output as it is written, until it exits (or now, with ``follow=False``)."""
        response = self._http.request(
            "GET",
            f"{self._path()}/logs",
            params={"follow": follow},
            headers={"Accept": "text/event-stream"},
            timeout=None,
        )
        for event, data in _sse_events(response.iter_lines()):
            if event in ("stdout", "stderr"):
                payload = json.loads(data)
                yield OutputChunk(stream=event, data=base64.b64decode(payload["data"]), offset=payload.get("offset", 0))
            elif event == "exit":
                payload = json.loads(data)
                self.info.update(
                    status="exited",
                    exitCode=payload.get("exitCode"),
                    signal=payload.get("signal"),
                    timedOut=payload.get("timedOut", False),
                )
                return
            elif event == "end":
                return


def _sse_events(lines: Iterator[str]) -> Iterator["tuple[str, str]"]:
    event, data = "message", []
    for line in lines:
        if line == "":
            if data:
                yield event, "\n".join(data)
            event, data = "message", []
        elif line.startswith("event:"):
            event = line[6:].strip()
        elif line.startswith("data:"):
            data.append(line[5:].lstrip())
    if data:
        yield event, "\n".join(data)


class Files:
    """Files of one microVM: ``vm.files``. Paths are absolute or relative to the user's home."""

    def __init__(self, http: HttpClient, microvm_id: str) -> None:
        self._http = http
        self._base = f"{_vm_path(microvm_id)}/files"

    def read(self, path: str) -> bytes:
        return self._http.request("GET", f"{self._base}/content", params={"path": path}).content

    def read_text(self, path: str, encoding: str = "utf-8") -> str:
        return self.read(path).decode(encoding)

    def write(self, path: str, content: Union[str, bytes], *, mode: Optional[int] = None) -> FileEntry:
        """Write a file, creating its parent directories."""
        payload = content.encode() if isinstance(content, str) else content
        raw = self._http.json(
            "PUT",
            f"{self._base}/content",
            content=payload,
            params={"path": path, "mode": None if mode is None else format(mode, "o")},
            headers={"Content-Type": "application/octet-stream"},
        )
        return FileEntry._from(raw) if isinstance(raw, dict) and "path" in raw else FileEntry(path, path, "file", len(payload), "", None)

    def list(self, path: str = ".", *, recursive: bool = False, depth: Optional[int] = None) -> List[FileEntry]:
        body = self._http.json("GET", self._base, params={"path": path, "recursive": recursive or None, "depth": depth})
        entries = body.get("entries", []) if isinstance(body, dict) else body
        return [FileEntry._from(entry) for entry in entries]

    def stat(self, path: str) -> FileEntry:
        return FileEntry._from(self._http.json("GET", f"{self._base}/stat", params={"path": path}))

    def exists(self, path: str) -> bool:
        try:
            self.stat(path)
            return True
        except MicroVmNotFoundError:
            return False

    def mkdir(self, path: str, *, parents: bool = True) -> FileEntry:
        return FileEntry._from(self._http.json("POST", f"{self._base}/mkdir", json={"path": path, "parents": parents}))

    def remove(self, path: str, *, recursive: bool = False) -> None:
        self._http.request("DELETE", self._base, params={"path": path, "recursive": recursive or None})

    def move(self, source: str, destination: str) -> FileEntry:
        return FileEntry._from(self._http.json("POST", f"{self._base}/move", json={"from": source, "to": destination}))


class MicroVM:
    """One microVM. Create it with :meth:`create`, or connect to one with :meth:`get`.

    Used as a context manager, it is stopped when the block ends.
    """

    def __init__(self, http: HttpClient, info: Mapping[str, Any], *, owns_client: bool = False) -> None:
        self._http = http
        self._owns_client = owns_client
        self.info: Dict[str, Any] = dict(info)
        self.preview_token: Optional[str] = self.info.pop("previewToken", None)
        self.files = Files(http, self.id)

    # -- construction -------------------------------------------------------

    @classmethod
    def create(
        cls,
        *,
        image: Optional[str] = None,
        snapshot_id: Optional[str] = None,
        vcpus: Optional[int] = None,
        memory_mb: Optional[int] = None,
        disk_mb: Optional[int] = None,
        timeout: Optional[float] = None,
        on_timeout: Optional[OnTimeout] = None,
        auto_resume: Optional[bool] = None,
        ports: Optional[Sequence[int]] = None,
        env: Optional[Mapping[str, str]] = None,
        metadata: Optional[Mapping[str, str]] = None,
        egress: Optional[Egress] = None,
        allow: Optional[Sequence[str]] = None,
        private_previews: bool = False,
        region: Optional[str] = None,
        application_id: Optional[str] = None,
        client: Optional[HttpClient] = None,
        wait: bool = True,
        **client_options: Any,
    ) -> "MicroVM":
        """Create a microVM and, unless ``wait=False``, return once it runs.

        ``timeout`` is its lifetime in seconds (default 300). ``allow`` limits
        outbound traffic to these domain names and public IPv4 networks.
        ``on_timeout="pause"`` pauses it when the timeout ends instead of
        stopping it, and ``auto_resume=True`` resumes it when it is used.
        """
        http, owns = _resolve_client(client, client_options)
        network: Dict[str, Any] = {}
        if egress is not None or allow or private_previews:
            network["egress"] = egress or "allow"
            if allow:
                network["allow"] = list(allow)
            if private_previews:
                network["previews"] = "private"
        body = {
            key: value
            for key, value in {
                "applicationId": application_id,
                "image": image,
                "snapshotId": snapshot_id,
                "vcpus": vcpus,
                "memoryMb": memory_mb,
                "diskMb": disk_mb,
                "timeoutMs": _ms(timeout),
                "onTimeout": on_timeout,
                "autoResume": auto_resume,
                "ports": list(ports) if ports else None,
                "env": dict(env) if env else None,
                "metadata": dict(metadata) if metadata else None,
                "region": region,
                "network": network or None,
            }.items()
            if value is not None
        }
        info = http.json("POST", "/microvms", json=body, params={"wait": False if not wait else None})
        vm = cls(http, info, owns_client=owns)
        if wait and vm.status != "running":
            vm.wait_until_running()
        return vm

    @classmethod
    def get(cls, microvm_id: str, *, client: Optional[HttpClient] = None, **client_options: Any) -> "MicroVM":
        http, owns = _resolve_client(client, client_options)
        return cls(http, http.json("GET", _vm_path(microvm_id)), owns_client=owns)

    @classmethod
    def list(
        cls,
        *,
        application_id: Optional[str] = None,
        status: Optional[str] = None,
        client: Optional[HttpClient] = None,
        **client_options: Any,
    ) -> Iterator["MicroVM"]:
        """Yield the microVMs you can see, newest first, a page at a time."""
        http, _ = _resolve_client(client, client_options)
        cursor: Optional[str] = None
        while True:
            body = http.json(
                "GET", "/microvms", params={"applicationId": application_id, "status": status, "cursor": cursor}
            )
            for info in body.get("data", body.get("items", [])):
                yield cls(http, info)
            pagination = body.get("pagination") or {}
            cursor = pagination.get("nextCursor", body.get("nextCursor"))
            if not cursor or pagination.get("hasMore") is False:
                return

    # -- state --------------------------------------------------------------

    @property
    def id(self) -> str:
        return self.info["id"]

    @property
    def status(self) -> str:
        return self.info["status"]

    def refresh(self) -> "MicroVM":
        self.info = self._http.json("GET", _vm_path(self.id))
        return self

    def wait_until_running(self, timeout: float = 120.0) -> "MicroVM":
        deadline = time.monotonic() + timeout
        while self.status != "running":
            if self.status in ("stopped", "failed"):
                raise MicroVmTimeoutError(f"The microVM {self.id} is {self.status}: {self.info.get('stopReason')}")
            if time.monotonic() >= deadline:
                raise MicroVmTimeoutError(f"The microVM {self.id} is still {self.status} after {timeout} s")
            time.sleep(_POLL_INTERVAL_S)
            self.refresh()
        return self

    def url(self, port: int) -> str:
        """The preview URL of an exposed port."""
        for entry in self.info.get("ports", []):
            if entry.get("port") == port:
                return entry["url"]
        raise ValueError(f"Port {port} is not exposed; create the microVM with ports=[{port}]")

    # -- commands -----------------------------------------------------------

    def run(
        self,
        cmd: str,
        args: Optional[Sequence[str]] = None,
        *,
        cwd: Optional[str] = None,
        env: Optional[Mapping[str, str]] = None,
        user: Optional[str] = None,
        timeout: Optional[float] = None,
        check: bool = False,
        on_stdout: Optional[Callable[[str], None]] = None,
        on_stderr: Optional[Callable[[str], None]] = None,
    ) -> CommandResult:
        """Run a command and wait for it. Without ``args``, ``cmd`` is a shell line.

        ``check=True`` raises :class:`CommandFailedError` on a non-zero exit.
        ``on_stdout`` and ``on_stderr`` receive output as it is written.
        """
        start = _command_body(cmd, args, cwd, env, user, timeout)
        if on_stdout is None and on_stderr is None:
            raw = self._http.json(
                "POST", f"{_vm_path(self.id)}/commands", json={**start, "wait": True}, timeout=None
            )
            result = CommandResult(
                command_id=raw["id"],
                exit_code=raw.get("exitCode"),
                signal=raw.get("signal"),
                timed_out=bool(raw.get("timedOut")),
                stdout=raw.get("stdout", ""),
                stderr=raw.get("stderr", ""),
                truncated=bool(raw.get("truncated")),
                duration_ms=raw.get("durationMs"),
            )
        else:
            started = time.monotonic()
            command = self.spawn(cmd, args, cwd=cwd, env=env, user=user, timeout=timeout)
            output = {"stdout": [], "stderr": []}
            for chunk in command.logs():
                output[chunk.stream].append(chunk.text)
                callback = on_stdout if chunk.stream == "stdout" else on_stderr
                if callback is not None:
                    callback(chunk.text)
            if command.status != "exited":
                command.wait()
            result = CommandResult(
                command_id=command.id,
                exit_code=command.exit_code,
                signal=command.info.get("signal"),
                timed_out=bool(command.info.get("timedOut")),
                stdout="".join(output["stdout"]),
                stderr="".join(output["stderr"]),
                truncated=False,
                duration_ms=int((time.monotonic() - started) * 1000),
            )
        if check and result.exit_code != 0:
            raise CommandFailedError(result)
        return result

    def spawn(
        self,
        cmd: str,
        args: Optional[Sequence[str]] = None,
        *,
        cwd: Optional[str] = None,
        env: Optional[Mapping[str, str]] = None,
        user: Optional[str] = None,
        timeout: Optional[float] = None,
        stdin: bool = False,
    ) -> Command:
        """Start a command in the background and return at once."""
        body = {**_command_body(cmd, args, cwd, env, user, timeout), "wait": False}
        if stdin:
            body["stdin"] = True
        return Command(self._http, self.id, self._http.json("POST", f"{_vm_path(self.id)}/commands", json=body))

    # -- lifecycle ----------------------------------------------------------

    def extend_timeout(self, seconds: float) -> "MicroVM":
        """Stop the microVM ``seconds`` from now (within the plan's maximum lifetime)."""
        self.info = self._http.json("POST", f"{_vm_path(self.id)}/timeout", json={"timeoutMs": _ms(seconds)})
        return self

    def update_network(self, egress: Egress = "allow", allow: Optional[Sequence[str]] = None) -> "MicroVM":
        """Replace what the microVM may reach, without restarting it."""
        body: Dict[str, Any] = {"egress": egress}
        if allow:
            body["allow"] = list(allow)
        self.info = self._http.json("PATCH", f"{_vm_path(self.id)}/network", json=body)
        return self

    def pause(self) -> "MicroVM":
        """Pause it with its memory, processes and files; it accrues only snapshot storage."""
        self.info = self._http.json("POST", f"{_vm_path(self.id)}/pause", timeout=None)
        return self

    def resume(self) -> "MicroVM":
        self.info = self._http.json("POST", f"{_vm_path(self.id)}/resume", timeout=None)
        return self

    def snapshot(self, name: Optional[str] = None, *, expires_in: Optional[float] = None) -> Dict[str, Any]:
        """Capture memory, processes and disk; create new microVMs from it with ``snapshot_id``."""
        body = {key: value for key, value in {"name": name, "expiresInMs": _ms(expires_in)}.items() if value is not None}
        return self._http.json("POST", f"{_vm_path(self.id)}/snapshots", json=body, timeout=None)

    def rotate_preview_token(self) -> str:
        self.preview_token = self._http.json("POST", f"{_vm_path(self.id)}/preview-token")["previewToken"]
        return self.preview_token

    def stop(self) -> "MicroVM":
        self.info = self._http.json("POST", f"{_vm_path(self.id)}/stop")
        return self

    def delete(self) -> None:
        self._http.request("DELETE", _vm_path(self.id))

    def __enter__(self) -> "MicroVM":
        return self

    def __exit__(self, *exc: object) -> None:
        try:
            if self.status not in ("stopped", "failed"):
                self.stop()
        finally:
            if self._owns_client:
                self._http.close()

    def __repr__(self) -> str:
        return f"MicroVM(id={self.id!r}, status={self.status!r})"


def _command_body(
    cmd: str,
    args: Optional[Sequence[str]],
    cwd: Optional[str],
    env: Optional[Mapping[str, str]],
    user: Optional[str],
    timeout: Optional[float],
) -> Dict[str, Any]:
    body: Dict[str, Any] = {"cmd": cmd}
    if args is not None:
        body["args"] = list(args)
    if cwd is not None:
        body["cwd"] = cwd
    if env:
        body["env"] = dict(env)
    if user is not None:
        body["user"] = user
    if timeout is not None:
        body["timeoutMs"] = _ms(timeout)
    return body


def _resolve_client(client: Optional[HttpClient], options: Dict[str, Any]) -> "tuple[HttpClient, bool]":
    if client is not None:
        return client, False
    return HttpClient(**options), True
