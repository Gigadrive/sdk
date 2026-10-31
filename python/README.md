# Gigadrive Network SDK for Python

`gigadrive` creates and drives [microVMs](https://docs.gigadrive.de/network/microvms) on Gigadrive Network:
isolated Linux machines with their own kernel that start in about a second, for running untrusted code,
agent tools, tests and previews.

```bash
pip install gigadrive
```

Authenticate with an API key (`GIGADRIVE_CLIENT_ID` and `GIGADRIVE_CLIENT_SECRET`) or a bearer token
(`GIGADRIVE_BEARER_TOKEN`), or pass them to `MicroVM.create(client_id=..., client_secret=...)`.

```python
from gigadrive import MicroVM

with MicroVM.create(image="python3.13", timeout=600, ports=[8000]) as vm:
    vm.files.write("/root/app.py", "print('hello from a microVM')")
    result = vm.run("python /root/app.py", check=True)
    print(result.stdout)

    server = vm.spawn("python -m http.server 8000")
    print(vm.url(8000))
```

The microVM stops when the `with` block ends.

| Task                  | Call                                                                                                                                                                                                        |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Create, connect, list | `MicroVM.create(image=, vcpus=, memory_mb=, disk_mb=, timeout=, ports=, env=, metadata=, egress=, allow=, private_previews=, on_timeout=, auto_resume=, snapshot_id=)`, `MicroVM.get(id)`, `MicroVM.list()` |
| Run and wait          | `vm.run(cmd, args=None, cwd=, env=, user=, timeout=, check=, on_stdout=, on_stderr=)` returns `CommandResult`                                                                                               |
| Run in the background | `vm.spawn(...)` returns `Command`: `logs()`, `wait()`, `kill()`, `write()`                                                                                                                                  |
| Files                 | `vm.files.read`, `read_text`, `write`, `list`, `stat`, `exists`, `mkdir`, `remove`, `move`                                                                                                                  |
| Network               | `vm.update_network("deny")`, `vm.update_network("allow", ["pypi.org"])`                                                                                                                                     |
| Lifecycle             | `vm.extend_timeout(seconds)`, `vm.pause()`, `vm.resume()`, `vm.snapshot(name)`, `vm.stop()`, `vm.delete()`                                                                                                  |

API refusals raise typed errors such as `MicroVmPausedError`, `MicroVmNotRunningError` and
`MicroVmQuotaExceededError`; each carries the HTTP `status` and the API's `code`.
