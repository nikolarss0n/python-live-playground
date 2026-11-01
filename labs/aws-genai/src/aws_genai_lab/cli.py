import argparse

from botocore.exceptions import BotoCoreError

from .bedrock import SYNTHETIC_QUESTION, BedrockAdapter, LiveSettings, live_client
from .contracts import Question
from .controls import DEMO_PRINCIPAL
from .harness import HarnessFailure, run_question
from .offline import OfflineClient


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Synthetic Bedrock lab; offline unless --live")
    parser.add_argument("--live", action="store_true", help="Make one billable Bedrock request")
    args = parser.parse_args(argv)
    if args.live:
        try:
            settings = LiveSettings.from_environment()
        except ValueError as error:
            parser.error(str(error))
        try:
            model = BedrockAdapter(live_client(settings), settings.model_id, max_attempts=1)
        except BotoCoreError:
            print("AWS client setup failed. Check your approved local AWS sign-in and region.")
            return 1
    else:
        model = BedrockAdapter(OfflineClient(), "offline-fixture", max_attempts=1)
    try:
        result = run_question(Question(text=SYNTHETIC_QUESTION), model, DEMO_PRINCIPAL)
    except HarnessFailure as error:
        print(str(error))
        for event in error.audit:
            print(event.model_dump_json())
        return 1
    print(result.model_dump_json(indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
