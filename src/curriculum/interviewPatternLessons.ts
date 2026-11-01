import type { LessonDraft } from '../examples'
import { practice } from './studyBookPracticeLessons'

/**
 * The coding-interview patterns that the array chapter does not cover: stacks, intervals, grouping, heaps, graphs,
 * backtracking, dynamic programming, linked lists, union-find and tries. Each lesson is one classic problem with the
 * key move left as ???, so the learner names the pattern by writing its one essential line.
 */
const interview = (spec: Omit<Parameters<typeof practice>[0], 'difficulty' | 'chapter' | 'bookChapter'>) =>
  practice({ ...spec, difficulty: 'intermediate', chapter: 'Interview patterns', bookChapter: 'dsa-sql' })

export const INTERVIEW_PATTERN_LESSON_DRAFTS: LessonDraft[] = [
  interview({
    id: 'mid-stack-brackets',
    number: 50,
    topic: 'Stack: valid brackets',
    goal:
      'Finish the bracket checker so every closer must match the most recent opener, and "([]{})", "(]" and "((" print True, False and False.',
    why:
      'Anything that must close in reverse order of opening — brackets, tags, undo, nested calls — is a stack. Counting brackets alone passes "(]" and fails the interview.',
    tasks: [
      'Pop the most recent opener when a closer arrives',
      'Return True only when nothing is left open',
      'Run the three cases and match True, False, False',
    ],
    code: `# Interview patterns — Stack
# Valid parentheses: each closer must match the latest unclosed opener.

PAIRS = {")": "(", "]": "[", "}": "{"}

def is_valid(s):
    stack = []
    for ch in s:
        if ch in "([{":
            stack.append(ch)
        elif not stack or ??? != PAIRS[ch]:
            return False
    return len(stack) == ???

for case in ["([]{})", "(]", "(("]:
    print(case, is_valid(case))
`,
    codeIncludes: ['stack.pop()', 'len(stack) == 0'],
    printPatterns: ['^\\(\\[\\]\\{\\}\\) True$', '^\\(\\] False$', '^\\(\\( False$'],
    hints: [
      'The closer must match the opener on top of the stack, so take it off with stack.pop().',
      'A string like "((" never hits a closer; it is only valid if the stack ends empty.',
    ],
    predict: {
      prompt: '"(]" has one opener and one closer. A counter-only check says…',
      answer: 'Valid — which is wrong, so you need a stack',
      distractors: ['Invalid, counters catch the mismatch', 'It raises an IndexError'],
    },
    compare: {
      note: 'Counting cannot see order or kind. The stack remembers which opener is waiting.',
      wrong: 'return s.count("(") == s.count(")")',
      fixed: 'elif not stack or stack.pop() != PAIRS[ch]:\n    return False',
    },
    stretch:
      'Stretch: also report the index of the first bad character, and print -1 for a valid string so the caller can underline the mistake.',
  }),
  interview({
    id: 'mid-monotonic-stack',
    number: 51,
    topic: 'Monotonic stack',
    goal:
      'Finish daily temperatures with a stack of waiting indices so each day learns how long until a warmer day, printing [1, 1, 4, 2, 1, 1, 0, 0] in one pass.',
    why:
      'Next greater element, stock span and histogram area all keep a stack of items still waiting for an answer. Each index is pushed and popped once, so it is O(n) instead of the O(n²) double loop.',
    tasks: [
      'Pop waiting days while today is warmer than the top',
      'Store the distance from the waiting day to today',
      'Push today and print the answer list',
    ],
    code: `# Interview patterns — Monotonic stack
# Daily temperatures: days until a warmer temperature (0 if none).

def daily_temperatures(temps):
    answer = [0] * len(temps)
    waiting = []  # indices whose warmer day is not found yet
    for today, t in enumerate(temps):
        while waiting and temps[waiting[-1]] ??? t:
            day = waiting.pop()
            answer[day] = ???
        waiting.append(today)
    return answer

print(daily_temperatures([73, 74, 75, 71, 69, 72, 76, 73]))
`,
    codeIncludes: ['temps[waiting[-1]] < t', 'today - day'],
    printPatterns: ['^\\[1, 1, 4, 2, 1, 1, 0, 0\\]$'],
    hints: [
      'A waiting day is answered only by a strictly warmer day, so compare with <.',
      'The answer is how many days later: today minus the waiting day.',
    ],
    predict: {
      prompt: 'Why is this O(n) even with a while loop inside the for loop?',
      answer: 'Each index is pushed once and popped at most once',
      distractors: ['The while loop runs at most twice', 'Python optimises nested loops'],
    },
    compare: {
      note: 'The double loop rescans the future for every day. The stack answers days as soon as a warmer one appears.',
      wrong: 'for i in range(n):\n    for j in range(i + 1, n):\n        if temps[j] > temps[i]:\n            answer[i] = j - i\n            break',
      fixed: 'while waiting and temps[waiting[-1]] < t:\n    day = waiting.pop()\n    answer[day] = today - day',
    },
    stretch:
      'Stretch: change the function to return the next warmer temperature itself instead of the distance, and print [74, 75, 76, 72, 72, 76, 0, 0].',
  }),
  interview({
    id: 'mid-merge-intervals',
    number: 52,
    topic: 'Merge intervals',
    goal:
      'Sort the meetings by start, then merge each one into the last block when they overlap, so [[1, 3], [8, 10], [2, 6], [15, 18]] prints [[1, 6], [8, 10], [15, 18]].',
    why:
      'Calendars, booking systems and range compaction all reduce to sort-then-sweep. Without sorting by start you would have to compare every pair; after sorting, only the last merged block can overlap.',
    tasks: [
      'Sort the intervals by their start',
      'Extend the last block to the larger end when they overlap',
      'Print the merged list',
    ],
    code: `# Interview patterns — Intervals
# Merge overlapping intervals.

def merge(intervals):
    merged = []
    for start, end in sorted(intervals, key=???):
        if merged and start <= merged[-1][1]:
            merged[-1][1] = ???
        else:
            merged.append([start, end])
    return merged

print(merge([[1, 3], [8, 10], [2, 6], [15, 18]]))
`,
    codeIncludes: ['key=lambda', 'max(merged[-1][1], end)'],
    printPatterns: ['^\\[\\[1, 6\\], \\[8, 10\\], \\[15, 18\\]\\]$'],
    hints: [
      'Sort by the first item: key=lambda pair: pair[0].',
      'An interval inside the block must not shrink it, so keep the larger end with max.',
    ],
    predict: {
      prompt: 'After sorting by start, which block can a new interval overlap?',
      answer: 'Only the last merged block',
      distractors: ['Any earlier block', 'The block with the largest end anywhere'],
    },
    compare: {
      note: 'Taking the new end can shrink a block: [1, 10] then [2, 3] would become [1, 3].',
      wrong: 'merged[-1][1] = end',
      fixed: 'merged[-1][1] = max(merged[-1][1], end)',
    },
    stretch:
      'Stretch: write insert(intervals, new) that adds one interval to an already merged list and print the result for [4, 9] on the merged output.',
  }),
  interview({
    id: 'mid-group-anagrams',
    number: 53,
    topic: 'Hash map grouping',
    goal:
      'Group words that are anagrams by giving each word a canonical key, so the six words print three groups: eat/tea/ate, tan/nat and bat, in first-seen order.',
    why:
      'Two-sum, anagram groups, duplicate detection and "first unique" all trade memory for speed with a dict keyed by something canonical. Choosing the key is the whole problem.',
    tasks: [
      'Build the key by sorting the letters of the word',
      'Append the word to its group with setdefault',
      'Print each group on its own line',
    ],
    code: `# Interview patterns — Hash map grouping
# Group anagrams together.

def group_anagrams(words):
    groups = {}
    for word in words:
        key = ???
        groups.setdefault(key, []).append(???)
    return list(groups.values())

for group in group_anagrams(["eat", "tea", "tan", "ate", "nat", "bat"]):
    print(" ".join(group))
`,
    codeIncludes: ['"".join(sorted(word))', '.append(word)'],
    printPatterns: ['^eat tea ate$', '^tan nat$', '^bat$'],
    hints: [
      'Anagrams share the same letters, so sorted letters joined back into a string make the key.',
      'A list cannot be a dict key; "".join(sorted(word)) gives a string that can.',
    ],
    predict: {
      prompt: 'Why not use sorted(word) itself as the key?',
      answer: 'It is a list, and lists are unhashable',
      distractors: ['Sorting is too slow', 'It would lose duplicate letters'],
    },
    compare: {
      note: 'Comparing every pair is O(n²·k). One canonical key per word groups them in a single pass.',
      wrong: 'for a in words:\n    for b in words:\n        if sorted(a) == sorted(b): ...',
      fixed: 'key = "".join(sorted(word))\ngroups.setdefault(key, []).append(word)',
    },
    stretch:
      'Stretch: use a 26-count tuple as the key instead of sorting, explain in a comment why it is O(k) per word, and confirm the groups are unchanged.',
  }),
  interview({
    id: 'mid-heap-top-k',
    number: 54,
    topic: 'Heap: top k',
    goal:
      'Count words with Counter, then take the two most frequent with heapq.nlargest so the log prints "error 3" and "warn 2" without sorting every word.',
    why:
      'Top k, k closest points and "k most frequent" use a heap so you keep only k candidates: O(n log k) instead of sorting all n. In Python that is heapq, usually with Counter.',
    tasks: [
      'Count every word with Counter',
      'Take the k most frequent with heapq.nlargest and a key',
      'Print each word and its count',
    ],
    code: `# Interview patterns — Heap (top k)
# The k most frequent words in a log.
import heapq
from collections import Counter

def top_k(words, k):
    counts = ???
    return heapq.nlargest(k, counts.items(), key=???)

log = ["error", "warn", "error", "info", "warn", "error"]
for word, count in top_k(log, 2):
    print(word, count)
`,
    codeIncludes: ['Counter(words)', 'key=lambda'],
    printPatterns: ['^error 3$', '^warn 2$'],
    hints: [
      'Counter(words) builds the word → count table in one call.',
      'Rank the (word, count) pairs by count: key=lambda item: item[1].',
    ],
    predict: {
      prompt: 'For n words and k = 2, nlargest costs about…',
      answer: 'O(n log k)',
      distractors: ['O(n log n)', 'O(k²)'],
    },
    compare: {
      note: 'Sorting ranks every word just to keep two. A size-k heap only tracks the current best k.',
      wrong: 'return sorted(counts.items(), key=lambda item: -item[1])[:k]',
      fixed: 'return heapq.nlargest(k, counts.items(), key=lambda item: item[1])',
    },
    stretch:
      'Stretch: break ties alphabetically by ranking on (count, reversed word order), add one more "info" line, and print the new top two.',
  }),
  interview({
    id: 'mid-bfs-grid',
    number: 55,
    topic: 'BFS shortest path',
    goal:
      'Finish breadth-first search on the grid so the queue explores level by level and the shortest path from the top-left to the bottom-right prints 8 steps, or -1 when walled off.',
    why:
      'Fewest moves on an unweighted grid or graph is BFS: a queue visits all cells at distance d before d + 1, so the first time you reach the goal is the shortest. DFS can find a path, not the shortest one.',
    tasks: [
      'Take the oldest cell from the queue with popleft',
      'Mark a neighbour as seen when you enqueue it',
      'Print the steps for the open grid and -1 for the blocked one',
    ],
    code: `# Interview patterns — BFS
# Fewest steps from top-left to bottom-right; # is a wall.
from collections import deque

def shortest_path(grid):
    rows, cols = len(grid), len(grid[0])
    queue = deque([(0, 0, 0)])
    seen = {(0, 0)}
    while queue:
        r, c, steps = ???
        if (r, c) == (rows - 1, cols - 1):
            return steps
        for dr, dc in [(1, 0), (-1, 0), (0, 1), (0, -1)]:
            nr, nc = r + dr, c + dc
            inside = 0 <= nr < rows and 0 <= nc < cols
            if inside and grid[nr][nc] == "." and (nr, nc) not in seen:
                ???
                queue.append((nr, nc, steps + 1))
    return -1

open_grid = ["....#", ".##..", "...#.", "#....", "..#.."]
blocked = ["..#", "###", "..."]
print("open", shortest_path(open_grid))
print("blocked", shortest_path(blocked))
`,
    codeIncludes: ['queue.popleft()', 'seen.add((nr, nc))'],
    printPatterns: ['^open 8$', '^blocked -1$'],
    hints: [
      'BFS takes from the front of the queue: queue.popleft(). pop() would turn it into DFS.',
      'Mark cells seen when you enqueue them, otherwise the same cell is queued many times.',
    ],
    predict: {
      prompt: 'Swap popleft() for pop() and the search becomes…',
      answer: 'Depth-first, so the first path found may not be the shortest',
      distractors: ['Faster with the same answer', 'An infinite loop'],
    },
    compare: {
      note: 'Marking cells only when you pop them lets the same cell sit in the queue many times.',
      wrong: 'r, c, steps = queue.popleft()\nseen.add((r, c))',
      fixed: 'if (nr, nc) not in seen:\n    seen.add((nr, nc))\n    queue.append((nr, nc, steps + 1))',
    },
    stretch:
      'Stretch: keep a parent dict while searching and print the actual path as a list of (row, col) cells from start to goal.',
  }),
  interview({
    id: 'mid-topological-sort',
    number: 56,
    topic: 'Topological sort',
    goal:
      'Finish Kahn\'s algorithm so courses are taken only after their prerequisites, printing a valid order for the four courses and "cycle" when two courses require each other.',
    why:
      'Build systems, task schedulers and course planners need an order that respects dependencies. Kahn\'s algorithm repeatedly takes nodes with no remaining prerequisites and detects cycles when it gets stuck.',
    tasks: [
      'Start the queue with every course that has zero prerequisites',
      'Decrease a course\'s in-degree when one prerequisite is taken',
      'Print the order, or "cycle" when not every course was taken',
    ],
    code: `# Interview patterns — Topological sort (Kahn)
# Order courses so each comes after its prerequisites.
from collections import deque

def course_order(n, prereqs):
    after = {course: [] for course in range(n)}
    indegree = [0] * n
    for course, needs in prereqs:
        after[needs].append(course)
        indegree[course] += 1
    queue = deque(course for course in range(n) if ???)
    order = []
    while queue:
        course = queue.popleft()
        order.append(course)
        for nxt in after[course]:
            ???
            if indegree[nxt] == 0:
                queue.append(nxt)
    return order if len(order) == n else "cycle"

print(course_order(4, [(1, 0), (2, 0), (3, 1), (3, 2)]))
print(course_order(2, [(0, 1), (1, 0)]))
`,
    codeIncludes: ['indegree[course] == 0', 'indegree[nxt] -= 1'],
    printPatterns: ['^\\[0, 1, 2, 3\\]$', '^cycle$'],
    hints: [
      'A course with indegree 0 has no prerequisites left, so it can be taken now.',
      'Taking a course removes one prerequisite from each course after it: indegree[nxt] -= 1.',
    ],
    predict: {
      prompt: 'How does Kahn\'s algorithm notice a cycle?',
      answer: 'Fewer courses are output than exist',
      distractors: ['The queue never empties', 'A course is popped twice'],
    },
    compare: {
      note: 'Sorting by number of prerequisites ignores which course they are; dependencies need a graph walk.',
      wrong: 'order = sorted(range(n), key=lambda c: indegree[c])',
      fixed: 'queue = deque(c for c in range(n) if indegree[c] == 0)\n...\nindegree[nxt] -= 1',
    },
    stretch:
      'Stretch: return the courses grouped by semester (all zero-in-degree courses together each round) and print [[0], [1, 2], [3]].',
  }),
  interview({
    id: 'mid-backtracking-subsets',
    number: 57,
    topic: 'Backtracking',
    goal:
      'Finish the choose / explore / un-choose recursion so subsets([1, 2, 3]) prints all 8 subsets, starting [] [1] [1, 2] [1, 2, 3], with no duplicates and no copies sharing one list.',
    why:
      'Subsets, permutations, combination sum and N-queens are the same shape: add a choice, recurse, then undo it. Forgetting to undo or to copy the path is the classic bug.',
    tasks: [
      'Save a copy of the current path, not the path itself',
      'Undo the choice after exploring it',
      'Print every subset and the count 8',
    ],
    code: `# Interview patterns — Backtracking
# All subsets of a list.

def subsets(nums):
    result, path = [], []

    def explore(start):
        result.append(???)
        for i in range(start, len(nums)):
            path.append(nums[i])     # choose
            explore(i + 1)           # explore
            ???                      # un-choose

    explore(0)
    return result

found = subsets([1, 2, 3])
print(*found)
print("count", len(found))
`,
    codeIncludes: ['path[:]', 'path.pop()'],
    printPatterns: ['^\\[\\] \\[1\\] \\[1, 2\\] \\[1, 2, 3\\] \\[1, 3\\] \\[2\\] \\[2, 3\\] \\[3\\]$', '^count 8$'],
    hints: [
      'Appending path itself stores the same list 8 times; append a copy with path[:].',
      'Undo the last choice with path.pop() so the next branch starts clean.',
    ],
    predict: {
      prompt: 'If you append path instead of path[:], the printed result is…',
      answer: 'Eight empty lists',
      distractors: ['The same 8 subsets', 'Only [1, 2, 3]'],
    },
    compare: {
      note: 'Every entry points at the one shared list, which ends empty after all the pops.',
      wrong: 'result.append(path)',
      fixed: 'result.append(path[:])',
    },
    stretch:
      'Stretch: change explore so it builds permutations of [1, 2, 3] instead (track used items) and print all 6 of them with the count.',
  }),
  interview({
    id: 'mid-dp-coin-change',
    number: 58,
    topic: 'Dynamic programming',
    goal:
      'Fill the bottom-up table so best[a] is the fewest coins for amount a, printing 3 coins for 11 with [1, 2, 5] and -1 when 3 cannot be made from [2].',
    why:
      'When the answer for n is built from answers for smaller n — coin change, climbing stairs, house robber, edit distance — store them in a table. Greedy "take the biggest coin" fails on coins like [1, 3, 4].',
    tasks: [
      'Fill best[a] from best[a - coin] plus one coin',
      'Return -1 when the amount stays unreachable',
      'Print both answers',
    ],
    code: `# Interview patterns — Dynamic programming
# Coin change: fewest coins that add up to the amount.

def min_coins(coins, amount):
    INF = float("inf")
    best = [0] + [INF] * amount
    for a in range(1, amount + 1):
        for coin in coins:
            if coin <= a:
                best[a] = min(best[a], ???)
    return best[amount] if best[amount] != INF else ???

print("11 with [1, 2, 5]:", min_coins([1, 2, 5], 11))
print("3 with [2]:", min_coins([2], 3))
`,
    codeIncludes: ['best[a - coin] + 1'],
    printPatterns: ['^11 with \\[1, 2, 5\\]: 3$', '^3 with \\[2\\]: -1$'],
    hints: [
      'Using one coin leaves a - coin, whose best answer is already in the table: best[a - coin] + 1.',
      'An amount still at INF cannot be made; the problem asks for -1 then.',
    ],
    predict: {
      prompt: 'Greedy on coins [1, 3, 4] for amount 6 gives 4+1+1. The DP answer is…',
      answer: '2 coins (3 + 3)',
      distractors: ['3 coins, same as greedy', '1 coin'],
    },
    compare: {
      note: 'Greedy commits to the biggest coin first and cannot back out; the table tries every last coin.',
      wrong: 'for coin in sorted(coins, reverse=True):\n    count += amount // coin\n    amount %= coin',
      fixed: 'best[a] = min(best[a], best[a - coin] + 1)',
    },
    stretch:
      'Stretch: count the number of different ways to make the amount instead of the fewest coins, and print 4 ways to make 5 from [1, 2, 5].',
  }),
  interview({
    id: 'mid-linked-list-reverse',
    number: 59,
    topic: 'Linked list',
    goal:
      'Reverse the singly linked list in place by re-pointing one node at a time, so 1 -> 2 -> 3 -> 4 prints 4 -> 3 -> 2 -> 1 without building a Python list.',
    why:
      'Reverse, detect a cycle, find the middle and merge two sorted lists are all pointer walks with prev / current / next. Losing the next pointer before re-linking breaks the list.',
    tasks: [
      'Remember the next node before re-pointing current',
      'Point current back at prev, then step both forward',
      'Print the reversed list',
    ],
    code: `# Interview patterns — Linked list
# Reverse a singly linked list in place.

class Node:
    def __init__(self, value, next=None):
        self.value = value
        self.next = next

def reverse(head):
    prev, current = None, head
    while current:
        nxt = ???
        current.next = ???
        prev, current = current, nxt
    return prev

def show(node):
    values = []
    while node:
        values.append(str(node.value))
        node = node.next
    return " -> ".join(values)

head = Node(1, Node(2, Node(3, Node(4))))
print(show(reverse(head)))
`,
    codeIncludes: ['nxt = current.next', 'current.next = prev'],
    printPatterns: ['^4 -> 3 -> 2 -> 1$'],
    hints: [
      'Save current.next first; after re-pointing it you can no longer reach the rest.',
      'Reversing means the node now points backwards: current.next = prev.',
    ],
    predict: {
      prompt: 'If you set current.next = prev before saving it, the loop…',
      answer: 'Loses the rest of the list after the first node',
      distractors: ['Still reverses correctly', 'Raises AttributeError'],
    },
    compare: {
      note: 'Copying values into a list uses O(n) extra memory and is not what the question tests.',
      wrong: 'values = to_list(head)\nreturn from_list(values[::-1])',
      fixed: 'nxt = current.next\ncurrent.next = prev\nprev, current = current, nxt',
    },
    stretch:
      'Stretch: write has_cycle(head) with a slow and a fast pointer, link the last node back to the second, and print True, then False for the plain list.',
  }),
  interview({
    id: 'mid-union-find',
    number: 60,
    topic: 'Union-find',
    goal:
      'Finish find with path compression and union by root so the friendship pairs collapse into groups, printing 2 groups for five people and True / False for two "same group?" questions.',
    why:
      'Connected components, redundant connections and account merging ask "are these in the same group?" many times while groups keep merging. Union-find answers each in near O(1).',
    tasks: [
      'Make find follow parents to the root and compress the path',
      'Join two groups by pointing one root at the other',
      'Print the group count and both answers',
    ],
    code: `# Interview patterns — Union-find
# Count friend groups and answer same-group questions.

parent = list(range(5))

def find(x):
    if parent[x] != x:
        parent[x] = ???      # path compression
    return parent[x]

def union(a, b):
    root_a, root_b = find(a), find(b)
    if root_a != root_b:
        ???

for a, b in [(0, 1), (1, 2), (3, 4)]:
    union(a, b)

print("groups", len({find(x) for x in range(5)}))
print("0 and 2", find(0) == find(2))
print("2 and 3", find(2) == find(3))
`,
    codeIncludes: ['find(parent[x])', 'parent[root_a] = root_b'],
    printPatterns: ['^groups 2$', '^0 and 2 True$', '^2 and 3 False$'],
    hints: [
      'find should return the root, so recurse on the parent: parent[x] = find(parent[x]).',
      'Merge groups by linking roots, not the original nodes: parent[root_a] = root_b.',
    ],
    predict: {
      prompt: 'Linking parent[a] = b instead of the roots can…',
      answer: 'Split a group that a already belonged to',
      distractors: ['Make find slower but correct', 'Raise a RecursionError every time'],
    },
    compare: {
      note: 'Re-pointing a node instead of its root detaches it from the rest of its old group.',
      wrong: 'parent[a] = b',
      fixed: 'parent[find(a)] = find(b)',
    },
    stretch:
      'Stretch: add union by size (attach the smaller group under the larger), keep a size list, and print the size of the largest group, which is 3.',
  }),
  interview({
    id: 'mid-trie-prefix',
    number: 61,
    topic: 'Trie',
    goal:
      'Finish a dict-of-dicts trie so insert walks one character at a time and starts_with answers prefix questions, printing True for "app" and "ban" and False for "cat".',
    why:
      'Autocomplete, word search and "longest common prefix" check many prefixes against one word list. A trie answers each prefix in O(length) no matter how many words are stored.',
    tasks: [
      'Create the child node only when it is missing, then step into it',
      'Walk the prefix and fail as soon as a character is missing',
      'Print the three prefix answers',
    ],
    code: `# Interview patterns — Trie
# Prefix lookups over a word list.

root = {}

def insert(word):
    node = root
    for ch in word:
        node = node.setdefault(ch, ???)
    node["$"] = True  # marks the end of a word

def starts_with(prefix):
    node = root
    for ch in prefix:
        if ch not in node:
            return ???
        node = node[ch]
    return True

for word in ["apple", "app", "banana"]:
    insert(word)

for prefix in ["app", "ban", "cat"]:
    print(prefix, starts_with(prefix))
`,
    codeIncludes: ['node.setdefault(ch, {})', 'return False'],
    printPatterns: ['^app True$', '^ban True$', '^cat False$'],
    hints: [
      'Each child is another dict, so setdefault(ch, {}) creates it only when missing.',
      'A missing character means no word has this prefix, so return False right away.',
    ],
    predict: {
      prompt: 'Checking a prefix against 100 000 stored words costs about…',
      answer: 'The length of the prefix',
      distractors: ['The number of words', 'The length of the longest word times the words'],
    },
    compare: {
      note: 'Scanning every word is O(words × length) per question; the trie walks only the prefix.',
      wrong: 'return any(word.startswith(prefix) for word in words)',
      fixed: 'for ch in prefix:\n    if ch not in node:\n        return False\n    node = node[ch]',
    },
    stretch:
      'Stretch: add search(word) that is True only for whole words (check the "$" marker) and print True for "app" and False for "appl".',
  }),
]
