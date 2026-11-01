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
  'while-loops': ['5', 'n + 1'],
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
    for n in nums:
        need = target - n
        if need in seen:
            return [need, n]
        seen.add(n)
    return []`],
  'algo-validate-subsequence': [`i = 0
    for value in array:
        if i < len(sequence) and value == sequence[i]:
            i += 1
    return i == len(sequence)`],
  'algo-three-sum': [`nums = sorted(nums)
    triplets = []
    for i in range(len(nums) - 2):
        left, right = i + 1, len(nums) - 1
        while left < right:
            total = nums[i] + nums[left] + nums[right]
            if total == target:
                triplets.append([nums[i], nums[left], nums[right]])
                left += 1
                right -= 1
            elif total < target:
                left += 1
            else:
                right -= 1
    return triplets`],
  'algo-product-except-self': [`products = [1] * len(nums)
    left = 1
    for i in range(len(nums)):
        products[i] = left
        left *= nums[i]
    right = 1
    for i in reversed(range(len(nums))):
        products[i] *= right
        right *= nums[i]
    return products`],
  'algo-kadane': [`best = current = nums[0]
    for n in nums[1:]:
        current = max(n, current + n)
        best = max(best, current)
    return best`],
  'algo-palindrome': [`left, right = 0, len(text) - 1
    while left < right:
        if text[left] != text[right]:
            return False
        left += 1
        right -= 1
    return True`],
  'algo-longest-palindrome': [`best = ""
    for center in range(len(s)):
        for left, right in [(center, center), (center, center + 1)]:
            while left >= 0 and right < len(s) and s[left] == s[right]:
                left -= 1
                right += 1
            candidate = s[left + 1:right]
            if len(candidate) > len(best):
                best = candidate
    return best`],
  'algo-run-length': [`parts = []
    count = 1
    for i in range(1, len(text) + 1):
        if i < len(text) and text[i] == text[i - 1] and count < 9:
            count += 1
        else:
            parts.append(f"{count}{text[i - 1]}")
            count = 1
    return "".join(parts)`],
  'algo-binary-search': [`low, high = 0, len(nums) - 1
    while low <= high:
        mid = (low + high) // 2
        if nums[mid] == target:
            return mid
        if nums[mid] < target:
            low = mid + 1
        else:
            high = mid - 1
    return -1`],
  'algo-three-number-sort': [`first, second, _ = order
    low, mid, high = 0, 0, len(array) - 1
    while mid <= high:
        value = array[mid]
        if value == first:
            array[low], array[mid] = array[mid], array[low]
            low += 1
            mid += 1
        elif value == second:
            mid += 1
        else:
            array[mid], array[high] = array[high], array[mid]
            high -= 1
    return array`],
  'algo-merge-sort': [`if len(nums) <= 1:
        return nums
    middle = len(nums) // 2
    left = merge_sort(nums[:middle])
    right = merge_sort(nums[middle:])
    merged, i, j = [], 0, 0
    while i < len(left) and j < len(right):
        if left[i] <= right[j]:
            merged.append(left[i])
            i += 1
        else:
            merged.append(right[j])
            j += 1
    return merged + left[i:] + right[j:]`],
  'algo-validate-bst': [`if node is None:
        return True
    if not (low <= node.value < high):
        return False
    return is_bst(node.left, low, node.value) and is_bst(node.right, node.value, high)`],
  'algo-invert-tree': [`if node is None:
        return None
    node.left, node.right = node.right, node.left
    invert(node.left)
    invert(node.right)
    return node`],
  'algo-tree-diameter': [`best = 0

    def height(node):
        nonlocal best
        if node is None:
            return 0
        left, right = height(node.left), height(node.right)
        best = max(best, left + right)
        return 1 + max(left, right)

    height(root)
    return best`],
  'algo-river-sizes': [`rows, cols = len(grid), len(grid[0])
    seen = set()
    sizes = []
    for r in range(rows):
        for c in range(cols):
            if grid[r][c] != 1 or (r, c) in seen:
                continue
            size, stack = 0, [(r, c)]
            seen.add((r, c))
            while stack:
                cr, cc = stack.pop()
                size += 1
                for nr, nc in [(cr + 1, cc), (cr - 1, cc), (cr, cc + 1), (cr, cc - 1)]:
                    if 0 <= nr < rows and 0 <= nc < cols and grid[nr][nc] == 1 and (nr, nc) not in seen:
                        seen.add((nr, nc))
                        stack.append((nr, nc))
            sizes.append(size)
    return sorted(sizes)`],
  'algo-cycle-in-graph': [`WHITE, GREY, BLACK = 0, 1, 2
    color = [WHITE] * len(edges)

    def visit(node):
        color[node] = GREY
        for nxt in edges[node]:
            if color[nxt] == GREY:
                return True
            if color[nxt] == WHITE and visit(nxt):
                return True
        color[node] = BLACK
        return False

    return any(color[n] == WHITE and visit(n) for n in range(len(edges)))`],
  'algo-dijkstra': [`dist = [float("inf")] * len(edges)
    dist[start] = 0
    heap = [(0, start)]
    while heap:
        d, node = heapq.heappop(heap)
        if d > dist[node]:
            continue
        for nxt, weight in edges[node]:
            candidate = d + weight
            if candidate < dist[nxt]:
                dist[nxt] = candidate
                heapq.heappush(heap, (candidate, nxt))
    return [x if x != float("inf") else -1 for x in dist]`],
  'algo-staircase': [`ways_to = [1] + [0] * height
    for step in range(1, height + 1):
        for jump in range(1, max_steps + 1):
            if step - jump >= 0:
                ways_to[step] += ways_to[step - jump]
    return ways_to[height]`],
  'algo-house-robber': [`take, skip = 0, 0
    for value in values:
        take, skip = skip + value, max(take, skip)
    return max(take, skip)`],
  'algo-ways-to-change': [`ways = [1] + [0] * amount
    for coin in coins:
        for total in range(coin, amount + 1):
            ways[total] += ways[total - coin]
    return ways[amount]`],
  'algo-levenshtein': [`prev = list(range(len(b) + 1))
    for i in range(1, len(a) + 1):
        current = [i] + [0] * len(b)
        for j in range(1, len(b) + 1):
            if a[i - 1] == b[j - 1]:
                current[j] = prev[j - 1]
            else:
                current[j] = 1 + min(prev[j], current[j - 1], prev[j - 1])
        prev = current
    return prev[-1]`],
  'algo-knapsack': [`best = [0] * (capacity + 1)
    for value, weight in items:
        for room in range(capacity, weight - 1, -1):
            best[room] = max(best[room], best[room - weight] + value)
    return best[capacity]`],
  'algo-remove-kth-from-end': [`dummy = ListNode(None, head)
    fast = slow = dummy
    for _ in range(k):
        fast = fast.next
    while fast.next:
        fast, slow = fast.next, slow.next
    slow.next = slow.next.next
    return dummy.next`],
  'algo-reverse-polish': [`stack = []
    for token in tokens:
        if token in ("+", "-", "*", "/"):
            right = stack.pop()
            left = stack.pop()
            if token == "+":
                stack.append(left + right)
            elif token == "-":
                stack.append(left - right)
            elif token == "*":
                stack.append(left * right)
            else:
                stack.append(int(left / right))
        else:
            stack.append(int(token))
    return stack[0]`],
  'algo-permutations': [`result = []

    def build(path, remaining):
        if not remaining:
            result.append(path)
            return
        for i, item in enumerate(remaining):
            build(path + [item], remaining[:i] + remaining[i + 1:])

    build([], items)
    return result`],
  'api-fastapi-path-query': ['int', '2'],
  'api-fastapi-body-model': ['False', 'Signup'],
  'api-fastapi-http-errors': ['404', 'HTTPException'],
  'api-fastapi-crud': ['todo', 'del TODOS[todo_id]'],
  'api-fastapi-api-key': ['Header(None)', '403'],
  'api-fastapi-pagination': ['offset:offset + limit', 'len(ITEMS)'],
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
