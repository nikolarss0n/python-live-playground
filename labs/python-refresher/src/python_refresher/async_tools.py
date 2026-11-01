import asyncio
import math
from collections.abc import Awaitable, Callable, Sequence
from typing import Literal, TypedDict

AsyncCall = Callable[[], Awaitable[object]]


class Success(TypedDict):
    ok: Literal[True]
    value: object


class Failure(TypedDict):
    ok: Literal[False]
    error: str


async def run_limited(
    calls: Sequence[AsyncCall], timeout_s: float = 0.05
) -> list[Success | Failure]:
    if type(timeout_s) not in (int, float) or not math.isfinite(timeout_s) or timeout_s <= 0:
        raise ValueError("timeout_s must be a positive finite number")
    semaphore = asyncio.Semaphore(2)

    async def run_one(call: AsyncCall) -> Success | Failure:
        async with semaphore:
            try:
                value = await asyncio.wait_for(call(), timeout=timeout_s)
                return {"ok": True, "value": value}
            except TimeoutError:
                return {"ok": False, "error": "timeout"}
            except Exception as error:
                return {"ok": False, "error": type(error).__name__}

    tasks = [asyncio.create_task(run_one(call)) for call in calls]
    try:
        return list(await asyncio.gather(*tasks))
    finally:
        # Cancellation must not leave active or queued work running after the caller returns.
        for task in tasks:
            if not task.done():
                task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)


async def demo() -> list[Success | Failure]:
    async def succeed() -> str:
        await asyncio.sleep(0)
        return "ready"

    async def fail() -> None:
        raise ValueError("Synthetic failure; the raw message is not returned")

    async def wait() -> None:
        await asyncio.sleep(60)

    return await run_limited([succeed, fail, wait], timeout_s=0.01)
