"""microVM webhooks: the management calls against a mocked API, and signature verification."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
from typing import List

import httpx
import pytest

from gigadrive import HttpClient, MicroVmWebhooks, MicroVmWebhookVerificationError, verify_microvm_webhook

# The reference vector of the Standard Webhooks specification.
SECRET = "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw"
BODY = '{"test": 2432232314}'
HEADERS = {
    "webhook-id": "msg_p5jXN8AQM9LWM0D4loKWxJek",
    "webhook-timestamp": "1614265330",
    "webhook-signature": "v1,g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE=",
}


@pytest.fixture(autouse=True)
def frozen_clock(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("gigadrive.webhooks.time.time", lambda: 1614265330 + 30)


def test_accepts_the_reference_request() -> None:
    assert verify_microvm_webhook(BODY, HEADERS, SECRET) == {"test": 2432232314}
    assert verify_microvm_webhook(BODY.encode(), {k.title(): v for k, v in HEADERS.items()}, SECRET)
    assert verify_microvm_webhook(BODY, {**HEADERS, "webhook-signature": "v1,bm9wZQ== " + HEADERS["webhook-signature"]}, SECRET)


@pytest.mark.parametrize(
    "body, headers, secret",
    [
        ('{"test": 2432232315}', HEADERS, SECRET),
        (BODY, HEADERS, "whsec_bm90IHRoZSBzZWNyZXQ="),
        (BODY, {**HEADERS, "webhook-id": "msg_other"}, SECRET),
        (BODY, {**HEADERS, "webhook-signature": "v1,%%%"}, SECRET),
        (BODY, {**HEADERS, "webhook-signature": "v2,g0hM9SsE+OTPJTGt"}, SECRET),
        (BODY, {"webhook-id": HEADERS["webhook-id"], "webhook-timestamp": HEADERS["webhook-timestamp"]}, SECRET),
        (BODY, {**HEADERS, "webhook-timestamp": "1614265330.5"}, SECRET),
        (BODY, {**HEADERS, "webhook-timestamp": "\u00b2"}, SECRET),
        (BODY, {**HEADERS, "webhook-timestamp": "9" * 5000}, SECRET),
    ],
)
def test_rejects_tampered_or_incomplete_requests(body: str, headers: dict, secret: str) -> None:
    with pytest.raises(MicroVmWebhookVerificationError):
        verify_microvm_webhook(body, headers, secret)


def test_rejects_old_timestamps_unless_the_tolerance_allows_them(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("gigadrive.webhooks.time.time", lambda: 1614265330 + 301)
    with pytest.raises(MicroVmWebhookVerificationError, match="timestamp"):
        verify_microvm_webhook(BODY, HEADERS, SECRET)
    assert verify_microvm_webhook(BODY, HEADERS, SECRET, tolerance_seconds=600)


def test_rejects_a_signed_body_that_is_not_json() -> None:
    key = base64.b64decode(SECRET[len("whsec_"):])
    signature = base64.b64encode(hmac.new(key, b"msg_1.1614265330.not json", hashlib.sha256).digest()).decode()
    headers = {"webhook-id": "msg_1", "webhook-timestamp": "1614265330", "webhook-signature": f"v1,{signature}"}
    with pytest.raises(MicroVmWebhookVerificationError, match="not JSON"):
        verify_microvm_webhook("not json", headers, SECRET)


WEBHOOK = {"id": "wh-1", "url": "https://example.com/hooks", "events": ["microvm.stopped"], "enabled": True}


def test_manages_webhooks() -> None:
    calls: List[httpx.Request] = []
    answers = iter(
        [
            httpx.Response(201, json={**WEBHOOK, "secret": "whsec_c2VjcmV0"}),
            httpx.Response(200, json={"data": [WEBHOOK]}),
            httpx.Response(200, json={**WEBHOOK, "enabled": False}),
            httpx.Response(200, json={**WEBHOOK, "secret": "whsec_bmV3"}),
            httpx.Response(200, json={"data": [{"id": "d-1", "status": "delivered"}]}),
            httpx.Response(204),
        ]
    )

    def record(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        return next(answers)

    http = HttpClient(bearer_token="token", base_url="https://api.test", transport=httpx.MockTransport(record))
    webhooks = MicroVmWebhooks(client=http)

    created = webhooks.create("https://example.com/hooks", ["microvm.stopped"], application_id="app-1")
    assert created["secret"] == "whsec_c2VjcmV0"
    assert webhooks.list("app-1") == [WEBHOOK]
    assert webhooks.update("wh-1", enabled=False)["enabled"] is False
    assert webhooks.rotate_secret("wh-1")["secret"] == "whsec_bmV3"
    assert webhooks.list_deliveries("wh-1") == [{"id": "d-1", "status": "delivered"}]
    webhooks.delete("wh-1")

    assert [(call.method, call.url.path) for call in calls] == [
        ("POST", "/microvm-webhooks"),
        ("GET", "/microvm-webhooks"),
        ("PATCH", "/microvm-webhooks/wh-1"),
        ("POST", "/microvm-webhooks/wh-1/secret"),
        ("GET", "/microvm-webhooks/wh-1/deliveries"),
        ("DELETE", "/microvm-webhooks/wh-1"),
    ]
    assert json.loads(calls[0].content) == {
        "url": "https://example.com/hooks",
        "events": ["microvm.stopped"],
        "applicationId": "app-1",
    }
    assert calls[1].url.params["applicationId"] == "app-1"
    assert json.loads(calls[2].content) == {"enabled": False}
