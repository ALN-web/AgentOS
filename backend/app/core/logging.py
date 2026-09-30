"""Structured, single-line logs that carry the request id."""

import contextvars
import logging

request_id_var: contextvars.ContextVar[str] = contextvars.ContextVar("request_id", default="-")


class _RequestIdFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = request_id_var.get()
        return True


def configure_logging(level: str) -> None:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s [req=%(request_id)s] %(message)s"))
    handler.addFilter(_RequestIdFilter())
    root = logging.getLogger("agentos")
    root.handlers = [handler]
    root.setLevel(level)
    root.propagate = False
    # httpx logs every request URL at INFO; keep Google calls out of the logs.
    logging.getLogger("httpx").setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(f"agentos.{name}")
