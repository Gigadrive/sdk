from __future__ import annotations

import json
from typing import List

import httpx
import pytest

from gigadrive import HttpClient, MicroVM, MicroVmVolumes

VOLUME = {"id": "vol-1", "name": "cache", "sizeMb": 20480, "status": "available"}
VM = {
    "id": "vm-1",
    "status": "running",
    "volumes": [{"volumeId": "vol-1", "mountPath": "/cache"}],
}


def _recorder(answers: List[httpx.Response], calls: List[httpx.Request]) -> HttpClient:
    replies = iter(answers)

    def record(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        return next(replies)

    return HttpClient(
        bearer_token="token",
        base_url="https://api.test",
        transport=httpx.MockTransport(record),
    )


def test_manages_volumes() -> None:
    calls: List[httpx.Request] = []
    http = _recorder(
        [
            httpx.Response(201, json=VOLUME),
            httpx.Response(
                200,
                json={
                    "data": [VOLUME],
                    "pagination": {"nextCursor": "c1", "hasMore": True},
                },
            ),
            httpx.Response(
                200,
                json={
                    "data": [{**VOLUME, "id": "vol-2"}],
                    "pagination": {"hasMore": False},
                },
            ),
            httpx.Response(200, json={**VOLUME, "name": "deps"}),
            httpx.Response(204),
        ],
        calls,
    )
    volumes = MicroVmVolumes(client=http)

    assert volumes.create("cache", size_mb=20480, application_id="app-1") == VOLUME
    assert [entry["id"] for entry in volumes.list("app-1")] == ["vol-1", "vol-2"]
    assert volumes.rename("vol-1", "deps")["name"] == "deps"
    volumes.delete("vol-1")

    assert json.loads(calls[0].content) == {
        "name": "cache",
        "sizeMb": 20480,
        "applicationId": "app-1",
    }
    assert calls[2].url.params["cursor"] == "c1"
    assert calls[3].method == "PATCH"
    assert calls[4].method == "DELETE"


def test_attaches_saves_and_waits_for_the_save_on_stop(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr("gigadrive.microvms.time.sleep", lambda _seconds: None)
    calls: List[httpx.Request] = []
    http = _recorder(
        [
            httpx.Response(201, json=VM),
            httpx.Response(200, json=VM),
            httpx.Response(200, json={**VM, "status": "stopping"}),
            httpx.Response(200, json={**VM, "status": "stopping"}),
            httpx.Response(200, json={**VM, "status": "stopped"}),
        ],
        calls,
    )

    vm = MicroVM.create(volumes={"vol-1": "/cache"}, client=http)
    vm.save_volumes()
    vm.stop()

    assert json.loads(calls[0].content)["volumes"] == [
        {"volumeId": "vol-1", "mountPath": "/cache"}
    ]
    assert calls[1].url.path == "/microvms/vm-1/volumes/save"
    assert vm.status == "stopped"
    assert len(calls) == 5
