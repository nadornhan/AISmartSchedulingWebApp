from __future__ import annotations

import threading
import time
from collections import defaultdict, deque

from app.ai.exceptions import AIRequestLimitError


class AIRequestLimiter:
    """In-process limiter intended for local and single-worker free-tier use."""

    def __init__(self, requests_per_minute: int) -> None:
        self.requests_per_minute = requests_per_minute
        self._requests: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def check(self, user_key: str, *, now: float | None = None) -> None:
        timestamp = time.monotonic() if now is None else now
        cutoff = timestamp - 60
        with self._lock:
            requests = self._requests[user_key]
            while requests and requests[0] <= cutoff:
                requests.popleft()
            if len(requests) >= self.requests_per_minute:
                raise AIRequestLimitError("Per-user AI request limit exceeded")
            requests.append(timestamp)
