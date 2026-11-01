"""Errors raised by the Gigadrive SDK.

Every error derives from :class:`GigadriveError`. API refusals are
:class:`ApiError` subclasses that carry the HTTP status and the stable
``code`` the API answered with, so callers can branch on either.
"""

from __future__ import annotations

from typing import Optional


class GigadriveError(Exception):
    """Base class of every error the SDK raises."""


class AuthenticationError(GigadriveError):
    """No usable credentials, or the token exchange was refused."""


class ApiError(GigadriveError):
    """The Network API refused a request."""

    def __init__(self, message: str, status: int, code: Optional[str] = None) -> None:
        super().__init__(message)
        self.message = message
        self.status = status
        self.code = code

    def __repr__(self) -> str:
        return f"{type(self).__name__}(status={self.status}, code={self.code!r}, message={self.message!r})"


class MicroVmNotFoundError(ApiError):
    """The microVM, file or command does not exist, or the credential cannot see it."""


class MicroVmNotRunningError(ApiError):
    """The operation needs a running microVM (``microvm_not_running``)."""


class MicroVmPausedError(ApiError):
    """The microVM is paused (``microvm_paused``). Resume it, or create it with ``auto_resume``."""


class MicroVmBusyError(ApiError):
    """Too many operations on one microVM at once, or its host is restarting. Retry shortly."""


class MicroVmUnreachableError(ApiError):
    """The microVM could not be reached (``microvm_unreachable``). Retry shortly."""


class MicroVmQuotaExceededError(ApiError):
    """A plan limit or the concurrent microVM quota refused the request."""


class MicroVmImageNotReadyError(ApiError):
    """The image is still building (``image_not_ready``)."""


class InvalidRequestError(ApiError):
    """The request was malformed or violates the contract (``400``)."""


class MicroVmTimeoutError(GigadriveError):
    """A wait ran out before the microVM or command reached the expected state."""


class CommandFailedError(GigadriveError):
    """A command run with ``check=True`` exited non-zero or was killed by a signal."""

    def __init__(self, result: "object") -> None:
        exit_code = getattr(result, "exit_code", None)
        signal = getattr(result, "signal", None)
        reason = f"exited with code {exit_code}" if exit_code is not None else f"was killed by {signal or 'a signal'}"
        super().__init__(f"The command {reason}")
        self.result = result


_BY_CODE = {
    "microvm_not_running": MicroVmNotRunningError,
    "microvm_paused": MicroVmPausedError,
    "microvm_busy": MicroVmBusyError,
    "microvm_unreachable": MicroVmUnreachableError,
    "quota_exceeded": MicroVmQuotaExceededError,
    "plan_limit_exceeded": MicroVmQuotaExceededError,
    "image_not_ready": MicroVmImageNotReadyError,
    "invalid_request": InvalidRequestError,
}


def api_error(status: int, message: str, code: Optional[str]) -> ApiError:
    """The most specific :class:`ApiError` for an API answer."""
    if code is not None and code in _BY_CODE:
        return _BY_CODE[code](message, status, code)
    if status == 404:
        return MicroVmNotFoundError(message, status, code)
    if status == 400:
        return InvalidRequestError(message, status, code)
    return ApiError(message, status, code)
