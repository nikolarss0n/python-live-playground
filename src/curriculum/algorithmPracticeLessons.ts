import type { LessonDraft } from '../examples'
import { practice } from './studyBookPracticeLessons'

/**
 * Algorithm practice: classic, frequently asked interview problems that the interview-pattern lessons do not already
 * cover. Puzzle-style problems that rarely appear in real interviews were left out. Each function body starts empty
 * (one ???) so the learner writes the algorithm; the Hint pill climbs from the idea to the shape of the code.
 */
const algo = (spec: Omit<Parameters<typeof practice>[0], 'difficulty' | 'chapter' | 'bookChapter'>): LessonDraft => {
  const draft = practice({ ...spec, difficulty: 'intermediate', chapter: 'Algorithm practice', bookChapter: 'dsa-sql' })
  return {
    ...draft,
    taskInstructions: spec.tasks.map(
      (task) => `${task}. Write it in the empty function body where ??? stands; Hint starts with the idea and what to use.`,
    ),
  }
}

const TREE_NODE = `class Node:
    def __init__(self, value, left=None, right=None):
        self.value, self.left, self.right = value, left, right
`

export const ALGORITHM_PRACTICE_LESSON_DRAFTS: LessonDraft[] = [
  algo({
    id: 'algo-two-sum',
    number: 62,
    topic: 'Two number sum',
    goal: 'Find the two numbers that add up to the target in one pass with a set of numbers already seen, printing [11, -1] and then [] when no pair exists.',
    why: 'The nested-loop answer is O(n²). Remembering what you have seen turns “is there a partner?” into an O(1) lookup, the move behind most hash-map interview answers.',
    tasks: ['Compute the partner each number needs', 'Remember the current number after checking it', 'Run both cases and match the printed pairs'],
    code: `# Algorithms — Two number sum
# Return the two numbers that add up to target, or [] if none do.

def two_sum(nums, target):
    ???

print(two_sum([3, 5, -4, 8, 11, 1, -1, 6], 10))
print(two_sum([1, 2, 3], 100))
`,
    codeIncludes: [],
    printPatterns: ['^\\[11, -1\\]$', '^\\[\\]$'],
    hints: ['The partner of n is whatever is missing to reach target: target - n.', 'Add n only after the check, or a number could pair with itself.'],
    predict: { prompt: 'With a set of seen numbers, the whole search takes…', answer: 'One pass, O(n)', distractors: ['Two passes, O(n²)', 'O(n log n) because of sorting'] },
    compare: { note: 'The double loop tries every pair; the set answers “have I seen the partner?” instantly.', wrong: 'for i in range(len(nums)):\n    for j in range(i + 1, len(nums)):\n        if nums[i] + nums[j] == target:\n            return [nums[i], nums[j]]', fixed: 'need = target - n\nif need in seen:\n    return [need, n]\nseen.add(n)' },
    stretch: 'Stretch: return the indices instead of the values by storing each number in a dict that maps value to index, and print [4, 6] for the first case.',
  }),
  algo({
    id: 'algo-validate-subsequence',
    number: 63,
    topic: 'Validate subsequence',
    goal: 'Walk the array once and advance a pointer into the sequence on every match, so [1, 6, -1, 10] prints True and the out-of-order [1, 10, 6] prints False.',
    why: 'A subsequence keeps order but may skip items. One pointer that only moves forward checks it in O(n) — the same idea used when diffing text or matching events in logs.',
    tasks: ['Move the sequence pointer forward on a match', 'Report success only when every item was matched', 'Run both cases and match True, False'],
    code: `# Algorithms — Validate subsequence
# Is every item of sequence in array, in the same order?

def is_subsequence(array, sequence):
    ???

print(is_subsequence([5, 1, 22, 25, 6, -1, 8, 10], [1, 6, -1, 10]))
print(is_subsequence([5, 1, 22, 25, 6, -1, 8, 10], [1, 10, 6]))
`,
    codeIncludes: [],
    printPatterns: ['^True$', '^False$'],
    hints: ['Each match uses up one item of the sequence, so move i on by one.', 'The sequence is fully found when i has reached its length.'],
    predict: { prompt: '[1, 10, 6] fails because…', answer: '10 comes after 6 in the array, so order breaks', distractors: ['6 is missing from the array', 'Subsequences must be adjacent'] },
    compare: { note: 'Membership checks ignore order; the pointer enforces it.', wrong: 'return all(x in array for x in sequence)', fixed: 'if i < len(sequence) and value == sequence[i]:\n    i += 1\nreturn i == len(sequence)' },
    stretch: 'Stretch: return the index in array where each sequence item was matched, and print [1, 4, 5, 7] for the first case to show the order explicitly.',
  }),
  algo({
    id: 'algo-three-sum',
    number: 64,
    topic: 'Three number sum',
    goal: 'Sort once, fix each number, and close two pointers from both ends to find every triplet summing to zero, printing [[-8, 2, 6], [-8, 3, 5], [-6, 1, 5]].',
    why: 'Three-sum is two-sum inside a loop. Sorting lets two pointers decide which side to move from the total alone, giving O(n²) instead of trying all O(n³) triplets.',
    tasks: ['Start the pointers just after i and at the end', 'Move left when the total is too small', 'Print every triplet in sorted order'],
    code: `# Algorithms — Three number sum
# Every triplet that adds up to target, each sorted.

def three_sum(nums, target):
    ???

print(three_sum([12, 3, 1, 2, -6, 5, -8, 6], 0))
`,
    codeIncludes: [],
    printPatterns: ['^\\[\\[-8, 2, 6\\], \\[-8, 3, 5\\], \\[-6, 1, 5\\]\\]$'],
    hints: ['The pair must come after nums[i], so left starts at i + 1.', 'Moving left to a bigger number raises the total, so do that when the total is below target (<).'],
    predict: { prompt: 'After sorting, a total that is too small means you should…', answer: 'Move the left pointer right', distractors: ['Move the right pointer left', 'Restart with the next i'] },
    compare: { note: 'Three nested loops cost O(n³); one loop plus two pointers costs O(n²).', wrong: 'for a in nums:\n    for b in nums:\n        for c in nums: ...', fixed: 'left, right = i + 1, len(nums) - 1\nwhile left < right: ...' },
    stretch: 'Stretch: skip duplicate values for i, left and right so [0, 0, 0, 0] prints [[0, 0, 0]] once instead of several identical triplets.',
  }),
  algo({
    id: 'algo-product-except-self',
    number: 65,
    topic: 'Array of products',
    goal: 'Build each answer from the product of everything to its left times everything to its right, without division, so [5, 1, 4, 2] prints [8, 40, 10, 20].',
    why: 'Division breaks on zeros and is often banned in the question. Two sweeps — left products, then right products — is the standard prefix/suffix trick and runs in O(n).',
    tasks: ['Walk the indices from right to left', 'Grow the running right product by the current number', 'Print the products list'],
    code: `# Algorithms — Array of products
# products[i] = product of every number except nums[i], no division.

def array_of_products(nums):
    ???

print(array_of_products([5, 1, 4, 2]))
`,
    codeIncludes: [],
    printPatterns: ['^\\[8, 40, 10, 20\\]$'],
    hints: ['The second pass goes backwards: reversed(range(len(nums))).', 'After using right for index i, include nums[i] in it for the next index to the left.'],
    predict: { prompt: 'Why avoid total // nums[i]?', answer: 'A zero in the list makes division fail or lie', distractors: ['Division is slower than multiplication', 'Python has no integer division'] },
    compare: { note: 'Division needs a non-zero number; prefix and suffix products never divide.', wrong: 'total = math.prod(nums)\nreturn [total // n for n in nums]', fixed: 'for i in reversed(range(len(nums))):\n    products[i] *= right\n    right *= nums[i]' },
    stretch: 'Stretch: run it on [0, 3, 4] and confirm it prints [12, 0, 0], a case where the division shortcut would crash.',
  }),
  algo({
    id: 'algo-kadane',
    number: 66,
    topic: "Kadane's maximum subarray",
    goal: 'Track the best sum ending at each position and the best seen overall, so the long example prints 19 and an all-negative list prints its largest number, -1.',
    why: 'At each number you either extend the run or start fresh — whichever is bigger. That one decision finds the best contiguous sum in O(n) and appears in stock, signal and log problems.',
    tasks: ['Decide between starting fresh and extending the run', 'Keep the best run seen so far', 'Run both cases and match 19 and -1'],
    code: `# Algorithms — Kadane's algorithm
# Largest sum of any contiguous run of numbers.

def max_subarray(nums):
    ???

print(max_subarray([3, 5, -9, 1, 3, -2, 3, 4, 7, 2, -9, 6, 3, 1, -5, 4]))
print(max_subarray([-3, -1, -2]))
`,
    codeIncludes: [],
    printPatterns: ['^19$', '^-1$'],
    hints: ['Extending the run means current + n; starting fresh means just n.', 'best only changes when the current run beats it: max(best, current).'],
    predict: { prompt: 'For [-3, -1, -2] the answer is…', answer: '-1', distractors: ['0', '-6'] },
    compare: { note: 'Starting best at 0 wrongly returns 0 when every number is negative.', wrong: 'best = current = 0', fixed: 'best = current = nums[0]' },
    stretch: 'Stretch: also return the start and end index of the best run and print them, so you can show which slice of the list gives 19.',
  }),
  algo({
    id: 'algo-palindrome',
    number: 67,
    topic: 'Palindrome check',
    goal: 'Compare characters from both ends moving inwards and stop at the first mismatch, so "abcdcba" and "racecar" print True and "python" prints False.',
    why: 'Two pointers from the ends check a palindrome in O(n) time and O(1) memory, and the same inward walk shows up in reversing arrays and in many string interview questions.',
    tasks: ['Compare the left character with the right one', 'Return True when the pointers meet without a mismatch', 'Run the three words and match the results'],
    code: `# Algorithms — Palindrome check

def is_palindrome(text):
    """Does text read the same forwards and backwards?"""
    ???

for word in ["abcdcba", "racecar", "python"]:
    print(word, is_palindrome(word))
`,
    codeIncludes: [],
    printPatterns: ['^abcdcba True$', '^racecar True$', '^python False$'],
    hints: ['The character to compare with text[left] sits at the right pointer.', 'If the loop finishes, no pair differed, so the word is a palindrome.'],
    predict: { prompt: 'How much extra memory does the two-pointer check use?', answer: 'O(1): two integers', distractors: ['O(n): a reversed copy', 'O(log n)'] },
    compare: { note: 'Reversing works but builds a full copy; two pointers stop early and use no extra string.', wrong: 'return text == text[::-1]', fixed: 'while left < right:\n    if text[left] != text[right]:\n        return False' },
    stretch: 'Stretch: ignore case and non-letters so "A man, a plan, a canal: Panama" prints True, skipping characters with str.isalnum() as the pointers move.',
  }),
  algo({
    id: 'algo-longest-palindrome',
    number: 68,
    topic: 'Longest palindromic substring',
    goal: 'Expand around every centre — one character and between two characters — and keep the longest palindrome, printing "xyzzyx" and then "bb".',
    why: 'Every palindrome mirrors around its middle. Growing from each of the 2n − 1 centres finds them all in O(n²) without checking every substring, which would be O(n³).',
    tasks: ['Grow the right edge while both sides match', 'Slice the palindrome between the final edges', 'Run both strings and match the longest palindromes'],
    code: `# Algorithms — Longest palindromic substring

def longest_palindrome(s):
    """The longest substring of s that is a palindrome."""
    ???

print(longest_palindrome("abaxyzzyxf"))
print(longest_palindrome("cbbd"))
`,
    codeIncludes: [],
    printPatterns: ['^xyzzyx$', '^bb$'],
    hints: ['Both edges move one step outwards each round.', 'The loop stops one step too far on each side, so the palindrome is s[left + 1:right].'],
    predict: { prompt: 'Why also try (center, center + 1)?', answer: 'Even-length palindromes like "zz" have no middle character', distractors: ['To handle the last character', 'It doubles the speed'] },
    compare: { note: 'Checking every substring repeats work; expanding reuses the mirror property.', wrong: 'for i in range(n):\n    for j in range(i, n):\n        if s[i:j+1] == s[i:j+1][::-1]: ...', fixed: 'while left >= 0 and right < len(s) and s[left] == s[right]:\n    left -= 1\n    right += 1' },
    stretch: 'Stretch: count how many palindromic substrings the string has by adding 1 every time the while loop matches, and print 12 for "abaxyzzyxf".',
  }),
  algo({
    id: 'algo-run-length',
    number: 69,
    topic: 'Run-length encoding',
    goal: 'Compress runs of the same character into count-plus-character pairs, capping each run at 9, so the example prints "9A4A2B4C2D" and "aA" prints "1a1A".',
    why: 'Run-length encoding is a classic string-building warm-up: it tests boundary handling at the end of the string, collecting parts in a list and joining once instead of slow string concatenation.',
    tasks: ['Write the run length before the character', 'Reset the counter for the next run', 'Run both strings and match the encodings'],
    code: `# Algorithms — Run-length encoding
# "AAAB" -> "3A1B"; runs longer than 9 are split.

def run_length(text):
    ???

print(run_length("AAAAAAAAAAAAABBCCCCDD"))
print(run_length("aA"))
`,
    codeIncludes: [],
    printPatterns: ['^9A4A2B4C2D$', '^1a1A$'],
    hints: ['Each part is the run length followed by the character: put count in the f-string.', 'A new run starts with one character, so count goes back to 1.'],
    predict: { prompt: 'Why loop to len(text) + 1?', answer: 'The extra step flushes the final run', distractors: ['To skip the first character', 'Python ranges exclude the start'] },
    compare: { note: 'Adding to a string in a loop copies it each time; a list joined once is linear.', wrong: 'encoded += str(count) + ch', fixed: 'parts.append(f"{count}{ch}")\nreturn "".join(parts)' },
    stretch: 'Stretch: write run_length_decode that turns "9A4A2B" back into the original text, and assert decode(encode(s)) == s for both examples.',
  }),
  algo({
    id: 'algo-binary-search',
    number: 70,
    topic: 'Binary search',
    goal: 'Halve the search range on every comparison so the index of 33 prints 3 and a missing value prints -1, never scanning the whole sorted list.',
    why: 'Binary search turns a million-item scan into about twenty comparisons. Getting the bounds right — mid + 1 and mid - 1 — is exactly what interviewers watch for.',
    tasks: ['Drop the left half when the middle is too small', 'Drop the right half when the middle is too big', 'Run both searches and match 3 and -1'],
    code: `# Algorithms — Binary search
# Index of target in a sorted list, or -1.

def binary_search(nums, target):
    ???

nums = [0, 1, 21, 33, 45, 45, 61, 71, 72, 73]
print(binary_search(nums, 33))
print(binary_search(nums, 70))
`,
    codeIncludes: [],
    printPatterns: ['^3$', '^-1$'],
    hints: ['mid is already ruled out, so the new low is mid + 1.', 'Likewise the new high is mid - 1; using mid can loop forever.'],
    predict: { prompt: 'How many comparisons for a list of 1,000,000 items, at most?', answer: 'About 20', distractors: ['About 1,000', 'About 500,000'] },
    compare: { note: 'Setting low = mid can leave the range unchanged and loop forever.', wrong: 'low = mid', fixed: 'low = mid + 1' },
    stretch: 'Stretch: return the first index of a repeated value by continuing left after a match, and print 4 for target 45.',
  }),
  algo({
    id: 'algo-three-number-sort',
    number: 71,
    topic: 'Three number sort',
    goal: 'Sort three distinct values into a given order in one pass with low, mid and high pointers, printing [0, 0, 0, 1, 1, 1, -1, -1] without calling sorted.',
    why: 'This is the Dutch national flag problem: partition into three groups in place, O(n) time and O(1) memory. Quicksort’s three-way partition uses the same pointers.',
    tasks: ['Leave the middle value where it is and move on', 'Shrink high after swapping a last-group value to the end', 'Print the array in the requested order'],
    code: `# Algorithms — Three number sort (Dutch national flag)

def three_number_sort(array, order):
    """Sort array in place so its values follow order, in one pass."""
    ???

print(three_number_sort([1, 0, 0, -1, -1, 0, 1, 1], [0, 1, -1]))
`,
    codeIncludes: [],
    printPatterns: ['^\\[0, 0, 0, 1, 1, 1, -1, -1\\]$'],
    hints: ['Middle-group values already belong between low and high: compare with second.', 'The swapped value is now final at the end, so move high one step left.'],
    predict: { prompt: 'Why does mid not move after swapping with high?', answer: 'The value swapped in from the end is not checked yet', distractors: ['It would skip the first group', 'mid moves inside the swap'] },
    compare: { note: 'Counting then rewriting takes two passes; three pointers sort in one.', wrong: 'return sorted(array, key=order.index)', fixed: 'elif value == second:\n    mid += 1\nelse:\n    ...\n    high -= 1' },
    stretch: 'Stretch: print the array after every swap to watch the three regions grow, and count how many swaps the example needs.',
  }),
  algo({
    id: 'algo-merge-sort',
    number: 72,
    topic: 'Merge sort',
    goal: 'Split the list in half, sort each half recursively, and merge the two sorted halves, so [8, 5, 2, 9, 5, 6, 3] prints [2, 3, 5, 5, 6, 8, 9].',
    why: 'Merge sort is the O(n log n) sort interviewers expect you to write from scratch, and its merge step is the same two-pointer walk used for merging sorted lists and files.',
    tasks: ['Sort the right half recursively', 'Append whatever is left of the right half after merging', 'Print the sorted list'],
    code: `# Algorithms — Merge sort

def merge_sort(nums):
    """A new sorted list, by splitting in halves and merging."""
    ???

print(merge_sort([8, 5, 2, 9, 5, 6, 3]))
`,
    codeIncludes: [],
    printPatterns: ['^\\[2, 3, 5, 5, 6, 8, 9\\]$'],
    hints: ['The right half starts at middle: nums[middle:].', 'One side runs out first; the rest of the other side is already sorted, so append right[j:].'],
    predict: { prompt: 'Merge sort on n items takes…', answer: 'O(n log n) always', distractors: ['O(n²) in the worst case', 'O(n)'] },
    compare: { note: '<= keeps equal items in their original order, which makes the sort stable.', wrong: 'if left[i] < right[j]:', fixed: 'if left[i] <= right[j]:' },
    stretch: 'Stretch: count inversions (pairs out of order) by adding len(left) - i each time a right item is taken first, and print 11 for the example.',
  }),
  algo({
    id: 'algo-validate-bst',
    number: 73,
    topic: 'Validate a BST',
    goal: 'Pass down the allowed range for every node so each value must fit between its ancestors’ limits, printing True for the valid tree and False when 11 hides in the left subtree.',
    why: 'Checking only a node’s direct children misses a value that breaks a limit set higher up. Carrying low and high bounds down the recursion is the reliable O(n) check.',
    tasks: ['Cap the left subtree at the current value', 'Start the right subtree at the current value', 'Run both trees and match True, False'],
    code: `# Algorithms — Validate a binary search tree
${TREE_NODE}
def is_bst(node, low=float("-inf"), high=float("inf")):
    """Is every left subtree smaller and every right subtree at least as large?"""
    ???

good = Node(10, Node(5, Node(2), Node(5)), Node(15, Node(13), Node(22)))
bad = Node(10, Node(5, Node(2), Node(11)), Node(15))
print(is_bst(good))
print(is_bst(bad))
`,
    codeIncludes: [],
    printPatterns: ['^True$', '^False$'],
    hints: ['Everything on the left must be smaller than this node: its high becomes node.value.', 'Everything on the right must be at least this node: its low becomes node.value.'],
    predict: { prompt: 'In the bad tree, 11 is the right child of 5. Why is it invalid?', answer: 'It sits left of 10 but is bigger than 10', distractors: ['11 is bigger than its parent 5', 'Right children must be leaves'] },
    compare: { note: 'Parent-only checks accept the bad tree; bounds from every ancestor reject it.', wrong: 'return node.left.value < node.value < node.right.value', fixed: 'return is_bst(node.left, low, node.value) and is_bst(node.right, node.value, high)' },
    stretch: 'Stretch: write an in-order traversal and check the values come out sorted — a second way to validate a BST — and print both answers side by side.',
  }),
  algo({
    id: 'algo-invert-tree',
    number: 74,
    topic: 'Invert a binary tree',
    goal: 'Swap every node’s left and right child, then recurse into both, so the level-order listing changes from [1, 2, 3, 4, 5, 6, 7] to [1, 3, 2, 7, 6, 5, 4].',
    why: 'Inverting a tree is the shortest test of whether you can think recursively about trees: do the work at one node, trust the recursion for the children.',
    tasks: ['Swap the two children in one assignment', 'Recurse into both children', 'Print the inverted tree level by level'],
    code: `# Algorithms — Invert a binary tree
${TREE_NODE}
def invert(node):
    """Mirror the tree: swap left and right at every node. Return the root."""
    ???

def level_order(node):
    queue, values = [node], []
    while queue:
        current = queue.pop(0)
        if current:
            values.append(current.value)
            queue += [current.left, current.right]
    return values

tree = Node(1, Node(2, Node(4), Node(5)), Node(3, Node(6), Node(7)))
print(level_order(invert(tree)))
`,
    codeIncludes: [],
    printPatterns: ['^\\[1, 3, 2, 7, 6, 5, 4\\]$'],
    hints: ['Python swaps two values in one line: a, b = b, a.', 'So the new left is node.right and the new right is node.left.'],
    predict: { prompt: 'After inverting, the leftmost leaf is…', answer: '7', distractors: ['4', '6'] },
    compare: { note: 'Two separate assignments overwrite one child before it is read.', wrong: 'node.left = node.right\nnode.right = node.left', fixed: 'node.left, node.right = node.right, node.left' },
    stretch: 'Stretch: rewrite invert without recursion using a queue of nodes, and confirm it prints the same level order.',
  }),
  algo({
    id: 'algo-tree-diameter',
    number: 75,
    topic: 'Binary tree diameter',
    goal: 'Compute each subtree’s height once and record the longest path through every node, so the example tree prints a diameter of 6 even though the path skips the root.',
    why: 'Many tree answers need two things from each child at once — here its height and the best path so far. Returning one and tracking the other gives O(n) instead of recomputing heights.',
    tasks: ['Record the path through this node as left + right', 'Return this subtree’s height', 'Print the diameter'],
    code: `# Algorithms — Binary tree diameter
# Longest path (in edges) between any two nodes.
${TREE_NODE}
def diameter(root):
    ???

tree = Node(1, Node(3, Node(7, Node(8, Node(9))), Node(4, None, Node(5, None, Node(6)))), Node(2))
print(diameter(tree))
`,
    codeIncludes: [],
    printPatterns: ['^6$'],
    hints: ['The longest path through a node goes down both sides: left + right edges.', 'A node’s height is one more than its taller child: 1 + max(left, right).'],
    predict: { prompt: 'Must the longest path go through the root?', answer: 'No — here it bends at node 3', distractors: ['Yes, always', 'Only in balanced trees'] },
    compare: { note: 'Calling a separate height() at every node recomputes subtrees: O(n²).', wrong: 'return max(height(n.left) + height(n.right), diameter(n.left), diameter(n.right))', fixed: 'best = max(best, left + right)\nreturn 1 + max(left, right)' },
    stretch: 'Stretch: also record which node the best path bends at, and print 3 for the example tree.',
  }),
  algo({
    id: 'algo-river-sizes',
    number: 76,
    topic: 'River sizes (connected areas)',
    goal: 'Flood-fill every unvisited 1 in the grid with an explicit stack, counting the cells in each connected river, and print the sorted sizes [1, 2, 2, 2, 5].',
    why: 'Counting islands, rooms or connected pixels is graph traversal on a grid. Marking cells as seen when you push them stops double counting and keeps it O(rows × cols).',
    tasks: ['Mark the neighbour as seen when you find it', 'Push the neighbour onto the stack to explore later', 'Print the sorted river sizes'],
    code: `# Algorithms — River sizes
# 1 = water. Rivers connect up, down, left and right.

def river_sizes(grid):
    ???

grid = [
    [1, 0, 0, 1, 0],
    [1, 0, 1, 0, 0],
    [0, 0, 1, 0, 1],
    [1, 0, 1, 0, 1],
    [1, 0, 1, 1, 0],
]
print(river_sizes(grid))
`,
    codeIncludes: [],
    printPatterns: ['^\\[1, 2, 2, 2, 5\\]$'],
    hints: ['Cells are stored as (row, col) tuples, so add (nr, nc).', 'The same tuple goes on the stack so its neighbours are explored next.'],
    predict: { prompt: 'Why mark a cell seen when pushing, not when popping?', answer: 'Otherwise the same cell can be pushed twice and counted twice', distractors: ['It is faster to type', 'Popping order would change the sizes'] },
    compare: { note: 'Recursion can hit Python’s depth limit on a big grid; an explicit stack cannot.', wrong: 'def dfs(r, c):\n    ...\n    dfs(r + 1, c)', fixed: 'stack = [(r, c)]\nwhile stack:\n    cr, cc = stack.pop()' },
    stretch: 'Stretch: allow diagonal connections by adding the four diagonal neighbours, and print the new sizes to see which rivers merge.',
  }),
  algo({
    id: 'algo-cycle-in-graph',
    number: 77,
    topic: 'Cycle in a directed graph',
    goal: 'Colour nodes white, grey or black during depth-first search and report a cycle when an edge reaches a grey node, printing True for the first graph and False for the second.',
    why: 'Deadlock detection, build-order checks and import loops all ask “is there a cycle?”. Grey means “on the current path”, so an edge back to grey closes a loop.',
    tasks: ['Report a cycle when an edge reaches a grey node', 'Mark the node black when it is finished', 'Run both graphs and match True, False'],
    code: `# Algorithms — Cycle in a directed graph
# edges[i] lists the nodes that i points to.

def has_cycle(edges):
    ???

print(has_cycle([[1, 3], [2, 3, 4], [0], [], [2, 5], []]))
print(has_cycle([[1, 2], [2], []]))
`,
    codeIncludes: [],
    printPatterns: ['^True$', '^False$'],
    hints: ['Grey nodes are still on the current path; reaching one again means a loop.', 'Once all its edges are explored, the node is done: colour it BLACK.'],
    predict: { prompt: 'In [[1, 2], [2], []], node 2 is reached twice. Is that a cycle?', answer: 'No — two paths meet, but nothing loops back', distractors: ['Yes, any repeat is a cycle', 'Only if 2 has edges'] },
    compare: { note: 'A single “visited” set flags the diamond 0→1→2, 0→2 as a cycle by mistake.', wrong: 'if nxt in visited:\n    return True', fixed: 'if color[nxt] == GREY:\n    return True' },
    stretch: 'Stretch: return the cycle itself by keeping the current path in a list, and print [0, 1, 2, 0] for the first graph.',
  }),
  algo({
    id: 'algo-dijkstra',
    number: 78,
    topic: "Dijkstra's shortest paths",
    goal: 'Pop the closest unfinished node from a heap, relax its edges, and push improved distances, printing [0, 7, 13, 27, 10, -1] with -1 for the unreachable node.',
    why: 'Routing, maps and network latency all use Dijkstra. The heap always hands you the closest node, so once popped its distance is final — as long as no edge weight is negative.',
    tasks: ['Compute the distance through the current node', 'Push the improved distance with its node', 'Print every shortest distance'],
    code: `# Algorithms — Dijkstra's algorithm
# edges[i] = [[neighbour, weight], ...]

import heapq

def dijkstra(start, edges):
    ???

edges = [[[1, 7]], [[2, 6], [3, 20], [4, 3]], [[3, 14]], [[4, 2]], [], []]
print(dijkstra(0, edges))
`,
    codeIncludes: [],
    printPatterns: ['^\\[0, 7, 13, 27, 10, -1\\]$'],
    hints: ['Going to nxt through node costs the distance so far plus the edge: d + weight.', 'The heap orders by its first item, so push (candidate, nxt).'],
    predict: { prompt: 'Why skip a popped entry when d > dist[node]?', answer: 'It is an old, longer entry for a node already improved', distractors: ['The node is unreachable', 'Negative weights'] },
    compare: { note: 'Plain BFS ignores weights; the heap always expands the cheapest node first.', wrong: 'queue = deque([start])', fixed: 'heap = [(0, start)]\nd, node = heapq.heappop(heap)' },
    stretch: 'Stretch: keep a previous-node list and print the actual path to node 3, [0, 1, 2, 3] or [0, 1, 3], whichever is shortest.',
  }),
  algo({
    id: 'algo-staircase',
    number: 79,
    topic: 'Staircase traversal',
    goal: 'Count the ways to climb a staircase taking 1 to max_steps at a time by summing the ways to reach the previous steps, printing 5 and then 274.',
    why: 'This is the gentlest dynamic-programming problem: today’s answer is built from smaller answers you already stored. Plain recursion recomputes them and takes exponential time.',
    tasks: ['Add the ways to reach the step you jumped from', 'Return the ways to reach the top', 'Run both staircases and match 5 and 274'],
    code: `# Algorithms — Staircase traversal
# Ways to climb height steps taking 1..max_steps at a time.

def ways(height, max_steps):
    ???

print(ways(4, 2))
print(ways(10, 3))
`,
    codeIncludes: [],
    printPatterns: ['^5$', '^274$'],
    hints: ['Every way to reach step - jump becomes a way to reach step.', 'The table is filled up to height, the top of the stairs.'],
    predict: { prompt: 'With max_steps = 2, the counts follow which sequence?', answer: 'Fibonacci', distractors: ['Powers of two', 'Squares'] },
    compare: { note: 'Naive recursion solves the same smaller staircase many times.', wrong: 'return sum(ways(height - j, k) for j in range(1, k + 1))', fixed: 'ways_to[step] += ways_to[step - jump]' },
    stretch: 'Stretch: use a sliding window sum so each step costs O(1) instead of O(max_steps), and confirm both prints stay the same.',
  }),
  algo({
    id: 'algo-house-robber',
    number: 80,
    topic: 'Max subset sum, no adjacent',
    goal: 'Keep two running bests — taking or skipping the current value — so no two chosen values are neighbours, printing 330 for the example and 0 for an empty list.',
    why: 'Known as “house robber”, it is the classic take-or-skip DP. Two variables replace the whole table, which is the space optimisation interviewers like to see.',
    tasks: ['Taking this value adds it to the best that skipped the previous one', 'Skipping keeps the better of the two previous bests', 'Run both cases and match 330 and 0'],
    code: `# Algorithms — Max subset sum with no adjacent values

def max_no_adjacent(values):
    """Largest sum of values with no two neighbours both taken."""
    ???

print(max_no_adjacent([75, 105, 120, 75, 90, 135]))
print(max_no_adjacent([]))
`,
    codeIncludes: [],
    printPatterns: ['^330$', '^0$'],
    hints: ['If you take this value, the previous one was skipped: skip + value.', 'If you skip it, keep whichever previous choice was better: max(take, skip).'],
    predict: { prompt: 'Which values make 330 in the example?', answer: '75 + 120 + 135', distractors: ['105 + 75 + 135', '105 + 90 + 135'] },
    compare: { note: 'Updating take first would feed the new take into skip; the tuple uses old values for both.', wrong: 'take = skip + value\nskip = max(take, skip)', fixed: 'take, skip = skip + value, max(take, skip)' },
    stretch: 'Stretch: make the houses a circle (first and last are neighbours) by running the function twice — without the first, then without the last — and print the larger.',
  }),
  algo({
    id: 'algo-ways-to-change',
    number: 81,
    topic: 'Number of ways to make change',
    goal: 'Fill a table of ways for every amount, one coin type at a time, so 6 with [1, 5] prints 2 and 10 with [1, 5, 10, 25] prints 4.',
    why: 'Looping coins outside and amounts inside counts combinations, not orderings — 1+5 and 5+1 count once. Swapping the loops is the most common bug in this question.',
    tasks: ['Start each coin at the smallest amount it can make', 'Add the ways to make the remaining amount', 'Run both cases and match 2 and 4'],
    code: `# Algorithms — Number of ways to make change

def ways_to_make_change(amount, coins):
    """How many coin combinations add up to amount (order does not matter)?"""
    ???

print(ways_to_make_change(6, [1, 5]))
print(ways_to_make_change(10, [1, 5, 10, 25]))
`,
    codeIncludes: [],
    printPatterns: ['^2$', '^4$'],
    hints: ['A coin cannot make an amount smaller than itself, so start at coin.', 'Using one coin leaves total - coin to make in any way already counted.'],
    predict: { prompt: 'If the loops are swapped (amount outside, coin inside) you count…', answer: 'Orderings, so 1+5 and 5+1 both count', distractors: ['The same combinations', 'Only single-coin answers'] },
    compare: { note: 'Coins outside means each combination is built in one fixed coin order.', wrong: 'for total in range(1, amount + 1):\n    for coin in coins: ...', fixed: 'for coin in coins:\n    for total in range(coin, amount + 1): ...' },
    stretch: 'Stretch: print the whole ways table for amount 10 after each coin to watch how adding the 5 and 10 coins changes the counts.',
  }),
  algo({
    id: 'algo-levenshtein',
    number: 82,
    topic: 'Levenshtein distance',
    goal: 'Compute the minimum inserts, deletes and substitutions between two strings with one rolling table row, printing 2 for "abc" → "yabd" and 3 for "kitten" → "sitting".',
    why: 'Edit distance powers spell checkers, fuzzy search and diff tools. It is the standard two-string DP grid, and keeping only the previous row cuts memory to O(len(b)).',
    tasks: ['Copy the diagonal value when the characters match', 'Roll the current row into prev for the next character', 'Run both pairs and match 2 and 3'],
    code: `# Algorithms — Levenshtein distance

def edit_distance(a, b):
    """Fewest inserts, deletes or replacements that turn a into b."""
    ???

print(edit_distance("abc", "yabd"))
print(edit_distance("kitten", "sitting"))
`,
    codeIncludes: [],
    printPatterns: ['^2$', '^3$'],
    hints: ['Matching characters cost nothing: take the diagonal, prev[j - 1].', 'The row you just filled becomes the previous row for the next character of a.'],
    predict: { prompt: 'The three values in min() stand for…', answer: 'Delete, insert and substitute', distractors: ['Three previous characters', 'Left, right and middle halves'] },
    compare: { note: 'The full grid is O(len(a) × len(b)) memory; two rows are enough.', wrong: 'grid = [[0] * (len(b) + 1) for _ in range(len(a) + 1)]', fixed: 'prev = list(range(len(b) + 1))\n...\nprev = current' },
    stretch: 'Stretch: adapt it to longest common subsequence (+1 on match, max of left and up otherwise) and print 4 for "ZXVVYZW" and "XKYKZPW".',
  }),
  algo({
    id: 'algo-knapsack',
    number: 83,
    topic: '0/1 knapsack',
    goal: 'Fill a best-value table for every capacity, looping capacities downwards so each item is used at most once, printing 10 and then 220 for the second item set.',
    why: 'Knapsack is the template for “choose items under a budget” — resource allocation, batching, feature selection. The downward loop is the detail that keeps each item single-use.',
    tasks: ['Stop the capacity loop at the item’s weight', 'Add the item’s value to the best for the remaining room', 'Run both item sets and match 10 and 220'],
    code: `# Algorithms — 0/1 knapsack
# items = [[value, weight], ...]; each item at most once.

def knapsack(items, capacity):
    ???

print(knapsack([[1, 2], [4, 3], [5, 6], [6, 7]], 10))
print(knapsack([[60, 10], [100, 20], [120, 30]], 50))
`,
    codeIncludes: [],
    printPatterns: ['^10$', '^220$'],
    hints: ['A room smaller than the item cannot hold it, so stop at weight.', 'Taking the item adds its value to the best you could do with room - weight left.'],
    predict: { prompt: 'Looping room upwards instead would…', answer: 'Let the same item be used many times', distractors: ['Give the same answer', 'Skip the first item'] },
    compare: { note: 'Going upwards reads values already updated for this item, turning 0/1 into unlimited.', wrong: 'for room in range(weight, capacity + 1):', fixed: 'for room in range(capacity, weight - 1, -1):' },
    stretch: 'Stretch: also return which items were chosen by keeping a 2D table, and print [1, 3] (the 4 and 6 value items) for the first case.',
  }),
  algo({
    id: 'algo-remove-kth-from-end',
    number: 84,
    topic: 'Remove kth node from end',
    goal: 'Move a fast pointer k steps ahead, then move both until fast reaches the end, and unlink the node after slow, printing the list without 6 and an empty list for [1].',
    why: 'Fast and slow pointers find positions in one pass without knowing the length. A dummy head node removes the special case where the first node is the one to delete.',
    tasks: ['Move slow forward together with fast', 'Skip over the node after slow', 'Run both lists and match the results'],
    code: `# Algorithms — Remove the kth node from the end

class ListNode:
    def __init__(self, value, next=None):
        self.value, self.next = value, next

def build(values):
    head = None
    for value in reversed(values):
        head = ListNode(value, head)
    return head

def to_list(head):
    out = []
    while head:
        out.append(head.value)
        head = head.next
    return out

def remove_kth_from_end(head, k):
    """Remove the kth node from the end and return the head."""
    ???

print(to_list(remove_kth_from_end(build([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]), 4)))
print(to_list(remove_kth_from_end(build([1]), 1)))
`,
    codeIncludes: [],
    printPatterns: ['^\\[0, 1, 2, 3, 4, 5, 7, 8, 9\\]$', '^\\[\\]$'],
    hints: ['Both pointers advance one node per step: slow becomes slow.next.', 'To remove the node after slow, point slow past it: slow.next.next.'],
    predict: { prompt: 'Why start both pointers at a dummy node?', answer: 'So removing the first node needs no special case', distractors: ['To make the list longer', 'Python lists need it'] },
    compare: { note: 'Counting the length first takes two passes; the k-step gap does it in one.', wrong: 'n = len(to_list(head))\n# walk again to n - k', fixed: 'for _ in range(k):\n    fast = fast.next\nwhile fast.next:\n    fast, slow = fast.next, slow.next' },
    stretch: 'Stretch: find the middle node with the same idea — fast moves two steps, slow one — and print 5 for the ten-node list.',
  }),
  algo({
    id: 'algo-reverse-polish',
    number: 85,
    topic: 'Reverse Polish notation',
    goal: 'Evaluate a postfix expression with a stack: push numbers, and on an operator pop the right then the left operand, printing 2 for the first expression and 6 for the second.',
    why: 'Calculators, compilers and query engines evaluate expressions with a stack. Popping in the right order matters because subtraction and division are not symmetric.',
    tasks: ['Pop the left operand after the right one', 'Push each number as an int', 'Run both expressions and match 2 and 6'],
    code: `# Algorithms — Reverse Polish notation
# "3 4 +" means 3 + 4. Division truncates toward zero.

def evaluate_rpn(tokens):
    ???

print(evaluate_rpn(["50", "3", "17", "+", "2", "-", "/"]))
print(evaluate_rpn(["4", "13", "5", "/", "+"]))
`,
    codeIncludes: [],
    printPatterns: ['^2$', '^6$'],
    hints: ['The left operand was pushed earlier, so it is the next one on the stack: stack.pop().', 'Tokens are strings; convert numbers with int(token) before pushing.'],
    predict: { prompt: 'For ["8", "2", "-"], popping in the wrong order gives…', answer: '-6 instead of 6', distractors: ['6 either way', 'An error'] },
    compare: { note: 'The first pop is the right operand; swapping them breaks - and /.', wrong: 'left = stack.pop()\nright = stack.pop()', fixed: 'right = stack.pop()\nleft = stack.pop()' },
    stretch: 'Stretch: print the stack after every token to trace the evaluation, then add support for a "^" power operator.',
  }),
  algo({
    id: 'algo-permutations',
    number: 86,
    topic: 'Permutations',
    goal: 'Build every ordering by choosing one remaining item at a time and recursing on the rest, printing the six permutations of [1, 2, 3] and 24 for four items.',
    why: 'Permutations are the backtracking template for ordering problems — scheduling, routes, anagrams. The tree has n! leaves, so it is also the example of when brute force is the only option.',
    tasks: ['Save a finished ordering when nothing is left', 'Recurse without the chosen item', 'Print the six orderings and the count 24'],
    code: `# Algorithms — Permutations

def permutations(items):
    """Every ordering of items, as a list of lists."""
    ???

print(permutations([1, 2, 3]))
print(len(permutations([1, 2, 3, 4])))
`,
    codeIncludes: [],
    printPatterns: ['^\\[\\[1, 2, 3\\], \\[1, 3, 2\\], \\[2, 1, 3\\], \\[2, 3, 1\\], \\[3, 1, 2\\], \\[3, 2, 1\\]\\]$', '^24$'],
    hints: ['When remaining is empty, path holds one full ordering.', 'Everything except item i: remaining[:i] + remaining[i + 1:].'],
    predict: { prompt: 'How many permutations do 6 items have?', answer: '720', distractors: ['36', '64'] },
    compare: { note: 'path + [item] makes a new list, so saved results are never changed by later steps.', wrong: 'path.append(item)\nbuild(path, ...)\n# no pop', fixed: 'build(path + [item], remaining[:i] + remaining[i + 1:])' },
    stretch: 'Stretch: generate only the permutations of "aab" without duplicates by skipping an item equal to one already tried at this level, and print 3 results.',
  }),
]
