import type { CheckDefinition, PracticeDay } from './types'

const tutorial = { label: 'Official Python tutorial', url: 'https://docs.python.org/3/tutorial/' }

const FOUNDATION_CONTENT: Omit<PracticeDay, 'consolidation'>[] = [
  {
    id: 'refresher-01', day: 1, kind: 'practice', support: 'worked', minutes: 75,
    title: 'Basic syntax',
    recall: 'Before looking at an example, write one variable assignment and say what you think a function returns. This first recall is a starting point, not a test of prior experience.',
    concepts: [
      { term: 'Running a file', explanation: 'A local Python file is plain text saved with a .py suffix. python3 hello.py executes its statements from top to bottom. Here the browser runs the editor after a pause; you can also use Run.', example: '# Save as hello.py locally, then run: python3 hello.py\nprint("Ready")' },
      { term: 'Indentation, colons, and comments', explanation: 'A colon ends a function header. Its body is indented consistently, usually four spaces. A # comment explains intent and is not executed. Dedenting ends the block.', example: 'def greet():\n    # This line belongs to greet.\n    return "Hello"\n\nmessage = greet()' },
      { term: 'Variables and basic types', explanation: 'Assignment gives a name to a value. str stores text, int a whole number, float a decimal number, and bool True or False. None represents an absent value; it is different from an empty string or zero.', example: 'name = "search"       # str\ncount = 3             # int\nduration = 0.25       # float\nsuccess = True        # bool\nerror = None          # no error value' },
      { term: 'Conversions', explanation: 'str(value), int(value), and float(value) request a conversion. int("3") works, while float("0.25") handles a decimal string. bool("False") is True because any nonempty string is truthy; it does not parse the word False.', example: 'count = int("3")\nduration = float("0.25")\nlabel = str(count)\nprint(type(duration).__name__)' },
      { term: 'print and f-strings', explanation: 'print sends text to the output display. An f-string places expressions inside braces. The format :.2f shows exactly two decimal places; it changes presentation, not the original number.', example: 'duration = 0.256\nprint(f"Finished in {duration:.2f}s")\nprint(duration)' },
      { term: 'def and return', explanation: 'def creates a reusable function. Arguments supply its inputs when called. return sends a value back to the caller and ends the call. A function that only prints returns None by default.', example: 'def double(number):\n    return number * 2\n\nresult = double(4)\nprint(result)' },
    ],
    workedExample: '# A different function: produce a label, then choose to print it.\ndef format_total(item, count):\n    text = f"{item}: {count} items"\n    return text\n\ntotal = int("3")\nlabel = format_total("notebooks", total)\nprint(label)\n',
    problem: 'Implement format_tool(name, duration, success). Return exactly "search: 0.25s (success=True)" for ("search", 0.25, True). Use the supplied name, two decimal places, and the Python boolean spelling. The function must return its text without printing. Inputs are already a string, a number, and a boolean.',
    acceptance: ['The name and duration come from the arguments; duration displays two decimal places.', 'False success and zero duration are preserved.', 'The function returns a string and produces no output itself.'],
    guidedStarter: 'def format_tool(name, duration, success):\n    # f introduces interpolation; each brace contains an input value.\n    message = f"{name}: {duration:.2f}s (success={???})"\n    ??? message\n\nresult = format_tool("search", 0.25, True)\nprint(result)\n',
    independentStarter: 'def format_tool(name, duration, success):\n    """Return the required tool summary without printing it."""\n    pass\n',
    hints: ['The last f-string field is success. Use return to give message to the caller.', 'Keep print outside the function so another function can reuse the returned text.'],
    reviewPrompts: ['Explain each line, including the colon, indentation, braces, and :.2f.', 'What would the caller receive if you replaced return with print?', 'Why are None, 0, False, and "" different values even when some behave similarly in conditions?'],
    resources: [tutorial],
    checks: [
      { id: 'format-values', label: 'Format changing names and durations' },
      { id: 'format-false-zero', label: 'Preserve False and zero duration' },
      { id: 'return-not-print', label: 'Return a reusable string without printing' },
    ],
  },
  {
    id: 'refresher-02', day: 2, kind: 'practice', support: 'worked', minutes: 75,
    title: 'Conditions and loops',
    recall: 'Recreate yesterday’s format_tool signature and a return statement from memory. Explain what changes if the function prints instead.',
    concepts: [
      { term: 'Comparisons and branches', explanation: '== compares values; = assigns a value. <, <=, >, >= and != form other comparisons. if tests the first condition, elif tests an alternative only when earlier branches failed, and else covers the remaining case.', example: 'duration = 1.5\nif duration < 1:\n    print("fast")\nelif duration <= 2:\n    print("normal")\nelse:\n    print("slow")' },
      { term: 'and, or, not, truthiness, and None', explanation: 'and requires both conditions; or accepts either; not reverses a boolean condition. Empty collections, empty strings, zero, False, and None are falsey. Use is None when only absence matters, so a legitimate False or zero is not mistaken for missing data.', example: 'value = False\nprint(not value)\nprint(value is None)\nprint(value is not None and (value is True or value is False))' },
      { term: 'for, range, and enumerate', explanation: 'for visits each item. range(3) supplies 0, 1, 2; its stop is excluded. enumerate attaches a position to each item and accepts a starting number.', example: 'for number in range(3):\n    print(number)\nfor position, label in enumerate(["search", "lookup"], start=1):\n    print(position, label)' },
      { term: 'while and termination', explanation: 'while repeats as long as its condition is true. Something must change the condition or leave the loop; otherwise it runs forever. Trace the variable before and after each iteration.', example: 'remaining = 3\nwhile remaining > 0:\n    print(remaining)\n    remaining -= 1' },
      { term: 'break and continue', explanation: 'continue skips the rest of the current iteration. break leaves the nearest loop completely. Neither returns from the surrounding function unless return is used explicitly.', example: 'for value in [None, 2, -1, 9]:\n    if value is None:\n        continue\n    if value < 0:\n        break\n    print(value)' },
    ],
    workedExample: '# Count positive measurements; this is a different contract from run status.\ndef count_positive(values):\n    total = 0\n    for position, value in enumerate(values):\n        if value is None:\n            continue\n        if value > 0:\n            total += 1\n    return total\n\nprint(count_positive([2, None, 0, 5]))\n',
    problem: 'Implement count_runs(records), where records is a list of status values such as [True, False, None, True]. Return {"success": 2, "failed": 1, "skipped": 1}. Only the actual boolean True counts as success and False as failure. None or any other value is skipped. Do not change the input.',
    acceptance: ['Every input value contributes to exactly one counter.', 'An empty list returns three zeros.', 'False is failed; None, 0, 1, and text are skipped rather than accepted by truthiness.'],
    guidedStarter: 'def count_runs(records):\n    successful = 0\n    failed = 0\n    skipped = 0\n    for status in records:\n        if status is True:\n            successful += ???\n        elif status is False:\n            failed += 1\n        else:\n            ??? += 1\n    return {"success": successful, "failed": failed, "skipped": skipped}\n\nprint(count_runs([True, False, None, True]))\n',
    independentStarter: 'def count_runs(records):\n    """Count actual True, actual False, and skipped status values without changing records."""\n    pass\n',
    hints: ['Increment a counter by 1. The else branch increments skipped.', 'Use is True and is False here because 1 == True, but the contract accepts actual booleans only.'],
    reviewPrompts: ['Trace all three counters aloud for [False, None, True, 0].', 'Why would if status lose the distinction between False and missing input?', 'Explain where break and continue would transfer control in the worked loop.'],
    resources: [tutorial],
    checks: [
      { id: 'count-statuses', label: 'Count successes and failures exactly' },
      { id: 'count-empty', label: 'Handle empty input without changing records' },
      { id: 'count-missing', label: 'Distinguish False from missing or nonboolean status' },
    ],
  },
  {
    id: 'refresher-03', day: 3, kind: 'practice', support: 'partial', minutes: 75,
    title: 'Lists, tuples and sets',
    recall: 'Write a loop that skips None but still processes False. Explain the difference between continue and break before opening today’s example.',
    concepts: [
      { term: 'Creating collections and indexing', explanation: 'A list keeps ordered, mutable items. A tuple keeps an ordered grouping that cannot be changed in place. Index 0 selects the first item and -1 selects the last; indexing an empty collection raises an error.', example: 'tools = ["search", "lookup"]\nrun = ("search", 0.25)\nprint(tools[0], tools[-1])\nprint(run[1])' },
      { term: 'Slicing and append', explanation: 'items[start:stop] returns a new list and excludes stop. Missing bounds mean the beginning or end. append changes the existing list and returns None; do not assign its return value back to the list.', example: 'tools = ["a", "b", "c", "d"]\nprint(tools[1:3])\nprint(tools[:2])\nprint(tools[::2])\ntools.append("e")\nprint(tools)' },
      { term: 'Tuple unpacking', explanation: 'Unpacking assigns each part of an ordered value to a name. The number of names normally matches the number of items. A for loop can unpack each pair as it visits it.', example: 'name, duration = ("lookup", 0.4)\nfor tool, count in [("search", 2), ("lookup", 1)]:\n    print(tool, count)' },
      { term: 'Membership, sets, and add', explanation: 'in asks whether an item is present. A set stores unique hashable values and supports efficient membership checks on average. set() creates an empty set; {} creates an empty dictionary. add changes a set. A set is not the place to preserve output order.', example: 'seen = set()\nseen.add("r1")\nprint("r1" in seen)\nprint("r2" not in seen)' },
    ],
    workedExample: '# Keep repeated labels out of a permission list.\nallowed = {"read", "list"}\nrequests = [("read", "r1"), ("delete", "r2"), ("list", "r3")]\naccepted = []\nfor action, record_id in requests:\n    if action in allowed:\n        accepted.append(record_id)\nprint(accepted[:2])\n',
    problem: 'Complete unique_ids(ids). Return a list containing the first occurrence of each hashable ID, in original order. For ["b", "a", "b", "c", "a"], return ["b", "a", "c"]. Preserve valid falsey IDs such as 0 and "". Do not mutate ids.',
    acceptance: ['Duplicates are removed without sorting the result.', 'An empty input returns an empty list; falsey IDs remain valid.', 'The input stays unchanged and each call produces an independent result list.'],
    guidedStarter: 'def unique_ids(ids):\n    seen = set()\n    result = []\n    for record_id in ids:\n        if record_id not in ???:\n            seen.add(record_id)\n            result.append(???)\n    return result\n\nprint(unique_ids(["b", "a", "b", "c"]))\n',
    independentStarter: 'def unique_ids(ids):\n    """Return unique hashable IDs in first-seen order without changing ids."""\n    pass\n',
    hints: ['A set answers whether an ID has been seen; a list records the required order.', 'Both add and append modify their collections. Neither needs its return value assigned.'],
    reviewPrompts: ['Why does this problem need both a set and a list?', 'What is the difference between ids[:2] and ids[2]?', 'Explain why result = result.append(record_id) breaks the next iteration.'],
    resources: [tutorial],
    checks: [
      { id: 'unique-order', label: 'Remove duplicates while preserving first-seen order' },
      { id: 'unique-empty-falsey', label: 'Handle empty input and falsey IDs' },
      { id: 'unique-no-mutation', label: 'Preserve the input and isolate each result' },
    ],
  },
  {
    id: 'refresher-04', day: 4, kind: 'practice', support: 'partial', minutes: 75,
    title: 'Dictionaries and nested data',
    recall: 'Write unique_ids from memory and explain which object tracks membership and which object preserves order. Then describe one safe way to copy a list.',
    concepts: [
      { term: 'Dictionary keys and values', explanation: 'A dictionary maps keys to values. Use a key, rather than a numeric position, to retrieve the associated value. Assigning to a key adds or updates that entry.', example: 'counts = {"search": 2}\ncounts["lookup"] = 1\ncounts["search"] = 3\nprint(counts["search"])' },
      { term: 'Indexing versus get', explanation: 'record["id"] requires the key and raises KeyError when it is missing. record.get("id") returns None by default. A second argument supplies a different default; an existing value of None is not replaced by that default.', example: 'record = {"id": "r1", "timestamp": None}\nprint(record.get("missing", "unknown"))\nprint(record.get("timestamp", 0))' },
      { term: 'items and nested structures', explanation: 'items() yields key-value pairs that a loop can unpack. In a list of dictionaries, the outer loop selects a record and key lookup selects a field. Access one level at a time so a missing field is easier to diagnose.', example: 'records = [{"id": "r1", "timestamp": 2}, {"id": "r2"}]\nfor record in records:\n    for key, value in record.items():\n        print(key, value)' },
      { term: 'Missing fields and deterministic ties', explanation: 'Define what incomplete records and ties mean before coding. This exercise skips records with missing IDs or numeric timestamps. Replacing only for a strictly greater timestamp keeps the first record when timestamps tie.', example: 'previous_time = 5\nnew_time = 5\nprint(new_time > previous_time)\nprint(new_time >= previous_time)' },
      { term: 'Copying selected records', explanation: 'record.copy() creates a new outer dictionary. Changes to its direct fields do not affect the input, but nested lists and dictionaries remain shared. Today’s contract requires only an outer copy; deeper mutation is a separate decision.', example: 'original = {"id": "r1", "tags": ["new"]}\ncopy = original.copy()\ncopy["id"] = "r2"\nprint(original["id"])' },
    ],
    workedExample: '# Build a dictionary of the largest duration, not the latest record.\nmeasurements = [{"tool": "search", "duration": 0.2}, {"tool": "search", "duration": 0.4}]\nmaximum = {}\nfor item in measurements:\n    tool = item["tool"]\n    maximum[tool] = max(maximum.get(tool, 0), item["duration"])\nfor tool, duration in maximum.items():\n    print(tool, duration)\n',
    problem: 'Complete latest_by_id(records). Return a dictionary mapping each nonempty string id to an outer copy of its record with the greatest numeric timestamp. Skip non-dictionaries and records with a missing/empty id or a timestamp that is not an int or float; booleans are not timestamps. On equal timestamps, keep the first encountered record. Preserve every field of the selected record and leave the input unchanged. Inputs do not contain NaN or infinity.',
    acceptance: ['Choose the greatest timestamp for each ID; retain the first record on a tie.', 'Skip incomplete or wrongly typed records and return {} for empty input.', 'Preserve selected fields, make a new outer dictionary for each winner, and do not change the input.'],
    guidedStarter: 'def latest_by_id(records):\n    latest = {}\n    for record in records:\n        if not isinstance(record, dict):\n            continue\n        record_id = record.get("id")\n        timestamp = record.get("timestamp")\n        if not isinstance(record_id, str) or not record_id or type(timestamp) not in (int, float):\n            continue\n        previous = latest.get(record_id)\n        if previous is None or timestamp ??? previous["timestamp"]:\n            latest[record_id] = ???\n    return latest\n\nprint(latest_by_id([{"id": "r1", "timestamp": 2}, {"id": "r1", "timestamp": 1}]))\n',
    independentStarter: 'def latest_by_id(records):\n    """Return copied latest records by ID; first wins timestamp ties; skip incomplete records."""\n    pass\n',
    hints: ['Use > rather than >= to keep the first tied record.', 'Store record.copy() so changing a direct field of the output cannot change the input record.'],
    reviewPrompts: ['Explain when [] is clearer than .get(), and when .get() prevents a missing-key error.', 'State your tie policy before tracing a repeated ID.', 'Which nested values are still shared after a shallow dictionary copy?'],
    resources: [tutorial],
    checks: [
      { id: 'latest-winners', label: 'Select latest timestamps with first-wins ties' },
      { id: 'latest-missing', label: 'Skip incomplete records and handle empty input' },
      { id: 'latest-copies', label: 'Preserve fields without mutating input records' },
    ],
  },
  {
    id: 'refresher-05', day: 5, kind: 'practice', support: 'partial', minutes: 75,
    title: 'Functions and mutation',
    recall: 'Explain the difference between an outer copy and a deep copy. Reconstruct the greater-than comparison that keeps the first timestamp tie.',
    concepts: [
      { term: 'Parameters, arguments, and scope', explanation: 'Parameters are names in a function definition; arguments are values at a call site. A local name belongs to its call. Rebinding it does not rebind the caller’s name, but mutating a shared object is visible to the caller.', example: 'def rename(label):\n    label = label.strip()\n    return label\n\noriginal = " search "\nclean = rename(original)\nprint(original, clean)' },
      { term: 'Positional, keyword, and default arguments', explanation: 'Positional arguments match parameters in order. Keyword arguments name their targets. A default is used when the caller omits that argument; it is not substituted for an explicitly supplied None.', example: 'def label(name, prefix="tool-"):\n    return prefix + name\nprint(label("search"))\nprint(label(name="search", prefix="job-"))' },
      { term: 'Return values and type hints', explanation: 'Functions can return an object for later composition. A hint such as -> dict communicates an expected result to readers and type tools; it does not enforce runtime validation.', example: 'def copy_record(record: dict) -> dict:\n    return record.copy()\n\nresult = copy_record({"id": "r1"})' },
      { term: 'Mutable objects and shallow copies', explanation: 'Lists and dictionaries can change in place. dict.copy() copies the outer mapping; list(tags) copies the outer list. Copy a nested list explicitly when that is the value you intend to modify.', example: 'record = {"tags": ["new"]}\ncopy = record.copy()\ncopy["tags"] = list(record["tags"])\ncopy["tags"].append("reviewed")\nprint(record, copy)' },
      { term: 'Mutable-default pitfall', explanation: 'Default arguments are created once when def executes. A default list can therefore retain items across calls. Use None to represent an omitted collection, then create a new list inside the function.', example: '# Avoid: def add(item, items=[]): ...\ndef add(item, items=None):\n    result = [] if items is None else list(items)\n    result.append(item)\n    return result\nprint(add("a"), add("b"))' },
    ],
    workedExample: '# Copy and change one inventory record; the original stays reusable.\ndef with_quantity(item: dict, quantity=1) -> dict:\n    result = item.copy()\n    result["quantity"] = quantity\n    return result\n\noriginal = {"name": "notebook", "quantity": 2}\nupdated = with_quantity(original, quantity=5)\nprint(original)\nprint(updated)\n',
    problem: 'Implement three small functions. normalize_record(record, prefix="tool-") returns an outer copy with id = prefix + stripped id and name = stripped lowercase name; keep other fields. add_tag(record, tag, tags=None) returns an outer copy with a fresh tags list: copy record.get("tags", []) when tags is omitted, otherwise copy the supplied tags, then append tag. prepare_records(records, prefix="tool-") uses both helpers to normalize each record and add "reviewed". Inputs have string id/name and list tags when present. Never modify input records or supplied lists.',
    acceptance: ['Normalization supports the default prefix and positional or keyword custom prefixes, while retaining extra fields.', 'Tag lists do not leak across calls or modify the original or explicitly supplied list.', 'prepare_records composes both helpers, preserves order, and returns [] for an empty input.'],
    guidedStarter: 'def normalize_record(record: dict, prefix="tool-") -> dict:\n    result = record.copy()\n    result["id"] = prefix + record["id"].strip()\n    result["name"] = ???\n    return result\n\ndef add_tag(record: dict, tag: str, tags=None) -> dict:\n    source = record.get("tags", []) if tags is None else tags\n    copied_tags = ???\n    copied_tags.append(tag)\n    result = record.copy()\n    result["tags"] = copied_tags\n    return result\n\ndef prepare_records(records: list, prefix="tool-") -> list:\n    result = []\n    for record in records:\n        normalized = normalize_record(record, prefix=prefix)\n        result.append(???)\n    return result\n\nprint(prepare_records([{"id": " r1 ", "name": " Search "}]))\n',
    independentStarter: 'def normalize_record(record: dict, prefix="tool-") -> dict:\n    """Return a normalized outer copy while keeping extra fields."""\n    pass\n\ndef add_tag(record: dict, tag: str, tags=None) -> dict:\n    """Return an outer copy with the tag appended to a fresh list."""\n    pass\n\ndef prepare_records(records: list, prefix="tool-") -> list:\n    """Compose the two helpers to normalize records and add reviewed."""\n    pass\n',
    hints: ['Use record["name"].strip().lower(), list(source), and add_tag(normalized, "reviewed").', 'The outer dictionary copy is not enough if you append to the same nested tags list.'],
    reviewPrompts: ['Identify the parameters and arguments in normalize_record(record, prefix="job-").', 'Which operations create new objects, rebind local names, or mutate existing objects?', 'Why does a default of None avoid cross-call state, while tags=[] can retain it?'],
    resources: [tutorial],
    checks: [
      { id: 'function-normalize', label: 'Normalize copied records with explicit defaults' },
      { id: 'function-tags', label: 'Keep tag lists independent across calls' },
      { id: 'function-compose', label: 'Compose both helpers without changing the input' },
    ],
  },
  {
    id: 'refresher-06', day: 6, kind: 'practice', support: 'minimal', minutes: 75,
    title: 'Common problem-solving patterns',
    recall: 'Write a function that appends to a copy of a caller’s list. Explain why its default should not be a mutable list.',
    concepts: [
      { term: 'strip, split, and join', explanation: 'strip removes surrounding whitespace. split() without an argument separates on runs of whitespace. " ".join(parts) joins strings with one space; joining does not automatically convert numbers to strings.', example: 'raw = "  Web   Search\\n"\nparts = raw.strip().lower().split()\nprint(" ".join(parts))' },
      { term: 'Counting and grouping', explanation: 'Counting stores a number for each key. Grouping stores a collection for each key. Updating a dictionary during one pass avoids repeatedly searching the full input.', example: 'counts = {}\ngroups = {}\nfor tool in ["search", "lookup", "search"]:\n    counts[tool] = counts.get(tool, 0) + 1\n    groups.setdefault(tool[0], []).append(tool)\nprint(counts, groups)' },
      { term: 'Loops before comprehensions', explanation: 'First make the ordinary loop correct. A comprehension can then express a simple mapping or filter more compactly. Complex branching is often clearer in a loop.', example: 'names = [" Search ", " Lookup "]\nclean = []\nfor name in names:\n    clean.append(name.strip().lower())\ncompact = [name.strip().lower() for name in names]\nprint(clean == compact)' },
      { term: 'sorted with key and deterministic ties', explanation: 'sorted returns a new sorted list. Its key function computes a comparison value. A tuple key compares the first value, then the next when tied; (-count, name) gives descending counts and ascending names.', example: 'pairs = [("search", 2), ("lookup", 2), ("read", 1)]\nprint(sorted(pairs, key=lambda pair: (-pair[1], pair[0])))' },
      { term: 'Counter', explanation: 'collections.Counter is a standard-library counting dictionary. Its most_common method is useful, but the exercise has an explicit alphabetical tie rule, so sort the resulting pairs using that rule.', example: 'from collections import Counter\ncounts = Counter(["search", "lookup", "search"])\nprint(dict(counts))\nprint(sorted(counts.items(), key=lambda pair: (-pair[1], pair[0])))' },
      { term: 'Time and space complexity', explanation: 'One counting pass uses average constant-time dictionary updates. For n log rows and u unique tools, counting plus sorting costs O(n + u log u), ignoring string lengths; counting storage is O(u). Calling log.count(tool) for every unique tool repeats the scan and can approach O(n²).', example: '# One pass: counts[name] = counts.get(name, 0) + 1\n# Repeated full scans: [(name, log.count(name)) for name in set(log)]' },
    ],
    workedExample: '# Group words by length, then show the length groups in sorted order.\nwords = "red blue red green".split()\ngroups = {}\nfor word in words:\n    groups.setdefault(len(word), []).append(word)\nfor length in sorted(groups):\n    print(length, ", ".join(groups[length]))\n',
    problem: 'Implement top_tools(log, k=3). Each log item is a tool-name string; ignore nonstrings and names that become empty. Normalize case and whitespace with " ".join(name.strip().lower().split()). Return at most k (name, count) tuples ordered by descending count, then alphabetically by normalized name. Return [] for empty input or k <= 0. k is an integer. Do not modify log.',
    acceptance: ['Normalize and count all usable names once per row.', 'Return the top k counts with alphabetical ties; the default is three.', 'Handle empty input, ignored rows, and nonpositive k without mutating the log.'],
    guidedStarter: 'def top_tools(log, k=3):\n    counts = {}\n    # Normalize each usable row and update counts.\n    ???\n    # Sort (name, count) pairs by count descending, then name ascending.\n    ???\n\nprint(top_tools([" Search ", "lookup", "SEARCH", "web   search"]))\n',
    independentStarter: 'def top_tools(log, k=3):\n    """Return normalized tool counts in descending-count, alphabetical-tie order."""\n    pass\n',
    hints: ['Build a counts dictionary in one ordinary loop before choosing a comprehension or Counter.', 'Use sorted(counts.items(), key=lambda pair: (-pair[1], pair[0])) and apply the nonnegative k bound.'],
    reviewPrompts: ['State the tie rule before tracing an example with equal counts.', 'Explain the time and extra-space costs in terms of rows and unique tools; include text length if relevant.', 'How does counting differ from grouping, and when would a comprehension reduce readability?'],
    resources: [tutorial],
    checks: [
      { id: 'tools-count', label: 'Normalize and count tool names' },
      { id: 'tools-order', label: 'Apply top-k limits and alphabetical tie ordering' },
      { id: 'tools-boundaries', label: 'Handle empty or ignored input without mutation' },
    ],
  },
  {
    id: 'refresher-07', day: 7, kind: 'practice', support: 'minimal', minutes: 75,
    title: 'Errors, debugging and tests',
    recall: 'Reconstruct a sort key that orders count descending and name ascending. Explain one boundary case your previous solution did not cover at first.',
    concepts: [
      { term: 'Reading a traceback', explanation: 'Read the exception type and final message, then locate the last frame in your own code. Trace the values reaching that line. Fix the cause rather than hiding every error with a broad except.', example: '# Broken: int("0.5")\n# ValueError: invalid literal for int() with base 10: \'0.5\'\n# The input is decimal text, so this conversion matches it:\nprint(float("0.5"))' },
      { term: 'try, specific except, and finally', explanation: 'try encloses an operation that may fail. except ValueError handles that expected failure while unrelated errors remain visible. finally runs for cleanup whether the operation succeeds, returns, or raises.', example: 'raw = "bad number"\ntry:\n    number = float(raw)\nexcept ValueError as error:\n    print("Invalid numeric text:", error)\nfinally:\n    print("Parsing attempt finished")' },
      { term: 'raise and input contracts', explanation: 'raise ValueError(...) signals that an input violates your function’s contract. Do not use assert for production validation: Python can disable assertions with optimization. Keep validation checks separate from test assertions.', example: 'def positive_count(value):\n    if type(value) is not int or value < 1:\n        raise ValueError("Count must be a positive integer")\n    return value' },
      { term: 'Assertions and tests that can fail', explanation: 'assert checks an expected result and raises AssertionError if it is false. Check exact values, not just truthiness. A useful test passes for correct code and fails when a relevant bug is introduced.', example: 'def add(a, b):\n    return a + b\n\ndef test_add():\n    assert add(2, 3) == 5\n\ntest_add()' },
      { term: 'pytest tests and parametrization', explanation: 'In an environment with pytest installed, test_ functions are discovered automatically. @pytest.mark.parametrize runs the same test against multiple rows. The browser exercise calls plain test functions directly; it does not claim to run pytest.', example: '# Local pytest example; pytest is not installed in this browser.\n# import pytest\n# @pytest.mark.parametrize("raw, expected", [("0.5", 0.5), ("2", 2.0)])\n# def test_duration(raw, expected):\n#     assert float(raw) == expected' },
      { term: 'Exception checks and debugging a broken implementation', explanation: 'pytest.raises(ValueError) asserts a specific exception in a local pytest suite. Here use try/except ValueError plus an else that raises AssertionError when no exception occurs. Replacing a validator with one that accepts everything must make the negative test fail.', example: '# Local pytest: with pytest.raises(ValueError): float("bad")\ntry:\n    float("bad")\nexcept ValueError:\n    pass\nelse:\n    raise AssertionError("Expected invalid numeric text to fail")' },
    ],
    workedExample: '# Diagnose a different validator that used truthiness for a number.\ndef broken_count(value):\n    if not value:\n        raise ValueError("Missing")\n    return value\n\n# Why is zero rejected, while the string "many" is accepted?\ndef repaired_count(value):\n    if type(value) is not int or value < 0:\n        raise ValueError("Expected a nonnegative integer")\n    return value\n\nassert repaired_count(0) == 0\nprint("The zero boundary now works")\n',
    problem: 'In guided practice, run the deliberately broken validator, diagnose the failing traceback and repair it while keeping the meaningful tests. Then rebuild validate_record(record), test_valid_records(), and test_invalid_records() independently. A valid record is a dictionary with a nonempty string id, a nonnegative int/float duration (not bool), and an actual bool success. Return a new dictionary containing only the trimmed id, duration converted to float, and success. Raise ValueError for malformed or empty input. Inputs do not contain NaN or infinity. Tests must call the validator, check exact valid results, and assert that empty and malformed records raise ValueError.',
    acceptance: ['Return normalized values for normal records, zero duration, and False success without modifying the input.', 'Reject empty, missing, negative, and wrongly typed fields with ValueError.', 'Both test functions must pass for correct behavior and detect deliberately broken behavior.'],
    guidedStarter: '# This implementation is deliberately broken, but the file is valid Python.\n# Run it first. Read the last traceback line, locate the failed assertion,\n# inspect the actual value, and repair one cause before rerunning the tests.\ndef validate_record(record):\n    if not record.get("id") or not record.get("duration"):\n        raise ValueError("Missing value")\n    return {"id": record["id"], "duration": record["duration"], "success": bool(record.get("success"))}\n\ndef test_valid_records():\n    assert validate_record({"id": " r1 ", "duration": 0.5, "success": True}) == {"id": "r1", "duration": 0.5, "success": True}\n    assert validate_record({"id": "r2", "duration": 0, "success": False}) == {"id": "r2", "duration": 0.0, "success": False}\n\ndef test_invalid_records():\n    for record in ({}, None, {"id": "r1", "duration": -1, "success": True}, {"id": "r1", "duration": 1, "success": "yes"}):\n        try:\n            validate_record(record)\n        except ValueError:\n            pass\n        else:\n            raise AssertionError("Invalid record was accepted")\n\ntest_valid_records()\ntest_invalid_records()\nprint("Record tests passed")\n',
    independentStarter: 'def validate_record(record):\n    """Normalize a valid record; raise ValueError for empty or malformed input."""\n    pass\n\ndef test_valid_records():\n    """Assert exact results for ordinary and boundary-valid records."""\n    pass\n\ndef test_invalid_records():\n    """Assert ValueError for empty and malformed records."""\n    pass\n',
    hints: ['Use type(duration) in (int, float) to exclude bool, and isinstance(success, bool) for the success field.', 'For the valid test, compare the complete returned dictionary. For invalid tests, the no-exception else branch must fail.', 'When debugging, read the last error line, find your source line, inspect its input, then rerun the smallest failing example.'],
    reviewPrompts: ['Read a real traceback from your attempt aloud: type, message, source line, and cause.', 'Why are assertions suitable for tests but unsuitable as the only validation of untrusted input?', 'Which deliberate bug does each test catch, and how would you express the cases with pytest.mark.parametrize and pytest.raises?'],
    resources: [tutorial, { label: 'pytest getting started', url: 'https://docs.pytest.org/en/stable/getting-started.html' }],
    checks: [
      { id: 'record-contract', label: 'Validate normal, empty, and malformed records' },
      { id: 'record-valid-tests', label: 'Write valid-case tests that catch wrong returned values' },
      { id: 'record-invalid-tests', label: 'Write negative tests that reject permissive validation' },
    ],
  },
]

const CONSOLIDATION_TARGETS: Record<string, {
  functionName: string
  starter?: string
  problem?: string
  checks?: CheckDefinition[]
}> = {
  'refresher-01': { functionName: 'format_tool' },
  'refresher-02': { functionName: 'count_runs' },
  'refresher-03': { functionName: 'unique_ids' },
  'refresher-04': { functionName: 'latest_by_id' },
  'refresher-05': {
    functionName: 'normalize_record',
    starter: 'def normalize_record(record: dict, prefix="tool-") -> dict:\n    """Return a normalized outer copy while keeping extra fields."""\n    pass\n',
    problem: 'Implement normalize_record(record, prefix="tool-"). Inputs have string id and name. Return a fresh outer dictionary with id = prefix + stripped id and name = stripped lowercase name; retain every other field. Support default, positional and keyword prefixes, including an empty prefix. Do not modify the input. Nested values may remain shared: the contract requires an outer copy only.',
    checks: [
      { id: 'normalize-fields', label: 'Normalize id and name while retaining extra fields' },
      { id: 'normalize-prefix', label: 'Honor default, positional and keyword prefixes' },
      { id: 'normalize-copy', label: 'Return a fresh outer copy without changing input' },
    ],
  },
  'refresher-06': { functionName: 'top_tools' },
  'refresher-07': {
    functionName: 'validate_record',
    starter: 'def validate_record(record):\n    """Normalize a valid record; raise ValueError for empty or malformed input."""\n    pass\n',
    problem: 'Implement validate_record(record). Require a dictionary with nonblank string id, nonnegative int/float duration excluding bool, and an actual bool success. Return a fresh dictionary containing only stripped id, duration converted to float, and success. Ignore extra fields without mutating input. Malformed or empty input raises ValueError. Inputs contain no NaN or infinity. No additional test functions are required for this consolidation target.',
    checks: [
      { id: 'validate-values', label: 'Normalize ordinary and boundary-valid records' },
      { id: 'validate-errors', label: 'Reject empty, missing and wrongly typed fields' },
      { id: 'validate-copy', label: 'Return only contract fields in a fresh dictionary' },
    ],
  },
}

export const FOUNDATION_DAYS: PracticeDay[] = FOUNDATION_CONTENT.map((day) => {
  const target = CONSOLIDATION_TARGETS[day.id]
  if (!target) throw new Error(`Missing consolidation target for ${day.id}`)
  return {
    ...day,
    consolidation: {
      functionName: target.functionName,
      starter: target.starter ?? day.independentStarter,
      problem: target.problem ?? day.problem,
      checks: (target.checks ?? day.checks).map((check) => ({ ...check, label: `${target.functionName}: ${check.label}` })),
    },
  }
})
