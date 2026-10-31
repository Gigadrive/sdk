"""MicroVM against a mocked Network API (httpx.MockTransport): no network, no credentials."""

from __future__ import annotations

import base64
import json
from typing import Callable, List

import httpx
import pytest

from gigadrive import (
    AuthenticationError,
    CommandFailedError,
    HttpClient,
    MicroVM,
    MicroVmNotFoundError,
    MicroVmPausedError,
)

VM = {
    "id": "vm-1",
    "slug": "k3x9q2m7a1bz",
    "status": "running",
    "ports": [{"port": 3000, "url": "https://3000-k3x9q2m7a1bz.vm.gigadrive.app"}],
    "network": {"egress": "allow", "previews": "public"},
    "onTimeout": "stop",
    "autoResume": False,
}


def client(handler: Callable[[httpx.Request], httpx.Response], calls: List[httpx.Request]) -> HttpClient:
    def record(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        return handler(request)

    return HttpClient(bearer_token="token", base_url="https://api.test", transport=httpx.MockTransport(record))


def body(request: httpx.Request) -> dict:
    return json.loads(request.content)


def test_create_sends_the_options_and_waits_for_running() -> None:
    calls: List[httpx.Request] = []
    answers = iter([httpx.Response(202, json={**VM, "status": "starting"}), httpx.Response(200, json=VM)])
    http = client(lambda request: next(answers), calls)

    vm = MicroVM.create(
        image="python3.13",
        timeout=600,
        ports=[3000],
        allow=["pypi.org", "*.pythonhosted.org"],
        on_timeout="pause",
        auto_resume=True,
        client=http,
    )

    assert vm.status == "running"
    assert calls[0].method == "POST" and calls[0].url.path == "/microvms"
    assert calls[0].headers["authorization"] == "Bearer token"
    assert body(calls[0]) == {
        "image": "python3.13",
        "timeoutMs": 600_000,
        "onTimeout": "pause",
        "autoResume": True,
        "ports": [3000],
        "network": {"egress": "allow", "allow": ["pypi.org", "*.pythonhosted.org"]},
    }
    assert calls[1].method == "GET" and calls[1].url.path == "/microvms/vm-1"
    assert vm.url(3000) == "https://3000-k3x9q2m7a1bz.vm.gigadrive.app"
    with pytest.raises(ValueError):
        vm.url(8080)


def test_run_returns_the_output_and_check_raises_on_failure() -> None:
    calls: List[httpx.Request] = []
    result = {"id": "cmd-1", "exitCode": 1, "signal": None, "timedOut": False, "stdout": "", "stderr": "boom\n"}
    http = client(lambda request: httpx.Response(200, json=result), calls)
    vm = MicroVM(http, VM)

    plain = vm.run("ls", ["-la"], cwd="/tmp", timeout=30)
    with pytest.raises(CommandFailedError) as failed:
        vm.run("false", check=True)

    assert body(calls[0]) == {"cmd": "ls", "args": ["-la"], "cwd": "/tmp", "timeoutMs": 30_000, "wait": True}
    assert plain.exit_code == 1 and plain.stderr == "boom\n" and not plain.ok
    assert failed.value.result.exit_code == 1


def test_run_streams_output_to_callbacks() -> None:
    calls: List[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/logs"):
            chunk = base64.b64encode(b"hello\n").decode()
            stream = (
                f'event: stdout\ndata: {{"data": "{chunk}", "offset": 0}}\n\n'
                'event: exit\ndata: {"exitCode": 0, "signal": null}\n\n'
            )
            return httpx.Response(200, text=stream, headers={"content-type": "text/event-stream"})
        return httpx.Response(200, json={"id": "cmd-2", "status": "running", "exitCode": None})

    vm = MicroVM(client(handler, calls), VM)
    seen: List[str] = []

    result = vm.run("echo hello", on_stdout=seen.append)

    assert seen == ["hello\n"] and result.stdout == "hello\n" and result.exit_code == 0
    assert body(calls[0])["wait"] is False


def test_files_round_trip_bytes_and_map_missing_files() -> None:
    calls: List[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "PUT":
            return httpx.Response(200, json={"path": "/tmp/a.txt", "name": "a.txt", "type": "file", "size": 5, "mode": "644"})
        if request.url.params.get("path") == "/missing":
            return httpx.Response(404, json={"error": "No such file", "code": "guest_not_found"})
        return httpx.Response(200, content=b"hello")

    vm = MicroVM(client(handler, calls), VM)

    written = vm.files.write("/tmp/a.txt", "hello")
    content = vm.files.read_text("/tmp/a.txt")

    assert written.size == 5 and content == "hello"
    assert calls[0].content == b"hello" and calls[0].url.params["path"] == "/tmp/a.txt"
    assert vm.files.exists("/missing") is False
    with pytest.raises(MicroVmNotFoundError):
        vm.files.read("/missing")


def test_update_network_and_typed_refusals() -> None:
    calls: List[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/network"):
            return httpx.Response(200, json={**VM, "network": {"egress": "deny", "previews": "public"}})
        return httpx.Response(409, json={"error": "The microVM is paused", "code": "microvm_paused"})

    vm = MicroVM(client(handler, calls), VM)

    vm.update_network("deny")
    with pytest.raises(MicroVmPausedError) as paused:
        vm.run("ls")

    assert calls[0].method == "PATCH" and body(calls[0]) == {"egress": "deny"}
    assert vm.info["network"]["egress"] == "deny"
    assert paused.value.status == 409 and paused.value.code == "microvm_paused"


def test_context_manager_stops_the_microvm() -> None:
    calls: List[httpx.Request] = []
    http = client(lambda request: httpx.Response(200, json={**VM, "status": "stopped"}), calls)

    with MicroVM(http, VM):
        pass

    assert [(call.method, call.url.path) for call in calls] == [("POST", "/microvms/vm-1/stop")]


def test_api_key_is_exchanged_for_a_token_once(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("GIGADRIVE_BEARER_TOKEN", raising=False)
    calls: List[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/oauth2/token":
            return httpx.Response(200, json={"access_token": "exchanged", "expires_in": 3600})
        return httpx.Response(200, json=VM)

    http = HttpClient(
        client_id="key-id",
        client_secret="sk_test",
        base_url="https://api.test",
        transport=httpx.MockTransport(lambda request: (calls.append(request), handler(request))[1]),
    )

    MicroVM.get("vm-1", client=http)
    MicroVM.get("vm-1", client=http)

    assert [call.url.path for call in calls] == ["/oauth2/token", "/microvms/vm-1", "/microvms/vm-1"]
    assert calls[0].headers["authorization"].startswith("Basic ")
    assert calls[1].headers["authorization"] == "Bearer exchanged"


def test_missing_credentials_are_refused(monkeypatch: pytest.MonkeyPatch) -> None:
    for name in ("GIGADRIVE_BEARER_TOKEN", "GIGADRIVE_CLIENT_ID", "GIGADRIVE_CLIENT_SECRET"):
        monkeypatch.delenv(name, raising=False)
    with pytest.raises(AuthenticationError):
        HttpClient()
