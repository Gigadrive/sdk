"""HTTP transport and credentials, shared by every resource."""

from __future__ import annotations

import base64
import os
import threading
import time
from typing import Any, Dict, Mapping, Optional

import httpx

from .errors import AuthenticationError, api_error

DEFAULT_BASE_URL = "https://api.gigadrive.network"
# Renew a client-credentials token this long before it expires.
_TOKEN_REFRESH_MARGIN_S = 60
# Retries of idempotent reads on a transient failure (429, 502, 503, 504, network).
_READ_RETRIES = 3
_TRANSIENT_STATUSES = {429, 502, 503, 504}


class _Credentials:
    """A bearer token, or an API key exchanged for short-lived tokens.

    Resolution order, like the TypeScript SDK: an explicit ``bearer_token``,
    then an explicit ``client_id`` and ``client_secret``, then
    ``GIGADRIVE_BEARER_TOKEN``, then ``GIGADRIVE_CLIENT_ID`` with
    ``GIGADRIVE_CLIENT_SECRET``.
    """

    def __init__(
        self,
        base_url: str,
        bearer_token: Optional[str],
        client_id: Optional[str],
        client_secret: Optional[str],
    ) -> None:
        bearer_token = bearer_token or (None if client_id else os.environ.get("GIGADRIVE_BEARER_TOKEN"))
        client_id = client_id or (None if bearer_token else os.environ.get("GIGADRIVE_CLIENT_ID"))
        client_secret = client_secret or os.environ.get("GIGADRIVE_CLIENT_SECRET")
        if not bearer_token and not (client_id and client_secret):
            raise AuthenticationError(
                "No Gigadrive credentials: pass bearer_token, or client_id and client_secret (an API key), "
                "or set GIGADRIVE_BEARER_TOKEN, or GIGADRIVE_CLIENT_ID and GIGADRIVE_CLIENT_SECRET."
            )
        self._static = bearer_token
        self._client_id = client_id
        self._client_secret = client_secret
        self._token_url = f"{base_url}/oauth2/token"
        self._token: Optional[str] = None
        self._expires_at = 0.0
        self._lock = threading.Lock()

    def token(self, http: httpx.Client, *, force: bool = False) -> str:
        if self._static:
            return self._static
        with self._lock:
            if not force and self._token and time.time() < self._expires_at - _TOKEN_REFRESH_MARGIN_S:
                return self._token
            basic = base64.b64encode(f"{self._client_id}:{self._client_secret}".encode()).decode()
            response = http.post(
                self._token_url,
                headers={"Authorization": f"Basic {basic}", "Content-Type": "application/x-www-form-urlencoded"},
                content="grant_type=client_credentials",
            )
            if response.status_code >= 400:
                raise AuthenticationError(f"OAuth2 token request failed ({response.status_code}): {response.text}")
            data = response.json()
            token = data.get("access_token")
            if not isinstance(token, str):
                raise AuthenticationError("OAuth2 token response has no access_token")
            self._token = token
            expires_in = data.get("expires_in")
            self._expires_at = time.time() + (expires_in if isinstance(expires_in, (int, float)) else 300)
            return token


class HttpClient:
    """One authenticated HTTP client for the Network API.

    Reads (``GET``) are retried with backoff on transient failures; writes are
    sent once, because a retried create or command could run twice.
    """

    def __init__(
        self,
        *,
        base_url: Optional[str] = None,
        bearer_token: Optional[str] = None,
        client_id: Optional[str] = None,
        client_secret: Optional[str] = None,
        timeout: float = 120.0,
        transport: Optional[httpx.BaseTransport] = None,
    ) -> None:
        self.base_url = (base_url or os.environ.get("GIGADRIVE_API_BASE_URL") or DEFAULT_BASE_URL).rstrip("/")
        self._http = httpx.Client(timeout=timeout, transport=transport)
        self._credentials = _Credentials(self.base_url, bearer_token, client_id, client_secret)

    def close(self) -> None:
        self._http.close()

    def request(
        self,
        method: str,
        path: str,
        *,
        json: Any = None,
        content: Optional[bytes] = None,
        params: Optional[Mapping[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
        timeout: Optional[float] = None,
    ) -> httpx.Response:
        query = {key: _query_value(value) for key, value in (params or {}).items() if value is not None}
        attempts = _READ_RETRIES + 1 if method == "GET" else 1
        refreshed = False
        attempt = 0
        while True:
            attempt += 1
            all_headers = {"Authorization": f"Bearer {self._credentials.token(self._http, force=refreshed)}"}
            all_headers.update(headers or {})
            try:
                response = self._http.request(
                    method,
                    f"{self.base_url}{path}",
                    json=json,
                    content=content,
                    params=query,
                    headers=all_headers,
                    timeout=timeout if timeout is not None else httpx.USE_CLIENT_DEFAULT,
                )
            except httpx.TransportError:
                if attempt >= attempts:
                    raise
                time.sleep(0.25 * 2 ** (attempt - 1))
                continue
            # A client-credentials token can be revoked or rotated early: renew once.
            if response.status_code == 401 and not refreshed and not self._credentials._static:
                refreshed = True
                continue
            if response.status_code in _TRANSIENT_STATUSES and attempt < attempts:
                time.sleep(0.25 * 2 ** (attempt - 1))
                continue
            if response.status_code >= 400:
                raise _error_from(response)
            return response

    def json(self, method: str, path: str, **kwargs: Any) -> Any:
        response = self.request(method, path, **kwargs)
        if response.status_code == 204 or not response.content:
            return None
        return response.json()


def _query_value(value: Any) -> Any:
    if isinstance(value, bool):
        return "true" if value else "false"
    return value


def _error_from(response: httpx.Response) -> Exception:
    message = f"HTTP {response.status_code}"
    code: Optional[str] = None
    try:
        body = response.json()
    except ValueError:
        body = None
    if isinstance(body, dict):
        code = body.get("code") if isinstance(body.get("code"), str) else None
        for key in ("message", "error"):
            if isinstance(body.get(key), str):
                message = body[key]
                break
    elif response.text:
        message = response.text[:500]
    return api_error(response.status_code, message, code)
