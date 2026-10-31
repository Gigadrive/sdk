"""Gigadrive Network SDK for Python.

>>> from gigadrive import MicroVM
>>> with MicroVM.create(image="python3.13", timeout=600) as vm:
...     result = vm.run("python --version")
...     print(result.stdout)
"""

from ._client import HttpClient
from .errors import (
    ApiError,
    AuthenticationError,
    CommandFailedError,
    GigadriveError,
    InvalidRequestError,
    MicroVmBusyError,
    MicroVmImageNotReadyError,
    MicroVmNotFoundError,
    MicroVmNotRunningError,
    MicroVmPausedError,
    MicroVmQuotaExceededError,
    MicroVmTimeoutError,
    MicroVmUnreachableError,
)
from .microvms import Command, CommandResult, FileEntry, Files, MicroVM, OutputChunk

__version__ = "0.1.0"

__all__ = [
    "ApiError",
    "AuthenticationError",
    "Command",
    "CommandFailedError",
    "CommandResult",
    "FileEntry",
    "Files",
    "GigadriveError",
    "HttpClient",
    "InvalidRequestError",
    "MicroVM",
    "MicroVmBusyError",
    "MicroVmImageNotReadyError",
    "MicroVmNotFoundError",
    "MicroVmNotRunningError",
    "MicroVmPausedError",
    "MicroVmQuotaExceededError",
    "MicroVmTimeoutError",
    "MicroVmUnreachableError",
    "OutputChunk",
]
