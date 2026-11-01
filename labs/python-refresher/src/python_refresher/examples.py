from collections.abc import Hashable, Iterable


def unique_ids(ids: Iterable[Hashable]) -> list[Hashable]:
    """Keep each hashable ID's first occurrence without changing the input."""
    seen: set[Hashable] = set()
    result: list[Hashable] = []
    for record_id in ids:
        if record_id not in seen:
            seen.add(record_id)
            result.append(record_id)
    return result


def latest_by_id(records: Iterable[object]) -> dict[str, dict[str, object]]:
    """Skip invalid records; copy each ID's newest record, with first-wins ties.

    Numeric timestamps follow the browser contract: int or float, excluding bool.
    Inputs to this exercise do not contain NaN or infinity.
    """
    latest: dict[str, dict[str, object]] = {}
    for record in records:
        if not isinstance(record, dict):
            continue
        record_id = record.get("id")
        timestamp = record.get("timestamp")
        if not isinstance(record_id, str) or not record_id or type(timestamp) not in (int, float):
            continue
        previous = latest.get(record_id)
        if previous is None or timestamp > previous["timestamp"]:
            latest[record_id] = record.copy()
    return latest
