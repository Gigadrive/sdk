"""microVM lifecycle webhooks: manage an application's endpoints and verify the requests they receive.

>>> from gigadrive import MicroVmWebhooks
>>> webhook = MicroVmWebhooks().create(
...     url="https://example.com/hooks/microvms",
...     events=["microvm.stopped", "microvm.failed"],
...     application_id="0197b2f1-2f4a-7a0b-8a2d-222222222222",
... )
>>> secret = webhook["secret"]  # shown only now
"""

from __future__ import annotations

import base64
import binascii
import hashlib
import hmac
import json
import time
from typing import Any, Dict, List, Literal, Mapping, Optional, Sequence, Union
from urllib.parse import quote

from ._client import HttpClient
from .errors import GigadriveError

WebhookEvent = Literal["microvm.created", "microvm.running", "microvm.paused", "microvm.stopped", "microvm.failed"]


class MicroVmWebhookVerificationError(GigadriveError):
    """A webhook request whose signature or timestamp did not check out. Answer it with ``401``."""


def _path(webhook_id: str) -> str:
    return f"/microvm-webhooks/{quote(webhook_id, safe='')}"


class MicroVmWebhooks:
    """An application's microVM webhooks (``/microvm-webhooks``). Results are the API's JSON objects."""

    def __init__(self, *, client: Optional[HttpClient] = None, **client_options: Any) -> None:
        self._http = client if client is not None else HttpClient(**client_options)

    def list(self, application_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """The application's webhooks, oldest first, without secrets."""
        body = self._http.json("GET", "/microvm-webhooks", params={"applicationId": application_id})
        return body.get("data", []) if isinstance(body, dict) else body

    def create(
        self,
        url: str,
        events: Sequence[WebhookEvent],
        *,
        description: Optional[str] = None,
        application_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Add a webhook. The result carries ``secret`` (``whsec_...``), shown only this once."""
        payload: Dict[str, Any] = {"url": url, "events": list(events)}
        if description is not None:
            payload["description"] = description
        if application_id is not None:
            payload["applicationId"] = application_id
        return self._http.json("POST", "/microvm-webhooks", json=payload)

    def get(self, webhook_id: str) -> Dict[str, Any]:
        return self._http.json("GET", _path(webhook_id))

    def update(
        self,
        webhook_id: str,
        *,
        url: Optional[str] = None,
        events: Optional[Sequence[WebhookEvent]] = None,
        description: Optional[str] = None,
        enabled: Optional[bool] = None,
    ) -> Dict[str, Any]:
        """Change the given fields; a disabled webhook receives no new events."""
        payload: Dict[str, Any] = {}
        if url is not None:
            payload["url"] = url
        if events is not None:
            payload["events"] = list(events)
        if description is not None:
            payload["description"] = description
        if enabled is not None:
            payload["enabled"] = enabled
        return self._http.json("PATCH", _path(webhook_id), json=payload)

    def delete(self, webhook_id: str) -> None:
        """Delete the webhook and the deliveries it still had to send."""
        self._http.request("DELETE", _path(webhook_id))

    def rotate_secret(self, webhook_id: str) -> Dict[str, Any]:
        """Replace the signing secret; the old one stops signing at once. The result carries ``secret``."""
        return self._http.json("POST", f"{_path(webhook_id)}/secret")

    def list_deliveries(self, webhook_id: str) -> List[Dict[str, Any]]:
        """The webhook's 50 most recent deliveries, newest first."""
        body = self._http.json("GET", f"{_path(webhook_id)}/deliveries")
        return body.get("data", []) if isinstance(body, dict) else body


def _header(headers: Mapping[str, Any], name: str) -> Optional[str]:
    for key, value in headers.items():
        if key.lower() == name:
            return value[0] if isinstance(value, (list, tuple)) else value
    return None


def verify_microvm_webhook(
    body: Union[str, bytes],
    headers: Mapping[str, Any],
    secret: str,
    *,
    tolerance_seconds: float = 300,
) -> Dict[str, Any]:
    """Verify a microVM webhook request (Standard Webhooks signing) and return its event.

    ``body`` is the raw request body exactly as received; ``headers`` any mapping of the request
    headers. Raises :class:`MicroVmWebhookVerificationError` when a header is missing, the
    timestamp is more than ``tolerance_seconds`` from now, or no signature matches the secret.
    Events can arrive more than once and out of order: deduplicate on ``webhook-id`` and order
    by the event's ``timestamp``.
    """
    message_id = _header(headers, "webhook-id")
    timestamp = _header(headers, "webhook-timestamp")
    signatures = _header(headers, "webhook-signature")
    if not message_id or not timestamp or not signatures:
        raise MicroVmWebhookVerificationError(
            "The request is missing the webhook-id, webhook-timestamp or webhook-signature header."
        )
    if not timestamp.isdigit() or abs(time.time() - int(timestamp)) > tolerance_seconds:
        raise MicroVmWebhookVerificationError("The webhook timestamp is missing or too far from the current time.")
    try:
        key = base64.b64decode(secret[len("whsec_"):] if secret.startswith("whsec_") else secret, validate=True)
    except binascii.Error:
        key = b""
    if not key:
        raise MicroVmWebhookVerificationError("The signing secret is not a whsec_ secret.")

    raw = body if isinstance(body, bytes) else body.encode("utf-8")
    expected = hmac.new(key, f"{message_id}.{timestamp}.".encode("utf-8") + raw, hashlib.sha256).digest()
    for entry in signatures.split(" "):
        version, _, signature = entry.partition(",")
        if version != "v1" or not signature:
            continue
        try:
            received = base64.b64decode(signature, validate=True)
        except binascii.Error:
            continue
        if hmac.compare_digest(received, expected):
            break
    else:
        raise MicroVmWebhookVerificationError("No webhook signature matches the signing secret.")

    try:
        return json.loads(raw)
    except ValueError:
        raise MicroVmWebhookVerificationError("The webhook body is not JSON.") from None
