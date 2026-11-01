/**
 * Hint ladder for the algorithm lessons, whose function bodies start empty: the idea, the tool to reach for, a plan in
 * words, then the shape of the code. Each rung adds one thing, so the learner can stop as soon as it clicks; the
 * Solution pill shows the full answer.
 */
export type AlgorithmLadder = { idea: string; tool: string; plan: string; shape: string }

export const ALGORITHM_LADDER_KICKERS = ['The idea', 'What to use', 'Plan', 'Shape of the code'] as const

export const ALGORITHM_LAYERS: Readonly<Record<string, AlgorithmLadder>> = {
  'algo-two-sum': {
    idea: 'For every number n there is exactly one partner that completes the pair: target - n. You only need to know whether that partner already went by.',
    tool: 'A set. `x in seen` answers “have I seen it?” in O(1), so one pass is enough.',
    plan: 'Walk the numbers once. For each n, work out the partner; if it is in the set, return the pair. Otherwise add n to the set. If the loop ends, return [].',
    shape: '`seen = set()`, then `for n in nums:` with `need = target - n`, `if need in seen: return [need, n]` and `seen.add(n)`; after the loop `return []`.',
  },
  'algo-validate-subsequence': {
    idea: 'Keep a pointer to the next sequence item you still need. The array may skip items, but the sequence must appear in order.',
    tool: 'One integer index into sequence and a single for loop over array. No nested loops.',
    plan: 'Start the pointer at 0. For each array value, if it equals the item under the pointer, move the pointer on. At the end, check whether the pointer reached the end of sequence.',
    shape: '`i = 0`, `for value in array:` with `if i < len(sequence) and value == sequence[i]: i += 1`, then `return i == len(sequence)`.',
  },
  'algo-three-sum': {
    idea: 'Fix one number, then the other two are a two-sum on the rest. Sorting lets you search the rest from both ends.',
    tool: '`sorted()` plus two pointers, left and right, inside a for loop over i.',
    plan: 'Sort. For each i, put left just after i and right at the end. While left < right, add the three numbers: on a hit save the triplet and move both pointers; if the total is too small move left up, otherwise move right down.',
    shape: '`nums = sorted(nums)`, `for i in range(len(nums) - 2):`, `left, right = i + 1, len(nums) - 1`, a `while left < right:` with `if total == target / elif total < target / else`, and `return triplets`.',
  },
  'algo-product-except-self': {
    idea: 'The answer at i is (product of everything left of i) × (product of everything right of i). No division needed.',
    tool: 'A list of 1s and two running products: one filled walking left to right, one walking right to left.',
    plan: 'First pass: store the running left product at each index, then multiply it by nums[i]. Second pass from the end: multiply each slot by the running right product, then fold nums[i] into it.',
    shape: '`products = [1] * len(nums)`, a forward loop with `products[i] = left; left *= nums[i]`, a `for i in reversed(range(len(nums))):` loop with `products[i] *= right; right *= nums[i]`.',
  },
  'algo-kadane': {
    idea: 'Track the best sum of a run that ends exactly at the current number. Either extend the previous run or start fresh here.',
    tool: 'Two variables, current and best, and `max()`. One pass.',
    plan: 'Start both at the first number. For each next n, current becomes the larger of n alone and current + n; best becomes the larger of best and current.',
    shape: '`best = current = nums[0]`, `for n in nums[1:]:` with `current = max(n, current + n)` and `best = max(best, current)`, then `return best`.',
  },
  'algo-palindrome': {
    idea: 'A palindrome reads the same from both ends, so compare the outermost characters and walk inwards.',
    tool: 'Two indexes, left at 0 and right at the last position, and a while loop.',
    plan: 'While left < right: if the two characters differ, return False; otherwise move left up and right down. If the loop ends, return True.',
    shape: '`left, right = 0, len(text) - 1`, `while left < right:` with `if text[left] != text[right]: return False` and both pointers moving, then `return True`.',
  },
  'algo-longest-palindrome': {
    idea: 'Every palindrome grows out from a center. Try every center and expand while both ends match.',
    tool: 'Two nested loops: centers, then two kinds of center (one character for odd length, a gap between two for even). A while loop expands.',
    plan: 'For each center, start with (center, center) and (center, center + 1). Expand left down and right up while the characters match. The palindrome is between the last matching edges; keep the longest.',
    shape: '`best = ""`, `for center in range(len(s)):`, `for left, right in [(center, center), (center, center + 1)]:`, a `while … s[left] == s[right]:` loop, then `candidate = s[left + 1:right]`.',
  },
  'algo-run-length': {
    idea: 'Count how long each run of the same character is, and write the count before the character. Cut runs at 9 so every count is one digit.',
    tool: 'A list of parts joined with `"".join()` at the end, and a counter.',
    plan: 'Loop one past the end so the last run gets written. While the character repeats and the count is under 9, count up; otherwise write count + previous character and reset the count to 1.',
    shape: '`parts, count = [], 1`, `for i in range(1, len(text) + 1):` with an `if … text[i] == text[i - 1] and count < 9:` / `else: parts.append(f"{count}{text[i - 1]}")`, then `return "".join(parts)`.',
  },
  'algo-binary-search': {
    idea: 'In a sorted list the middle value tells you which half cannot contain the target, so throw that half away every step.',
    tool: 'Two bounds, low and high, a while loop, and integer division `//` for the middle.',
    plan: 'While low <= high, look at the middle. Found it: return its index. Middle too small: move low past it. Too big: move high below it. Bounds crossed: return -1.',
    shape: '`low, high = 0, len(nums) - 1`, `while low <= high:` with `mid = (low + high) // 2`, then `low = mid + 1` or `high = mid - 1`, and `return -1` after the loop.',
  },
  'algo-three-number-sort': {
    idea: 'Keep three zones: first values at the front, last values at the back, middle values in between. One scan sorts everything in place.',
    tool: 'Three indexes, low, mid and high, and tuple swaps like `a[x], a[y] = a[y], a[x]`.',
    plan: 'While mid <= high: a first value swaps to low and both move on; a second value stays and only mid moves; a last value swaps to high and high moves down (mid stays, the swapped-in value is unchecked).',
    shape: '`first, second, _ = order`, `low = mid = 0`, `high = len(array) - 1`, `while mid <= high:` with `if value == first / elif value == second / else`, then `return array`.',
  },
  'algo-merge-sort': {
    idea: 'Split the list in half, sort each half the same way, then merge two sorted lists by always taking the smaller front item.',
    tool: 'Recursion with a base case, slicing, and two indexes for the merge.',
    plan: 'A list of 0 or 1 items is already sorted. Otherwise sort both halves recursively. Merge while both have items, then append whatever is left of either half.',
    shape: '`if len(nums) <= 1: return nums`, `middle = len(nums) // 2`, `left = merge_sort(nums[:middle])`, `right = merge_sort(nums[middle:])`, a `while i < len(left) and j < len(right):` merge, then `return merged + left[i:] + right[j:]`.',
  },
  'algo-validate-bst': {
    idea: 'Every node must sit inside a range set by its ancestors, not just compare to its parent.',
    tool: 'Recursion that passes the allowed range down: `low` and `high` default to minus and plus infinity.',
    plan: 'An empty node is valid. A value outside [low, high) is invalid. Otherwise check the left child with the current value as the new upper bound and the right child with it as the new lower bound.',
    shape: '`if node is None: return True`, `if not (low <= node.value < high): return False`, then `return is_bst(node.left, low, node.value) and is_bst(node.right, node.value, high)`.',
  },
  'algo-invert-tree': {
    idea: 'Inverting is a mirror: at every node, the left and right children swap places.',
    tool: 'Recursion and one tuple assignment for the swap.',
    plan: 'An empty node stays empty. Swap the two children, invert both of them the same way, and return the node.',
    shape: '`if node is None: return None`, `node.left, node.right = node.right, node.left`, `invert(node.left)`, `invert(node.right)`, `return node`.',
  },
  'algo-tree-diameter': {
    idea: 'The longest path through a node is its left height plus its right height. The diameter is the largest of those over all nodes.',
    tool: 'An inner recursive height function and a `nonlocal best` it can update on the way.',
    plan: 'height(None) is 0. For a node, get both child heights, update best with left + right, and return 1 + the taller side. Call it on the root and return best.',
    shape: '`best = 0`, `def height(node):` with `nonlocal best`, a None check, `left, right = height(node.left), height(node.right)`, `best = max(best, left + right)`, `return 1 + max(left, right)`; then `height(root)` and `return best`.',
  },
  'algo-river-sizes': {
    idea: 'A river is a connected group of 1s. Start at any unvisited 1, explore everything it touches, and count the cells.',
    tool: 'A set of visited (row, col) pairs and a list used as a stack (depth-first search).',
    plan: 'Loop over every cell. Skip land and visited water. From a new water cell, pop cells off a stack, count each, and push unvisited water neighbours up, down, left and right. Save each count; return them sorted.',
    shape: '`seen, sizes = set(), []`, two loops over r and c, `stack = [(r, c)]` with `seen.add((r, c))`, `while stack:` that pops, counts and pushes neighbours, then `return sorted(sizes)`.',
  },
  'algo-cycle-in-graph': {
    idea: 'During a depth-first search, reaching a node that is still “in progress” on the current path means you went in a circle.',
    tool: 'Three colors per node: WHITE (not seen), GREY (on the current path) and BLACK (finished), plus a recursive visit.',
    plan: 'Color a node grey when you enter it. For each neighbour: grey means a cycle; white means visit it and pass a found cycle up. Color the node black when you leave. Try every white node as a start.',
    shape: '`WHITE, GREY, BLACK = 0, 1, 2`, `color = [WHITE] * len(edges)`, `def visit(node):` that sets GREY, loops over `edges[node]`, sets BLACK, returns False; then `return any(color[n] == WHITE and visit(n) for n in range(len(edges)))`.',
  },
  'algo-dijkstra': {
    idea: 'Always settle the closest unfinished node next; its distance can no longer improve. Then try to improve its neighbours through it.',
    tool: '`heapq` as a priority queue of (distance, node) pairs and a list of best distances, starting at infinity.',
    plan: 'Push (0, start). Pop the closest; skip it if a shorter distance was already found. For each edge, compute distance through this node; if it is shorter, store it and push it. Unreachable nodes become -1.',
    shape: '`dist = [float("inf")] * len(edges)`, `dist[start] = 0`, `heap = [(0, start)]`, `while heap:` with `heapq.heappop`, a stale check, `candidate = d + weight`, `heapq.heappush(heap, (candidate, nxt))`, then map inf to -1.',
  },
  'algo-staircase': {
    idea: 'The ways to reach a step are the sum of the ways to reach each step you could have jumped from.',
    tool: 'A list `ways_to` where index = step, starting with 1 way to stand at the bottom (dynamic programming).',
    plan: 'For every step from 1 to height, add up ways_to[step - jump] for every allowed jump that does not go below 0. Return the value at height.',
    shape: '`ways_to = [1] + [0] * height`, `for step in range(1, height + 1):`, `for jump in range(1, max_steps + 1):` with `if step - jump >= 0: ways_to[step] += ways_to[step - jump]`, then `return ways_to[height]`.',
  },
  'algo-house-robber': {
    idea: 'At each value you either take it (then the previous one must have been skipped) or skip it (keep the best so far).',
    tool: 'Two running totals, take and skip, updated together with one tuple assignment.',
    plan: 'Start both at 0. For each value: new take = old skip + value; new skip = the larger of old take and old skip. Return the larger of the two at the end.',
    shape: '`take, skip = 0, 0`, `for value in values:` with `take, skip = skip + value, max(take, skip)`, then `return max(take, skip)`.',
  },
  'algo-ways-to-change': {
    idea: 'Count ways per amount, adding one coin type at a time, so each combination is counted once regardless of order.',
    tool: 'A list `ways` where index = amount and ways[0] = 1 (one way to make 0: use nothing).',
    plan: 'For each coin, for every total from the coin’s value up to amount, add the ways to make total - coin. Return ways[amount].',
    shape: '`ways = [1] + [0] * amount`, `for coin in coins:`, `for total in range(coin, amount + 1):` with `ways[total] += ways[total - coin]`, then `return ways[amount]`.',
  },
  'algo-levenshtein': {
    idea: 'Build the edit distance between every prefix of a and every prefix of b. Each cell only needs the row above and the cell to its left.',
    tool: 'Two rows: prev (for a’s previous prefix) and current, starting from `list(range(len(b) + 1))`.',
    plan: 'For each character of a, start a new row with i. Equal characters copy the diagonal (prev[j - 1]); different ones take 1 + the smallest of insert, delete and replace. Then the new row becomes prev.',
    shape: '`prev = list(range(len(b) + 1))`, `for i in range(1, len(a) + 1):` with `current = [i] + [0] * len(b)`, an inner loop over j with the match / `1 + min(...)` rule, `prev = current`, then `return prev[-1]`.',
  },
  'algo-knapsack': {
    idea: 'For every capacity, remember the best value you can carry. Each item can improve a capacity by joining the best for the room that is left.',
    tool: 'A list `best` of size capacity + 1, walked from high to low capacity so each item is used at most once.',
    plan: 'For each item, for room from capacity down to the item’s weight, compare keeping best[room] with taking the item: best[room - weight] + value. Return best[capacity].',
    shape: '`best = [0] * (capacity + 1)`, `for value, weight in items:`, `for room in range(capacity, weight - 1, -1):` with `best[room] = max(best[room], best[room - weight] + value)`, then `return best[capacity]`.',
  },
  'algo-remove-kth-from-end': {
    idea: 'Send a fast pointer k nodes ahead, then move both together. When fast reaches the last node, slow is just before the one to remove.',
    tool: 'Two pointers and a dummy node in front of head, so removing the first node needs no special case.',
    plan: 'Point both at the dummy. Move fast k steps. Move both until fast.next is None. Skip the node after slow. Return the node after the dummy.',
    shape: '`dummy = ListNode(None, head)`, `fast = slow = dummy`, `for _ in range(k): fast = fast.next`, `while fast.next: fast, slow = fast.next, slow.next`, `slow.next = slow.next.next`, `return dummy.next`.',
  },
  'algo-reverse-polish': {
    idea: 'Numbers wait on a stack. An operator takes the two latest numbers, combines them, and puts the result back.',
    tool: 'A list as a stack: `append()` to push and `pop()` to take the latest.',
    plan: 'For each token: a number is pushed as an int. An operator pops the right operand first, then the left, and pushes the result. Division uses `int(left / right)` to truncate toward zero. Return the one value left.',
    shape: '`stack = []`, `for token in tokens:` with `if token in ("+", "-", "*", "/"):` → `right = stack.pop()`, `left = stack.pop()`, one branch per operator; `else: stack.append(int(token))`; then `return stack[0]`.',
  },
  'algo-permutations': {
    idea: 'Build each ordering one choice at a time: pick any remaining item, then order the rest the same way.',
    tool: 'An inner recursive function with a path (chosen so far) and remaining (still to place), and a result list (backtracking).',
    plan: 'When nothing remains, the path is a finished ordering: save it. Otherwise, for each remaining item, recurse with the item added to the path and removed from remaining.',
    shape: '`result = []`, `def build(path, remaining):` with `if not remaining: result.append(path); return` and `for i, item in enumerate(remaining): build(path + [item], remaining[:i] + remaining[i + 1:])`; then `build([], items)` and `return result`.',
  },
}
