import argparse
import asyncio
import json
import sys
from dataclasses import asdict
from pathlib import Path

from .async_tools import demo
from .examples import latest_by_id, unique_ids
from .models import ResultCounter, load_tool_results


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Local Python refresher examples")
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--file", type=Path, help="Read a JSON array of tool results")
    group.add_argument(
        "--async-demo", action="store_true", help="Run bounded synthetic async calls"
    )
    args = parser.parse_args(argv)

    if args.async_demo:
        print(json.dumps(asyncio.run(demo()), indent=2))
        return 0
    if args.file is not None:
        try:
            results = load_tool_results(args.file)
        except json.JSONDecodeError:
            print("Malformed JSON syntax.", file=sys.stderr)
            return 2
        except FileNotFoundError:
            print("File not found.", file=sys.stderr)
            return 2
        except ValueError:
            print("Valid JSON, but invalid record contents.", file=sys.stderr)
            return 2
        counter = ResultCounter()
        for result in results:
            counter.record(result)
        print(
            json.dumps(
                {
                    "records": [asdict(result) for result in results],
                    "successes": counter.successes,
                    "failures": counter.failures,
                },
                indent=2,
            )
        )
        return 0
    print(
        json.dumps(
            {
                "unique_ids": unique_ids(["b", "a", "b", "c", "a"]),
                "latest_by_id": latest_by_id(
                    [
                        {"id": "r1", "timestamp": 2, "value": "new"},
                        {"id": "r1", "timestamp": 1, "value": "old"},
                    ]
                ),
            },
            indent=2,
        )
    )
    return 0
