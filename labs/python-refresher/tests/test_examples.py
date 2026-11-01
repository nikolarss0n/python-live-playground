import pytest

from python_refresher.examples import latest_by_id, unique_ids


@pytest.mark.parametrize(
    "ids,expected",
    [
        ([], []),
        (["b", "a", "b", "c", "a"], ["b", "a", "c"]),
        ([0, "", 0, ""], [0, ""]),
        ([(1, 2), (3, 4), (1, 2)], [(1, 2), (3, 4)]),
    ],
)
def test_unique_ids_preserves_first_seen_order(ids, expected):
    before = ids.copy()
    assert unique_ids(ids) == expected
    assert ids == before


def test_unhashable_id_has_an_explicit_failure():
    with pytest.raises(TypeError):
        unique_ids([[1]])


def test_latest_keeps_newest_record_and_first_timestamp_tie():
    first = {"id": "r1", "timestamp": 2, "value": "first newest", "extra": 9}
    records = [
        {"id": "r1", "timestamp": 1, "value": "old"},
        first,
        {"id": "r1", "timestamp": 2, "value": "tie"},
        {"id": "r2", "timestamp": -2.5},
    ]
    selected = latest_by_id(records)
    assert selected == {"r1": first, "r2": records[-1]}
    assert selected["r1"] is not first
    selected["r1"]["extra"] = 100
    assert first["extra"] == 9


@pytest.mark.parametrize(
    "invalid",
    [
        None,
        [],
        "record",
        {},
        {"id": "", "timestamp": 1},
        {"id": 0, "timestamp": 1},
        {"id": "r1"},
        {"id": "r1", "timestamp": "2"},
        {"id": "r1", "timestamp": True},
    ],
)
def test_latest_skips_invalid_records(invalid):
    assert latest_by_id([invalid, {"id": "ok", "timestamp": 0}]) == {
        "ok": {"id": "ok", "timestamp": 0},
    }


def test_latest_empty_input():
    assert latest_by_id([]) == {}
