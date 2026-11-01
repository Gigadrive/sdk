"""microVM volumes: persistent filesystems that outlive the microVMs they are attached to.

>>> from gigadrive import MicroVM, MicroVmVolumes
>>> volume = MicroVmVolumes().create("cache", size_mb=20480)
>>> with MicroVM.create(volumes={volume["id"]: "/cache"}) as vm:
...     vm.run("pip download -d /cache requests")
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from urllib.parse import quote

from ._client import HttpClient


def _path(volume_id: str) -> str:
    return f"/microvm-volumes/{quote(volume_id, safe='')}"


class MicroVmVolumes:
    """An application's volumes (``/microvm-volumes``). Results are the API's JSON objects."""

    def __init__(self, *, client: Optional[HttpClient] = None, **client_options: Any) -> None:
        self._http = client if client is not None else HttpClient(**client_options)

    def list(self, application_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Every volume of the application, oldest first."""
        volumes: List[Dict[str, Any]] = []
        cursor: Optional[str] = None
        while True:
            body = self._http.json("GET", "/microvm-volumes", params={"applicationId": application_id, "cursor": cursor})
            volumes.extend(body.get("data", []))
            pagination = body.get("pagination") or {}
            cursor = pagination.get("nextCursor") if pagination.get("hasMore") else None
            if not cursor:
                return volumes

    def create(self, name: str, *, size_mb: Optional[int] = None, application_id: Optional[str] = None) -> Dict[str, Any]:
        """Create an empty volume (1024 to 51200 MiB, default 10240). It is formatted on its first attach."""
        payload: Dict[str, Any] = {"name": name}
        if size_mb is not None:
            payload["sizeMb"] = size_mb
        if application_id is not None:
            payload["applicationId"] = application_id
        return self._http.json("POST", "/microvm-volumes", json=payload)

    def get(self, volume_id: str) -> Dict[str, Any]:
        return self._http.json("GET", _path(volume_id))

    def rename(self, volume_id: str, name: str) -> Dict[str, Any]:
        return self._http.json("PATCH", _path(volume_id), json={"name": name})

    def delete(self, volume_id: str) -> None:
        """Delete a volume and its contents. An attached volume cannot be deleted."""
        self._http.request("DELETE", _path(volume_id))
