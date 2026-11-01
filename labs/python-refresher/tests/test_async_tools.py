import asyncio

import pytest

from python_refresher.async_tools import demo, run_limited


def test_ordered_success_failure_and_timeout():
    assert asyncio.run(demo()) == [
        {"ok": True, "value": "ready"},
        {"ok": False, "error": "ValueError"},
        {"ok": False, "error": "timeout"},
    ]


def test_two_calls_can_overlap_but_a_third_waits():
    async def scenario():
        active = 0
        peak = 0
        admitted_two = asyncio.Event()
        release = asyncio.Event()

        async def operation():
            nonlocal active, peak
            active += 1
            peak = max(peak, active)
            if active == 2:
                admitted_two.set()
            try:
                await release.wait()
                return "done"
            finally:
                active -= 1

        runner = asyncio.create_task(run_limited([operation] * 4, timeout_s=1))
        await asyncio.wait_for(admitted_two.wait(), timeout=1)
        assert active == 2
        release.set()
        assert await runner == [{"ok": True, "value": "done"}] * 4
        assert peak == 2
        assert active == 0

    asyncio.run(scenario())


def test_timeout_awaits_cleanup():
    async def scenario():
        cleaned = []

        async def slow():
            try:
                await asyncio.Event().wait()
            finally:
                await asyncio.sleep(0)
                cleaned.append(True)

        assert await run_limited([slow], timeout_s=0.001) == [{"ok": False, "error": "timeout"}]
        assert cleaned == [True]

    asyncio.run(scenario())


def test_external_cancellation_propagates_and_cleans_up_admitted_calls():
    async def scenario():
        started = 0
        cleaned = 0
        admitted_two = asyncio.Event()

        async def operation():
            nonlocal started, cleaned
            started += 1
            if started == 2:
                admitted_two.set()
            try:
                await asyncio.Event().wait()
            finally:
                await asyncio.sleep(0)
                cleaned += 1

        runner = asyncio.create_task(run_limited([operation] * 3, timeout_s=10))
        await asyncio.wait_for(admitted_two.wait(), timeout=1)
        runner.cancel()
        with pytest.raises(asyncio.CancelledError):
            await runner
        assert started == cleaned == 2

    asyncio.run(scenario())


@pytest.mark.parametrize("timeout", [0, -1, True, "1", float("inf"), float("nan")])
def test_invalid_timeout_fails_before_starting_work(timeout):
    calls = []

    async def operation():
        calls.append(True)

    with pytest.raises(ValueError):
        asyncio.run(run_limited([operation], timeout_s=timeout))
    assert calls == []


def test_empty_call_list():
    assert asyncio.run(run_limited([])) == []
