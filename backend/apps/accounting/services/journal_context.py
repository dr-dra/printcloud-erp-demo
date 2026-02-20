from __future__ import annotations

from contextlib import contextmanager
from contextvars import ContextVar


_SKIP_ACCOUNTING_JOURNAL_SIGNALS: ContextVar[bool] = ContextVar(
    "SKIP_ACCOUNTING_JOURNAL_SIGNALS",
    default=False,
)


def should_skip_accounting_journal_signals() -> bool:
    return bool(_SKIP_ACCOUNTING_JOURNAL_SIGNALS.get())


@contextmanager
def skip_accounting_journal_signals():
    """
    Used by authoritative flows (views/services) that explicitly schedule journals.
    Signals remain as a backstop for admin/legacy writes.
    """
    token = _SKIP_ACCOUNTING_JOURNAL_SIGNALS.set(True)
    try:
        yield
    finally:
        _SKIP_ACCOUNTING_JOURNAL_SIGNALS.reset(token)

