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
    plan: 'Walk the numbers once. For each number, work out the partner it needs; if that partner is in the set, return the pair. Otherwise add the number to the set. If the loop ends, return [].',
    shape: '`seen = set()`, then `for number in nums:` with `needed = target - number`, `if needed in seen: return [needed, number]` and `seen.add(number)`; after the loop `return []`.',
  },
  'algo-validate-subsequence': {
    idea: 'Keep a pointer to the next sequence item you still need. The array may skip items, but the sequence must appear in order.',
    tool: 'One counter of how many sequence items you have matched, and a single for loop over array. No nested loops.',
    plan: 'Start matched_count at 0. For each array value, if it equals the next unmatched sequence item, add one to matched_count. At the end, check whether every item was matched.',
    shape: '`matched_count = 0`, `for value in array:` with `if matched_count < len(sequence) and value == sequence[matched_count]: matched_count += 1`, then `return matched_count == len(sequence)`.',
  },
  'algo-three-sum': {
    idea: 'Fix one number, then the other two are a two-sum on the numbers after it. A set of numbers already seen finds each partner in one pass.',
    tool: 'An outer for loop over i, a fresh `set()` for each first number, and `sorted()` so each triplet has one spelling.',
    plan: 'For each first number, walk the numbers after it. The third number needed is target - first - second; if it is in the set, save the sorted triplet unless you already have it. Add the second number to the set. Return the triplets sorted.',
    shape: '`results = []`, `for i in range(len(nums)):` with `first_number = nums[i]` and `seen = set()`, an inner `for second_number in nums[i + 1:]:` with `needed = target - first_number - second_number`, the `if needed in seen:` save, `seen.add(second_number)`, then `return sorted(results)`.',
  },
  'algo-product-except-self': {
    idea: 'The answer at i is (product of everything left of i) × (product of everything right of i). No division needed.',
    tool: 'A list of 1s and two running products: one filled walking left to right, one walking right to left.',
    plan: 'First pass: store the running product of everything to the left at each index, then multiply it by nums[index]. Second pass from the end: multiply each slot by the running product of everything to the right, then fold nums[index] into it.',
    shape: '`products = [1] * len(nums)`, `left_product = 1` and a forward loop with `products[index] = left_product`, then `right_product = 1` and a `for index in range(len(nums) - 1, -1, -1):` loop with `products[index] *= right_product`.',
  },
  'algo-kadane': {
    idea: 'Track the best sum of a run that ends exactly at the current number. Either extend the previous run or start fresh here.',
    tool: 'Two variables, current_sum and best_sum, and `max()`. One pass.',
    plan: 'Start both at the first number. For each next number, current_sum becomes the larger of the number alone and current_sum + number; best_sum becomes the larger of best_sum and current_sum.',
    shape: '`best_sum = nums[0]`, `current_sum = nums[0]`, `for number in nums[1:]:` with `current_sum = max(number, current_sum + number)` and `best_sum = max(best_sum, current_sum)`, then `return best_sum`.',
  },
  'algo-palindrome': {
    idea: 'A palindrome reads the same from both ends, so compare the outermost characters and walk inwards.',
    tool: 'Two indexes, left_index at 0 and right_index at the last position, and a while loop.',
    plan: 'While left_index < right_index: if the two characters differ, return False; otherwise move left_index up and right_index down. If the loop ends, return True.',
    shape: '`left_index = 0`, `right_index = len(text) - 1`, `while left_index < right_index:` with `if text[left_index] != text[right_index]: return False` and both indexes moving, then `return True`.',
  },
  'algo-longest-palindrome': {
    idea: 'Every palindrome grows out from a center. Try every center and expand while both ends match.',
    tool: 'A small helper `expand_around(left_index, right_index)` with a while loop, called twice per center: once for odd length, once for even.',
    plan: 'The helper moves outwards while the characters match and returns the palindrome between the last matching edges. For each center, try (center, center) and (center, center + 1) and keep whichever is longest.',
    shape: '`longest = ""`, `def expand_around(left_index, right_index):` with a `while … s[left_index] == s[right_index]:` loop and `return s[left_index + 1:right_index]`, then `for center in range(len(s)):` comparing `odd_palindrome` and `even_palindrome` with `longest`.',
  },
  'algo-run-length': {
    idea: 'Count how long each run of the same character is, and write the count before the character. Cut runs at 9 so every count is one digit.',
    tool: 'A result string, the character of the current run, and its length.',
    plan: 'Walk the characters. While the character matches the run and the run is under 9, count it. Otherwise write length + character, then start a new run with length 1. After the loop, write the last run.',
    shape: '`encoded = ""`, `run_char = text[0]`, `run_length = 0`, `for char in text:` with `if char == run_char and run_length < 9:` / `else: encoded += f"{run_length}{run_char}"`, then the final write and `return encoded`.',
  },
  'algo-binary-search': {
    idea: 'In a sorted list the middle value tells you which half cannot contain the target, so throw that half away every step.',
    tool: 'Two bounds, low_index and high_index, a while loop, and integer division `//` for the middle.',
    plan: 'While low_index <= high_index, look at the middle value. Found it: return its index. Middle too small: move low_index past it. Too big: move high_index below it. Bounds crossed: return -1.',
    shape: '`low_index = 0`, `high_index = len(nums) - 1`, `while low_index <= high_index:` with `middle_index = (low_index + high_index) // 2`, then `low_index = middle_index + 1` or `high_index = middle_index - 1`, and `return -1` after the loop.',
  },
  'algo-three-number-sort': {
    idea: 'Keep three zones: first values at the front, last values at the back, middle values in between. One scan sorts everything in place.',
    tool: 'Three indexes, low, mid and high, and tuple swaps like `a[x], a[y] = a[y], a[x]`.',
    plan: 'While mid <= high: a first value swaps to low and both move on; a second value stays and only mid moves; a last value swaps to high and high moves down (mid stays, the swapped-in value is unchecked).',
    shape: '`first_value = order[0]`, `second_value = order[1]`, `low = 0`, `mid = 0`, `high = len(array) - 1`, `while mid <= high:` with `if value == first_value / elif value == second_value / else`, then `return array`.',
  },
  'algo-merge-sort': {
    idea: 'Split the list in half, sort each half the same way, then merge two sorted lists by always taking the smaller front item.',
    tool: 'Recursion with a base case, slicing, and two indexes for the merge.',
    plan: 'A list of 0 or 1 items is already sorted. Otherwise sort both halves recursively. Merge while both have items, then append whatever is left of either half.',
    shape: '`if len(nums) <= 1: return nums`, `middle = len(nums) // 2`, `left_half = merge_sort(nums[:middle])`, `right_half = merge_sort(nums[middle:])`, a `while left_index < len(left_half) and right_index < len(right_half):` merge, then extend with what is left and `return merged`.',
  },
  'algo-validate-bst': {
    idea: 'Every node must sit inside a range set by its ancestors, not just compare to its parent.',
    tool: 'Recursion that passes the allowed range down: `low` and `high` default to minus and plus infinity.',
    plan: 'An empty node is valid. A value outside [low, high) is invalid. Otherwise check the left child with the current value as the new upper bound and the right child with it as the new lower bound.',
    shape: '`if node is None: return True`, `if node.value < low or node.value >= high: return False`, then `left_is_valid = is_bst(node.left, low, node.value)`, `right_is_valid = is_bst(node.right, node.value, high)` and `return left_is_valid and right_is_valid`.',
  },
  'algo-invert-tree': {
    idea: 'Inverting is a mirror: at every node, the left and right children swap places.',
    tool: 'Recursion, plus one temporary variable for the swap.',
    plan: 'An empty node stays empty. Swap the two children, invert both of them the same way, and return the node.',
    shape: '`if node is None: return None`, `original_left = node.left`, `node.left = node.right`, `node.right = original_left`, `invert(node.left)`, `invert(node.right)`, `return node`.',
  },
  'algo-tree-diameter': {
    idea: 'The longest path through a node is its left height plus its right height. The diameter is the largest of those over all nodes.',
    tool: 'An inner recursive function that returns two numbers per node: its height and the best diameter inside it.',
    plan: 'An empty node has height 0 and diameter 0. For a node, get both children’s results. The path through this node is left_height + right_height; the diameter is the biggest of that and the children’s diameters; the height is 1 + the taller side.',
    shape: '`def height_and_diameter(node):` with a None check returning `0, 0`, both child calls, `path_through_node = left_height + right_height`, `height = 1 + max(...)`, `diameter = max(...)`, `return height, diameter`; then `_, diameter = height_and_diameter(root)`.',
  },
  'algo-river-sizes': {
    idea: 'A river is a connected group of 1s. Start at any unvisited 1, explore everything it touches, and count the cells.',
    tool: 'A set of visited (row, column) pairs and a list used as a stack (depth-first search).',
    plan: 'Loop over every cell. Skip land and visited water. From a new water cell, pop cells off a stack, count each, and push unvisited water neighbours up, down, left and right. Save each count; return them sorted.',
    shape: '`row_count`, `column_count`, `visited = set()`, `sizes = []`, two loops over row and column, `stack = [(row, column)]` with `visited.add(...)`, `while stack:` that pops, counts and pushes the four neighbours, then `return sorted(sizes)`.',
  },
  'algo-cycle-in-graph': {
    idea: 'During a depth-first search, reaching a node that is still “in progress” on the current path means you went in a circle.',
    tool: 'Three colors per node: WHITE (not seen), GREY (on the current path) and BLACK (finished), plus a recursive visit.',
    plan: 'Color a node grey when you enter it. For each neighbour: grey means a cycle; white means visit it and pass a found cycle up. Color the node black when you leave. Try every white node as a start.',
    shape: '`WHITE = 0`, `GREY = 1`, `BLACK = 2`, `color = [WHITE] * len(edges)`, `def visit(node):` that sets GREY, loops over each neighbor in `edges[node]`, sets BLACK and returns False; then a `for node in range(len(edges)):` loop that returns True when `visit(node)` finds a cycle, and `return False`.',
  },
  'algo-dijkstra': {
    idea: 'Always settle the closest unfinished node next; its distance can no longer improve. Then try to improve its neighbours through it.',
    tool: '`heapq` as a priority queue of (distance, node) pairs and a list of best distances, starting at infinity.',
    plan: 'Push (0, start). Pop the closest; skip it if a shorter distance was already found. For each edge, compute distance through this node; if it is shorter, store it and push it. Unreachable nodes become -1.',
    shape: '`distances = [float("inf")] * len(edges)`, `distances[start] = 0`, `heap = [(0, start)]`, `while heap:` with `distance, node = heapq.heappop(heap)`, a stale check, `new_distance = distance + weight`, `heapq.heappush(heap, (new_distance, neighbor))`, then a loop that turns inf into -1.',
  },
  'algo-staircase': {
    idea: 'The ways to reach a step are the sum of the ways to reach each step you could have jumped from.',
    tool: 'A list `ways_to_reach` where index = step, starting with 1 way to stand at the bottom (dynamic programming).',
    plan: 'For every step from 1 to height, add up ways_to_reach[step - jump] for every allowed jump that does not go below 0. Return the value at height.',
    shape: '`ways_to_reach = [0] * (height + 1)`, `ways_to_reach[0] = 1`, `for step in range(1, height + 1):`, `for jump in range(1, max_steps + 1):` with `if step - jump >= 0: ways_to_reach[step] += ways_to_reach[step - jump]`, then `return ways_to_reach[height]`.',
  },
  'algo-house-robber': {
    idea: 'At each value you either take it (then the previous one must have been skipped) or skip it (keep the best so far).',
    tool: 'Two running totals: best_so_far, and best_before_previous (the best that ends at least two values back).',
    plan: 'Start both at 0. For each value: taking it gives best_before_previous + value. Shift best_so_far into best_before_previous, then best_so_far becomes the larger of keeping it or taking the value.',
    shape: '`best_before_previous = 0`, `best_so_far = 0`, `for value in values:` with `best_with_value = best_before_previous + value`, `best_before_previous = best_so_far`, `best_so_far = max(best_so_far, best_with_value)`, then `return best_so_far`.',
  },
  'algo-ways-to-change': {
    idea: 'Count ways per amount, adding one coin type at a time, so each combination is counted once regardless of order.',
    tool: 'A list `ways_for_amount` where index = amount and ways_for_amount[0] = 1 (one way to make 0: use nothing).',
    plan: 'For each coin, for every total from the coin’s value up to amount, add the ways to make total - coin. Return ways_for_amount[amount].',
    shape: '`ways_for_amount = [0] * (amount + 1)`, `ways_for_amount[0] = 1`, `for coin in coins:`, `for total in range(coin, amount + 1):` with `ways_for_amount[total] += ways_for_amount[total - coin]`, then `return ways_for_amount[amount]`.',
  },
  'algo-levenshtein': {
    idea: 'Build the edit distance between every prefix of a and every prefix of b. Each cell only needs the row above and the cell to its left.',
    tool: 'Two rows: previous_row (for a’s previous prefix) and current_row, starting from `list(range(len(b) + 1))`.',
    plan: 'For each character of a, start a new row with i. Equal characters copy the diagonal (previous_row[j - 1]); different ones take 1 + the smallest of the insert, delete and replace costs. Then the new row becomes previous_row.',
    shape: '`previous_row = list(range(len(b) + 1))`, `for i in range(1, len(a) + 1):` with `current_row = [i] + [0] * len(b)`, an inner loop over j with the match rule or `insert_cost`, `delete_cost`, `replace_cost`, `previous_row = current_row`, then `return previous_row[-1]`.',
  },
  'algo-knapsack': {
    idea: 'For every capacity, remember the best value you can carry. Each item can improve a capacity by joining the best for the room that is left.',
    tool: 'A list `best_value` of size capacity + 1, walked from high to low capacity so each item is used at most once.',
    plan: 'For each item, for room from capacity down to the item’s weight, compare keeping best_value[room] with taking the item: best_value[room - weight] + value. Return best_value[capacity].',
    shape: '`best_value = [0] * (capacity + 1)`, `for value, weight in items:`, `for room in range(capacity, weight - 1, -1):` with `value_if_taken = best_value[room - weight] + value` and `best_value[room] = max(best_value[room], value_if_taken)`, then `return best_value[capacity]`.',
  },
  'algo-remove-kth-from-end': {
    idea: 'Send a fast pointer k nodes ahead, then move both together. When fast reaches the last node, slow is just before the one to remove.',
    tool: 'Two pointers and a dummy node in front of head, so removing the first node needs no special case.',
    plan: 'Point both at the dummy. Move fast k steps. Move both until fast.next is None. Skip the node after slow. Return the node after the dummy.',
    shape: '`dummy = ListNode(None, head)`, `fast = dummy`, `slow = dummy`, `for _ in range(k): fast = fast.next`, `while fast.next is not None:` moving both, `slow.next = slow.next.next`, `return dummy.next`.',
  },
  'algo-reverse-polish': {
    idea: 'Numbers wait on a stack. An operator takes the two latest numbers, combines them, and puts the result back.',
    tool: 'A list as a stack: `append()` to push and `pop()` to take the latest.',
    plan: 'For each token: a number is pushed as an int. An operator pops the right operand first, then the left, and pushes the result. Division uses `int(left_operand / right_operand)` to truncate toward zero. Return the one value left.',
    shape: '`stack = []`, `for token in tokens:` with `if token not in ("+", "-", "*", "/"): stack.append(int(token)); continue`, then `right_operand = stack.pop()`, `left_operand = stack.pop()` and one branch per operator; `return stack[0]`.',
  },
  'algo-permutations': {
    idea: 'Build each ordering one choice at a time: pick any remaining item, then order the rest the same way.',
    tool: 'An inner recursive function with current_ordering (chosen so far) and remaining_items (still to place), and a list of all orderings (backtracking).',
    plan: 'When nothing remains, current_ordering is finished: save it. Otherwise, for each remaining item, recurse with that item added to the ordering and removed from the remaining items.',
    shape: '`all_orderings = []`, `def build(current_ordering, remaining_items):` with the empty check, then a loop over `index` that picks `chosen_item`, builds `items_left` and calls `build(current_ordering + [chosen_item], items_left)`; then `build([], items)` and `return all_orderings`.',
  },
}
