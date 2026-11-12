import { FASTAPI_BUILD_ANSWERS } from './fastapiBuildAnswers'

/**
 * One working fill for each ??? in a lesson starter, in order. The hint bubble offers it as the last step;
 * other correct answers still pass the goal checks. Python tests run every entry against its starter.
 */
export const BLANK_ANSWERS: Readonly<Record<string, readonly string[]>> = {
  printing: ['"Hi from me!"'],
  'comments-indentation': ['Warn when it is hot'],
  variables: ['"Ada"'],
  types: ['30', '9.99', '"book"', 'True', '"42"'],
  expressions: ['10 - 3'],
  operators: ['//', '+='],
  strings: ['"Ada"'],
  'string-methods': ['strip', '"Python"'],
  booleans: ['score < 0'],
  conditionals: ['75'],
  'elif-and-or': ['or', 'age >= 6 and age < 18'],
  lists: ['80', '95', '70', '88'],
  'for-loops': ['1, 6'],
  'while-loops': ['3', 'n + 1'],
  dicts: ['"Ada"', '1815', '"city", "unknown"'],
  functions: ['n * n', '4'],
  'function-parameters': ['uppercase=True', 'min(numbers), max(numbers)'],
  'variable-scope': ['current + amount', 'add'],
  'common-errors': ['0', '-1', 'str(age)'],
  capstone: ['score >= passing'],
  'classes-basics': ['balance', '-='],
  inheritance: ['super()', 'Notifier'],
  'files-pathlib': ['read_text', 'int'],
  'modules-imports': ['helpers', 'sqrt'],
  'missing-data-none': ['"label"', 'None', '1'],
  'nested-records': ['"confidence"', '0.8', 'skipped'],
  'text-normalization': ['text.strip().lower()', 'cleaned.split()', '" ".join(tokens)'],
  'assertions-as-tests': ['0.0', '1.0', '1.0', 'actual == expected'],
  'feedback-classifier-capstone': ['" ".join(text.lower().split())', '"positive"', '"negative"', '1', 'expected'],
  'mid-enumerate-zip': ['1', 'names', 'years'],
  'mid-nested-loops': ['5', '5', 'row * col'],
  'mid-list-methods': ['n * 10', '30'],
  'mid-comprehensions': ['range(10)', 'n % 2 == 0'],
  'mid-dict-loops': ['score', 'score + 5'],
  'mid-sets': ['"python", "docker"'],
  'mid-tuples': ['point', 'b, a'],
  'mid-fn-defaults': ['"Hello"'],
  'mid-sorting': ['lambda person: person["year"]'],
  'mid-try-except': ['ValueError'],
  'mid-classes': ['start', 'self.value + step'],
  'mid-stdlib': ['math', 'random', '16'],
  'mid-json': ['data', 'text'],
  'mid-capstone': ['lambda r: r["score"]', 'limit'],
  'mid-counter-defaultdict': ['words'],
  'mid-generators': ['n * n'],
  'mid-heapq': ['tasks'],
  'mid-dataclasses': ['True'],
  'mid-decorators-cache': ['n - 2'],
  'mid-context-managers': ['self'],
  'mid-stack-brackets': ['stack.pop()', '0'],
  'mid-monotonic-stack': ['<', 'today - day'],
  'mid-merge-intervals': ['lambda pair: pair[0]', 'max(merged[-1][1], end)'],
  'mid-group-anagrams': ['"".join(sorted(word))', 'word'],
  'mid-heap-top-k': ['Counter(words)', 'lambda item: item[1]'],
  'mid-bfs-grid': ['queue.popleft()', 'seen.add((nr, nc))'],
  'mid-topological-sort': ['indegree[course] == 0', 'indegree[nxt] -= 1'],
  'mid-backtracking-subsets': ['path[:]', 'path.pop()'],
  'mid-dp-coin-change': ['best[a - coin] + 1', '-1'],
  'mid-linked-list-reverse': ['current.next', 'prev'],
  'mid-union-find': ['find(parent[x])', 'parent[root_a] = root_b'],
  'mid-trie-prefix': ['{}', 'False'],
  'algo-two-sum': [`seen = set()

    for number in nums:
        needed = target - number
        if needed in seen:
            return [needed, number]

        seen.add(number)

    return []`],
  'algo-validate-subsequence': [`matched_count = 0

    for value in array:
        if matched_count < len(sequence) and value == sequence[matched_count]:
            matched_count += 1

    return matched_count == len(sequence)`],
  'algo-three-sum': [`results = []

    for i in range(len(nums)):
        first_number = nums[i]
        seen = set()

        for second_number in nums[i + 1:]:
            needed = target - first_number - second_number

            if needed in seen:
                triplet = sorted([first_number, needed, second_number])
                if triplet not in results:
                    results.append(triplet)

            seen.add(second_number)

    return sorted(results)`],
  'algo-product-except-self': [`products = [1] * len(nums)

    left_product = 1
    for index in range(len(nums)):
        products[index] = left_product
        left_product *= nums[index]

    right_product = 1
    for index in range(len(nums) - 1, -1, -1):
        products[index] *= right_product
        right_product *= nums[index]

    return products`],
  'algo-kadane': [`best_sum = nums[0]
    current_sum = nums[0]

    for number in nums[1:]:
        current_sum = max(number, current_sum + number)
        best_sum = max(best_sum, current_sum)

    return best_sum`],
  'algo-palindrome': [`left_index = 0
    right_index = len(text) - 1

    while left_index < right_index:
        if text[left_index] != text[right_index]:
            return False

        left_index += 1
        right_index -= 1

    return True`],
  'algo-longest-palindrome': [`longest = ""

    def expand_around(left_index, right_index):
        while left_index >= 0 and right_index < len(s) and s[left_index] == s[right_index]:
            left_index -= 1
            right_index += 1
        return s[left_index + 1:right_index]

    for center in range(len(s)):
        odd_palindrome = expand_around(center, center)
        even_palindrome = expand_around(center, center + 1)

        if len(odd_palindrome) > len(longest):
            longest = odd_palindrome
        if len(even_palindrome) > len(longest):
            longest = even_palindrome

    return longest`],
  'algo-run-length': [`encoded = ""
    run_char = text[0]
    run_length = 0

    for char in text:
        if char == run_char and run_length < 9:
            run_length += 1
        else:
            encoded += f"{run_length}{run_char}"
            run_char = char
            run_length = 1

    encoded += f"{run_length}{run_char}"
    return encoded`],
  'algo-binary-search': [`low_index = 0
    high_index = len(nums) - 1

    while low_index <= high_index:
        middle_index = (low_index + high_index) // 2
        middle_value = nums[middle_index]

        if middle_value == target:
            return middle_index
        if middle_value < target:
            low_index = middle_index + 1
        else:
            high_index = middle_index - 1

    return -1`],
  'algo-three-number-sort': [`first_value = order[0]
    second_value = order[1]

    low = 0
    mid = 0
    high = len(array) - 1

    while mid <= high:
        value = array[mid]

        if value == first_value:
            array[low], array[mid] = array[mid], array[low]
            low += 1
            mid += 1
        elif value == second_value:
            mid += 1
        else:
            array[mid], array[high] = array[high], array[mid]
            high -= 1

    return array`],
  'algo-merge-sort': [`if len(nums) <= 1:
        return nums

    middle = len(nums) // 2
    left_half = merge_sort(nums[:middle])
    right_half = merge_sort(nums[middle:])

    merged = []
    left_index = 0
    right_index = 0

    while left_index < len(left_half) and right_index < len(right_half):
        if left_half[left_index] <= right_half[right_index]:
            merged.append(left_half[left_index])
            left_index += 1
        else:
            merged.append(right_half[right_index])
            right_index += 1

    merged.extend(left_half[left_index:])
    merged.extend(right_half[right_index:])
    return merged`],
  'algo-validate-bst': [`if node is None:
        return True

    if node.value < low or node.value >= high:
        return False

    left_is_valid = is_bst(node.left, low, node.value)
    right_is_valid = is_bst(node.right, node.value, high)
    return left_is_valid and right_is_valid`],
  'algo-invert-tree': [`if node is None:
        return None

    original_left = node.left
    node.left = node.right
    node.right = original_left

    invert(node.left)
    invert(node.right)
    return node`],
  'algo-tree-diameter': [`def height_and_diameter(node):
        if node is None:
            return 0, 0

        left_height, left_diameter = height_and_diameter(node.left)
        right_height, right_diameter = height_and_diameter(node.right)

        path_through_node = left_height + right_height
        height = 1 + max(left_height, right_height)
        diameter = max(path_through_node, left_diameter, right_diameter)
        return height, diameter

    _, diameter = height_and_diameter(root)
    return diameter`],
  'algo-river-sizes': [`row_count = len(grid)
    column_count = len(grid[0])
    visited = set()
    sizes = []

    for row in range(row_count):
        for column in range(column_count):
            if grid[row][column] != 1 or (row, column) in visited:
                continue

            river_size = 0
            stack = [(row, column)]
            visited.add((row, column))

            while stack:
                current_row, current_column = stack.pop()
                river_size += 1

                neighbors = [
                    (current_row + 1, current_column),
                    (current_row - 1, current_column),
                    (current_row, current_column + 1),
                    (current_row, current_column - 1),
                ]
                for next_row, next_column in neighbors:
                    inside_grid = 0 <= next_row < row_count and 0 <= next_column < column_count
                    if inside_grid and grid[next_row][next_column] == 1 and (next_row, next_column) not in visited:
                        visited.add((next_row, next_column))
                        stack.append((next_row, next_column))

            sizes.append(river_size)

    return sorted(sizes)`],
  'algo-cycle-in-graph': [`WHITE = 0  # not visited yet
    GREY = 1   # on the current path
    BLACK = 2  # fully explored
    color = [WHITE] * len(edges)

    def visit(node):
        color[node] = GREY

        for neighbor in edges[node]:
            if color[neighbor] == GREY:
                return True
            if color[neighbor] == WHITE and visit(neighbor):
                return True

        color[node] = BLACK
        return False

    for node in range(len(edges)):
        if color[node] == WHITE and visit(node):
            return True

    return False`],
  'algo-dijkstra': [`distances = [float("inf")] * len(edges)
    distances[start] = 0
    heap = [(0, start)]

    while heap:
        distance, node = heapq.heappop(heap)
        if distance > distances[node]:
            continue

        for neighbor, weight in edges[node]:
            new_distance = distance + weight
            if new_distance < distances[neighbor]:
                distances[neighbor] = new_distance
                heapq.heappush(heap, (new_distance, neighbor))

    result = []
    for distance in distances:
        if distance == float("inf"):
            result.append(-1)
        else:
            result.append(distance)

    return result`],
  'algo-staircase': [`ways_to_reach = [0] * (height + 1)
    ways_to_reach[0] = 1

    for step in range(1, height + 1):
        for jump in range(1, max_steps + 1):
            if step - jump >= 0:
                ways_to_reach[step] += ways_to_reach[step - jump]

    return ways_to_reach[height]`],
  'algo-house-robber': [`best_before_previous = 0
    best_so_far = 0

    for value in values:
        best_with_value = best_before_previous + value
        best_before_previous = best_so_far
        best_so_far = max(best_so_far, best_with_value)

    return best_so_far`],
  'algo-ways-to-change': [`ways_for_amount = [0] * (amount + 1)
    ways_for_amount[0] = 1

    for coin in coins:
        for total in range(coin, amount + 1):
            ways_for_amount[total] += ways_for_amount[total - coin]

    return ways_for_amount[amount]`],
  'algo-levenshtein': [`previous_row = list(range(len(b) + 1))

    for i in range(1, len(a) + 1):
        current_row = [i] + [0] * len(b)

        for j in range(1, len(b) + 1):
            if a[i - 1] == b[j - 1]:
                current_row[j] = previous_row[j - 1]
            else:
                insert_cost = current_row[j - 1]
                delete_cost = previous_row[j]
                replace_cost = previous_row[j - 1]
                current_row[j] = 1 + min(insert_cost, delete_cost, replace_cost)

        previous_row = current_row

    return previous_row[-1]`],
  'algo-knapsack': [`best_value = [0] * (capacity + 1)

    for value, weight in items:
        for room in range(capacity, weight - 1, -1):
            value_if_taken = best_value[room - weight] + value
            best_value[room] = max(best_value[room], value_if_taken)

    return best_value[capacity]`],
  'algo-remove-kth-from-end': [`dummy = ListNode(None, head)
    fast = dummy
    slow = dummy

    for _ in range(k):
        fast = fast.next

    while fast.next is not None:
        fast = fast.next
        slow = slow.next

    slow.next = slow.next.next
    return dummy.next`],
  'algo-reverse-polish': [`stack = []

    for token in tokens:
        if token not in ("+", "-", "*", "/"):
            stack.append(int(token))
            continue

        right_operand = stack.pop()
        left_operand = stack.pop()

        if token == "+":
            stack.append(left_operand + right_operand)
        elif token == "-":
            stack.append(left_operand - right_operand)
        elif token == "*":
            stack.append(left_operand * right_operand)
        else:
            stack.append(int(left_operand / right_operand))

    return stack[0]`],
  'algo-permutations': [`all_orderings = []

    def build(current_ordering, remaining_items):
        if not remaining_items:
            all_orderings.append(current_ordering)
            return

        for index in range(len(remaining_items)):
            chosen_item = remaining_items[index]
            items_left = remaining_items[:index] + remaining_items[index + 1:]
            build(current_ordering + [chosen_item], items_left)

    build([], items)
    return all_orderings`],
  'fastapi-health': ['"/health"', '"ok"'],
  'fastapi-hello-path': ['{name}', 'name: str'],
  'fastapi-ask-query': ['str', 'q.lower()'],
  'fastapi-ask-body': ['Question', 'post'],
  'fastapi-not-found': ['HTTPException', 'HTTPException'],
  'fastapi-async-route': ['async', 'await'],
  ...FASTAPI_BUILD_ANSWERS,
  'api-support-knowledge-base': ['line[3:]', 'line.strip() + " "'],
  'api-fullstack-seed-table': ['"orders"', 'products'],
  'api-fullstack-select-where': ['city', 'temp_c DESC'],
  'api-fullstack-group-by-chart': ['city', '40'],
  'api-fullstack-route': ['404', '[dict(row) for row in rows]'],
  'api-fullstack-query-filters': ['city', 'limit'],
  'api-fullstack-post-row': ['201', 'ticket.minutes'],
  'api-fullstack-sandbox': ['TABLES'],
  'harness-tool-registry': [`fn = TOOLS.get(name)
    if fn is None:
        return {"error": f"unknown tool: {name}"}
    try:
        return {"result": fn(**args)}
    except Exception as exc:
        return {"error": f"{type(exc).__name__}: {exc}"}`],
  'harness-validate-args': [`params = inspect.signature(fn).parameters
    problems = [f"unexpected argument: {name}" for name in args if name not in params]
    for name, param in params.items():
        if name not in args:
            if param.default is inspect.Parameter.empty:
                problems.append(f"missing argument: {name}")
        elif param.annotation is not inspect.Parameter.empty and not isinstance(args[name], param.annotation):
            problems.append(f"{name} must be {param.annotation.__name__}")
    return problems`],
  'harness-agent-loop': [`messages = [{"role": "user", "content": question}]
    used = []
    while True:
        reply = model.complete(messages)
        if "answer" in reply:
            return {"answer": reply["answer"], "tools": used}
        messages.append({"role": "assistant", "tool": reply["tool"], "args": reply["args"]})
        messages.append({"role": "tool", "name": reply["tool"], "content": call_tool(reply["tool"], reply["args"])})
        used.append(reply["tool"])`],
  'harness-step-limit': [`messages = [{"role": "user", "content": question}]
    for step in range(1, max_steps + 1):
        reply = model.complete(messages)
        if "answer" in reply:
            return {"status": "answered", "answer": reply["answer"], "steps": step}
        if "tool" not in reply:
            return {"status": "invalid_reply", "steps": step}
        args = reply.get("args", {})
        messages.append({"role": "assistant", "tool": reply["tool"], "args": args})
        messages.append({"role": "tool", "name": reply["tool"], "content": call_tool(reply["tool"], args)})
    return {"status": "step_limit", "steps": max_steps}`],
  'harness-async-timeout': [`fn = TOOLS.get(name)
    if fn is None:
        return {"error": f"unknown tool: {name}"}
    try:
        return {"result": await asyncio.wait_for(fn(**args), timeout)}
    except asyncio.TimeoutError:
        return {"error": f"timeout after {timeout}s"}`],
  'harness-approval-gate': [`if call["tool"] in WRITE_TOOLS and not approver(call):
        return {"status": "rejected", "reason": "approval denied"}
    return {"status": "done", "result": TOOLS[call["tool"]](**call["args"])}`],
  'harness-idempotency': [`if key in DONE:
        return {**DONE[key], "replayed": True}
    result = {"result": TOOLS[call["tool"]](**call["args"]), "replayed": False}
    DONE[key] = result
    return result`],
  'harness-retries': [`for attempt in range(1, attempts + 1):
        try:
            return fn()
        except TransientError:
            if attempt == attempts:
                raise
            sleep(base_delay * 2 ** (attempt - 1))`],
  'harness-prompt-injection': [`policy = TASK_POLICY[task]
    if call["tool"] not in policy["tools"]:
        return f"tool {call['tool']} is not allowed for {task}"
    account = call["args"].get("account")
    if account is not None and account not in policy["accounts"]:
        return f"account {account} is out of scope"
    return None`],
  'harness-trace': [`started = time.perf_counter()
    outcome = call_tool(name, args)
    entry = {"step": len(TRACE) + 1, "tool": name, "args": args, "ok": "error" not in outcome,
             "ms": round((time.perf_counter() - started) * 1000, 3)}
    if "error" in outcome:
        entry["error"] = outcome["error"]
    TRACE.append(entry)
    print(json.dumps(entry))
    return outcome`],
  'harness-eval-suite': [`run = run_agent(ScriptedModel(case["replies"]), case["question"])
    failures = []
    if case["expect_answer"] not in run["answer"]:
        failures.append(f"answer is missing {case['expect_answer']!r}")
    if run["tools"] != case["expect_tools"]:
        failures.append(f"tools {run['tools']} != {case['expect_tools']}")
    return failures`],
  'harness-mock-build': [`fn = TOOLS.get(name)
    if fn is None:
        return {"error": f"unknown tool: {name}"}
    if problems := validate(fn, args):
        return {"error": problems}
    try:
        return {"result": fn(**args)}
    except Exception as exc:
        return {"error": f"{type(exc).__name__}: {exc}"}`, `messages = [{"role": "user", "content": question}]
    used = []
    for _ in range(max_steps):
        reply = model.complete(messages)
        if "answer" in reply:
            return {"status": "answered", "answer": reply["answer"], "tools": used}
        if "tool" not in reply:
            return {"status": "invalid_reply", "tools": used}
        args = reply.get("args", {})
        messages.append({"role": "assistant", "tool": reply["tool"], "args": args})
        messages.append({"role": "tool", "name": reply["tool"], "content": call_tool(reply["tool"], args)})
        used.append(reply["tool"])
    return {"status": "step_limit", "tools": used}`],
  'harness-mock-harden': [`if reason := guard(call):
        outcome = {"status": "blocked", "reason": reason}
    elif call["tool"] in WRITE_TOOLS and not approve(call):
        outcome = {"status": "rejected", "reason": "approval denied"}
    elif key in DONE:
        outcome = {"status": "replayed", "result": DONE[key]}
    else:
        result = with_retries(lambda: TOOLS[call["tool"]](**call["args"]))
        DONE[key] = result
        outcome = {"status": "done", "result": result}
    TRACE.append({"key": key, "tool": call["tool"], **outcome})
    return outcome`],
  'api-support-guards': ['our_address', 'None'],
  'api-support-poller': ['not in', 'HANDLED'],
  'api-support-triage': ['True', 'words'],
  'api-support-code-decides': ['30', 'answered_from_kb'],
  'api-support-golden-evals': ['"air bed"', 'expected'],
}
