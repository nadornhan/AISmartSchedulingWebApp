from __future__ import annotations

import threading
import time
from collections import defaultdict, deque

from app.ai.exceptions import AIRequestLimitError


class AIRequestLimiter:
    """In-process limiter intended for local and single-worker free-tier use."""

    def __init__(self, requests_per_minute: int) -> None:
        self.requests_per_minute = requests_per_minute
        self._requests: dict[tuple[str, str], deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def check(
        self,
        user_key: str,
        *,
        feature: str = "global",
        feature_requests_per_minute: int | None = None,
        now: float | None = None,
    ) -> None:
        timestamp = time.monotonic() if now is None else now
        cutoff = timestamp - 60
        feature_limit = feature_requests_per_minute or self.requests_per_minute
        with self._lock:
            global_requests = self._requests[(user_key, "global")]
            feature_requests = self._requests[(user_key, feature)]
            for requests in (global_requests, feature_requests):
                while requests and requests[0] <= cutoff:
                    requests.popleft()

            if len(global_requests) >= self.requests_per_minute:
                raise AIRequestLimitError("Per-user AI request limit exceeded")
            if feature != "global" and len(feature_requests) >= feature_limit:
                raise AIRequestLimitError(
                    f"Per-user request limit exceeded for AI feature {feature}"
                )

            global_requests.append(timestamp)
            if feature != "global":
                feature_requests.append(timestamp)
