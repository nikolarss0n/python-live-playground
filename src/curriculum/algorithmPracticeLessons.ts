import type { LessonDraft } from '../examples'
import { practice } from './studyBookPracticeLessons'

/**
 * Algorithm practice: classic, frequently asked interview problems that the interview-pattern lessons do not already
 * cover. Puzzle-style problems that rarely appear in real interviews were left out. Each function body starts empty
 * (one ???) so the learner writes the algorithm; the Hint pill climbs from the idea to the shape of the code.
 */
const algo = (spec: Omit<Parameters<typeof practice>[0], 'difficulty' | 'chapter' | 'bookChapter'>): LessonDraft => {
  return practice({ ...spec, difficulty: 'intermediate', chapter: 'Algorithm practice', bookChapter: 'dsa-sql' })
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
    goal: 'Find two values totaling target in one pass using a set of earlier values. Done when Results shows [11, -1] for the first case and [] when no pair exists.',
    why: 'The nested-loop answer is O(n²). Remembering what you have seen turns “is there a partner?” into an O(1) lookup, the move behind most hash-map interview answers.',
    tasks: ['Compute the partner each number needs', 'Remember the current number after checking it', 'Run both cases and match the printed pairs'],
    taskInstructions: [
      'Inside two_sum, subtract each current value from target and look for that partner in a set of earlier values. The first case should find 11 paired with -1.',
      'In two_sum\'s loop, add the current value to the set only after checking for its partner. Return an empty list if the loop finishes without finding a pair.',
      'Read both two_sum outputs. Expect [11, -1] and []; a pair from the second call would claim two supplied values can total 100.',
    ],
    code: `# Algorithms — Two number sum
# Return the two numbers that add up to target, or [] if none do.

def two_sum(nums, target):
    # Start an empty set of numbers seen so far
    #
    # For each number:
    #     Calculate the partner it needs to reach the target
    #
    #     If the partner is in the set:
    #         Return the partner and the number
    #
    #     Add the number to the set
    #
    # Return an empty list
    ???

print(two_sum([3, 5, -4, 8, 11, 1, -1, 6], 10))
print(two_sum([1, 2, 3], 100))
`,
    codeIncludes: [],
    printPatterns: ['^\\[11, -1\\]$', '^\\[\\]$'],
    hints: ['The partner of a number is whatever is missing to reach target: target - number.', 'Add the number only after the check, or it could pair with itself.'],
    predict: { prompt: 'With a set of seen numbers, the whole search takes…', answer: 'One pass, O(n)', distractors: ['Two passes, O(n²)', 'O(n log n) because of sorting'] },
    compare: { note: 'The double loop tries every pair; the set answers “have I seen the partner?” instantly.', wrong: 'for i in range(len(nums)):\n    for j in range(i + 1, len(nums)):\n        if nums[i] + nums[j] == target:\n            return [nums[i], nums[j]]', fixed: 'needed = target - number\nif needed in seen:\n    return [needed, number]\nseen.add(number)' },
    stretch: 'Stretch: return the indices instead of the values by storing each number in a dict that maps value to index, and print [4, 6] for the first case.',
  }),
  algo({
    id: 'algo-validate-subsequence',
    number: 63,
    topic: 'Validate subsequence',
    goal: 'Walk the array once, advancing the sequence pointer only when a value matches. Done when Results shows True for [1, 6, -1, 10] and False for the out-of-order [1, 10, 6].',
    why: 'A subsequence keeps order but may skip items. One pointer that only moves forward checks it in O(n) — the same idea used when diffing text or matching events in logs.',
    tasks: ['Move the sequence pointer forward on a match', 'Report success only when every item was matched', 'Run both cases and match True, False'],
    taskInstructions: [
      'In is_subsequence, track the next unmatched sequence index and advance only when the current array value matches it. The first call should return True.',
      'After walking array, compare the matched count with the sequence length, guarding against indexing after the final match. The out-of-order sequence should return False.',
      'Read the two Boolean results. Expect True then False; two True values would mean membership was checked without preserving sequence order.',
    ],
    code: `# Algorithms — Validate subsequence
# Is every item of sequence in array, in the same order?

def is_subsequence(array, sequence):
    # Start with zero sequence items matched
    #
    # For each value in the array:
    #     If it equals the next unmatched sequence item:
    #         Count one more match
    #
    # Return whether every sequence item was matched
    ???

print(is_subsequence([5, 1, 22, 25, 6, -1, 8, 10], [1, 6, -1, 10]))
print(is_subsequence([5, 1, 22, 25, 6, -1, 8, 10], [1, 10, 6]))
`,
    codeIncludes: [],
    printPatterns: ['^True$', '^False$'],
    hints: ['Each match uses up one item of the sequence, so add one to matched_count.', 'The sequence is fully found when matched_count has reached its length.'],
    predict: { prompt: '[1, 10, 6] fails because…', answer: '10 comes after 6 in the array, so order breaks', distractors: ['6 is missing from the array', 'Subsequences must be adjacent'] },
    compare: { note: 'Membership checks ignore order; the pointer enforces it.', wrong: 'return all(x in array for x in sequence)', fixed: 'if matched_count < len(sequence) and value == sequence[matched_count]:\n    matched_count += 1\nreturn matched_count == len(sequence)' },
    stretch: 'Stretch: return the index in array where each sequence item was matched, and print [1, 4, 5, 7] for the first case to show the order explicitly.',
  }),
  algo({
    id: 'algo-three-sum',
    number: 64,
    topic: 'Three number sum',
    goal: 'Find unique zero-sum triplets by fixing one value and using a set for the other pair. Done when Results shows [[-8, 2, 6], [-8, 3, 5], [-6, 1, 5]], with every triplet sorted and listed once.',
    why: 'Three-sum is two-sum inside a loop. A set answers “have I seen the third number?” instantly, giving O(n²) instead of trying all O(n³) triplets.',
    tasks: ['Calculate the third number each pair needs', 'Save each sorted triplet only once', 'Print every triplet in sorted order'],
    taskInstructions: [
      'Inside three_sum, nest the second-number scan under each first number and calculate what remains of target. The first valid triplet in sorted Results should be [-8, 2, 6].',
      'In three_sum, store each found triplet in a sorted, duplicate-safe form before collecting the final list. Results should contain three distinct triplets totaling zero.',
      'Sort the saved triplets before returning from three_sum. Results should show [-8, 2, 6], [-8, 3, 5] and [-6, 1, 5], in that order.',
    ],
    code: `# Algorithms — Three number sum
# Every triplet that adds up to target, each sorted.

def three_sum(nums, target):
    # For each first number:
    #     Start an empty set
    #
    #     For each second number after it:
    #         Calculate the third number needed
    #
    #         If the third number is in the set:
    #             Save the triplet if it isn’t already saved
    #
    #         Add the second number to the set
    #
    # Return the saved triplets, sorted
    ???

print(three_sum([12, 3, 1, 2, -6, 5, -8, 6], 0))
`,
    codeIncludes: [],
    printPatterns: ['^\\[\\[-8, 2, 6\\], \\[-8, 3, 5\\], \\[-6, 1, 5\\]\\]$'],
    hints: ['The third number is whatever is missing: target - first_number - second_number.', 'Sort each triplet before saving it, so the same three numbers always look the same and `not in results` catches repeats.'],
    predict: { prompt: 'Fixing one number and using a set for the other two takes…', answer: 'O(n²): one loop inside another', distractors: ['O(n³): three nested loops', 'O(n): one pass'] },
    compare: { note: 'Three nested loops cost O(n³); one loop plus two pointers costs O(n²).', wrong: 'for a in nums:\n    for b in nums:\n        for c in nums: ...', fixed: 'for second_number in nums[i + 1:]:\n    needed = target - first_number - second_number\n    if needed in seen: ...' },
    stretch: 'Stretch: skip duplicate values for i, left and right so [0, 0, 0, 0] prints [[0, 0, 0]] once instead of several identical triplets.',
  }),
  algo({
    id: 'algo-product-except-self',
    number: 65,
    topic: 'Array of products',
    goal: 'Build each answer from the products on its left and right, without division. Done when Results transforms [5, 1, 4, 2] into [8, 40, 10, 20].',
    why: 'Division breaks on zeros and is often banned in the question. Two sweeps — left products, then right products — is the standard prefix/suffix trick and runs in O(n).',
    tasks: ['Walk the indices from right to left', 'Grow the running right product by the current number', 'Print the products list'],
    taskInstructions: [
      'In array_of_products, first store the product to each position\'s left, then walk the indices backward with a separate running product. The first output slot should become 8.',
      'During the backward pass in array_of_products, apply the right product before multiplying it by the current number. The current value must stay excluded from its own slot.',
      'Return the products list from array_of_products and read Results. Expect [8, 40, 10, 20]; including the current number would incorrectly make every slot 40.',
    ],
    code: `# Algorithms — Array of products
# products[i] = product of every number except nums[i], no division.

def array_of_products(nums):
    # Start a list of 1s, one per number
    #
    # Walk left to right with a running product:
    #     Store the product of everything to the left
    #     Multiply the running product by the current number
    #
    # Walk right to left with a second running product:
    #     Multiply each slot by the product of everything to the right
    #     Multiply the running product by the current number
    #
    # Return the list
    ???

print(array_of_products([5, 1, 4, 2]))
`,
    codeIncludes: [],
    printPatterns: ['^\\[8, 40, 10, 20\\]$'],
    hints: ['The second pass goes backwards: range(len(nums) - 1, -1, -1).', 'After using right_product for an index, include nums[index] in it for the next index to the left.'],
    predict: { prompt: 'Why avoid total // nums[i]?', answer: 'A zero in the list makes division fail or lie', distractors: ['Division is slower than multiplication', 'Python has no integer division'] },
    compare: { note: 'Division needs a non-zero number; prefix and suffix products never divide.', wrong: 'total = math.prod(nums)\nreturn [total // n for n in nums]', fixed: 'for index in range(len(nums) - 1, -1, -1):\n    products[index] *= right_product\n    right_product *= nums[index]' },
    stretch: 'Stretch: run it on [0, 3, 4] and confirm it prints [12, 0, 0], a case where the division shortcut would crash.',
  }),
  algo({
    id: 'algo-kadane',
    number: 66,
    topic: "Kadane's maximum subarray",
    goal: 'Track the best sum ending at each position and the best seen overall. Done when Results shows 19 for the long example and -1, the largest value, for the all-negative list.',
    why: 'At each number you either extend the run or start fresh — whichever is bigger. That one decision finds the best contiguous sum in O(n) and appears in stock, signal and log problems.',
    tasks: ['Decide between starting fresh and extending the run', 'Keep the best run seen so far', 'Run both cases and match 19 and -1'],
    taskInstructions: [
      'In max_subarray, compare the current number alone with that number added to the previous running sum. The mixed-sign example should eventually find a run totaling 19.',
      'Keep a separate largest sum in max_subarray, initializing both sums from the first element. The all-negative case should return -1 rather than zero.',
      'Read the two max_subarray outputs. Expect 19 and -1; zero for the negative list means the algorithm allowed an empty run instead of choosing a supplied number.',
    ],
    code: `# Algorithms — Kadane's algorithm
# Largest sum of any contiguous run of numbers.

def max_subarray(nums):
    # Start the current sum and the best sum at the first number
    #
    # For each next number:
    #     Either extend the current run or start fresh at this number,
    #     whichever is bigger
    #     Keep the best sum seen so far
    #
    # Return the best sum
    ???

print(max_subarray([3, 5, -9, 1, 3, -2, 3, 4, 7, 2, -9, 6, 3, 1, -5, 4]))
print(max_subarray([-3, -1, -2]))
`,
    codeIncludes: [],
    printPatterns: ['^19$', '^-1$'],
    hints: ['Extending the run means current_sum + number; starting fresh means just number.', 'best_sum only changes when the current run beats it: max(best_sum, current_sum).'],
    predict: { prompt: 'For [-3, -1, -2] the answer is…', answer: '-1', distractors: ['0', '-6'] },
    compare: { note: 'Starting best at 0 wrongly returns 0 when every number is negative.', wrong: 'best_sum = 0\ncurrent_sum = 0', fixed: 'best_sum = nums[0]\ncurrent_sum = nums[0]' },
    stretch: 'Stretch: also return the start and end index of the best run and print them, so you can show which slice of the list gives 19.',
  }),
  algo({
    id: 'algo-palindrome',
    number: 67,
    topic: 'Palindrome check',
    goal: 'Compare characters from both ends moving inwards and stop at the first mismatch, so "abcdcba" and "racecar" print True and "python" prints False.',
    why: 'Two pointers from the ends check a palindrome in O(n) time and O(1) memory, and the same inward walk shows up in reversing arrays and in many string interview questions.',
    tasks: ['Compare the left character with the right one', 'Return True when the pointers meet without a mismatch', 'Run the three words and match the results'],
    taskInstructions: [
      'In is_palindrome, compare characters at opposite ends and return failure at the first mismatch. The word python should print False.',
      'Move both indices inward after a match and return success after the loop finishes. The two symmetric words should print True without indexing beyond the text.',
      'Read abcdcba, racecar and python. Expect True, True and False; rejecting either symmetric word suggests the pointers moved by different amounts.',
    ],
    code: `# Algorithms — Palindrome check

def is_palindrome(text):
    """Does text read the same forwards and backwards?"""
    # Start one index at the first character and one at the last
    #
    # While the indexes have not met:
    #     If the two characters differ:
    #         Return False
    #
    #     Move both indexes one step inwards
    #
    # Return True
    ???

for word in ["abcdcba", "racecar", "python"]:
    print(word, is_palindrome(word))
`,
    codeIncludes: [],
    printPatterns: ['^abcdcba True$', '^racecar True$', '^python False$'],
    hints: ['The character to compare with text[left_index] sits at right_index.', 'If the loop finishes, no pair differed, so the word is a palindrome.'],
    predict: { prompt: 'How much extra memory does the two-pointer check use?', answer: 'O(1): two integers', distractors: ['O(n): a reversed copy', 'O(log n)'] },
    compare: { note: 'Reversing works but builds a full copy; two pointers stop early and use no extra string.', wrong: 'return text == text[::-1]', fixed: 'while left_index < right_index:\n    if text[left_index] != text[right_index]:\n        return False' },
    stretch: 'Stretch: ignore case and non-letters so "A man, a plan, a canal: Panama" prints True, skipping characters with str.isalnum() as the pointers move.',
  }),
  algo({
    id: 'algo-longest-palindrome',
    number: 68,
    topic: 'Longest palindromic substring',
    goal: 'Expand around every centre — one character and between two characters — and keep the longest palindrome, printing "xyzzyx" and then "bb".',
    why: 'Every palindrome mirrors around its middle. Growing from each of the 2n − 1 centres finds them all in O(n²) without checking every substring, which would be O(n³).',
    tasks: ['Grow the right edge while both sides match', 'Slice the palindrome between the final edges', 'Run both strings and match the longest palindromes'],
    taskInstructions: [
      'Inside longest_palindrome, write a helper that moves both edges outward while their characters match and remain inside s. The first sample should find xyzzyx.',
      'When the helper stops, slice between the last matching edges, excluding the mismatching positions. The even-length cbbd example should return bb.',
      'Read both returned substrings. Expect xyzzyx and bb; a single b for cbbd means the search tried character centers but missed the gap between them.',
    ],
    code: `# Algorithms — Longest palindromic substring

def longest_palindrome(s):
    """The longest substring of s that is a palindrome."""
    # Start with an empty longest palindrome
    #
    # Write a helper that expands outwards from two indexes
    # while both characters match, and returns the palindrome between them
    #
    # For each center:
    #     Expand around one character (odd length)
    #     Expand around the gap after it (even length)
    #     Keep whichever palindrome is longest
    #
    # Return the longest palindrome
    ???

print(longest_palindrome("abaxyzzyxf"))
print(longest_palindrome("cbbd"))
`,
    codeIncludes: [],
    printPatterns: ['^xyzzyx$', '^bb$'],
    hints: ['Both edges move one step outwards each round.', 'The loop stops one step too far on each side, so the palindrome is s[left_index + 1:right_index].'],
    predict: { prompt: 'Why also try (center, center + 1)?', answer: 'Even-length palindromes like "zz" have no middle character', distractors: ['To handle the last character', 'It doubles the speed'] },
    compare: { note: 'Checking every substring repeats work; expanding reuses the mirror property.', wrong: 'for i in range(n):\n    for j in range(i, n):\n        if s[i:j+1] == s[i:j+1][::-1]: ...', fixed: 'while left_index >= 0 and right_index < len(s) and s[left_index] == s[right_index]:\n    left_index -= 1\n    right_index += 1' },
    stretch: 'Stretch: count how many palindromic substrings the string has by adding 1 every time the while loop matches, and print 12 for "abaxyzzyxf".',
  }),
  algo({
    id: 'algo-run-length',
    number: 69,
    topic: 'Run-length encoding',
    goal: 'Compress runs of the same character into count-plus-character pairs, capping each run at 9, so the example prints "9A4A2B4C2D" and "aA" prints "1a1A".',
    why: 'Run-length encoding is a classic string-building warm-up: it tests boundary handling at the end of the string, collecting parts in a list and joining once instead of slow string concatenation.',
    tasks: ['Write the run length before the character', 'Reset the counter for the next run', 'Run both strings and match the encodings'],
    taskInstructions: [
      'In run_length, append the count as text followed by its character whenever a run ends or reaches nine. The long A run should begin 9A4A.',
      'After writing a run in run_length, start the next count at one for the character already being examined. Remember to write the final run after the loop.',
      'Read both encodings. Expect 9A4A2B4C2D and 1a1A; a missing final pair means the last run was never written, while 2a would incorrectly ignore case.',
    ],
    code: `# Algorithms — Run-length encoding
# "AAAB" -> "3A1B"; runs longer than 9 are split.

def run_length(text):
    # Start an empty result, the first character as the run,
    # and a run length of zero
    #
    # For each character:
    #     If it continues the run and the run is shorter than 9:
    #         Count it
    #     Otherwise:
    #         Write the run length and character
    #         Start a new run with this character
    #
    # Write the last run
    # Return the result
    ???

print(run_length("AAAAAAAAAAAAABBCCCCDD"))
print(run_length("aA"))
`,
    codeIncludes: [],
    printPatterns: ['^9A4A2B4C2D$', '^1a1A$'],
    hints: ['Each part is the run length followed by the character: f"{run_length}{run_char}".', 'A new run starts with one character, so run_length goes back to 1.'],
    predict: { prompt: 'Why loop to len(text) + 1?', answer: 'The extra step flushes the final run', distractors: ['To skip the first character', 'Python ranges exclude the start'] },
    compare: { note: 'Forgetting the last run drops the final characters; write it once more after the loop.', wrong: 'for char in text:\n    ...\nreturn encoded', fixed: 'for char in text:\n    ...\nencoded += f"{run_length}{run_char}"\nreturn encoded' },
    stretch: 'Stretch: write run_length_decode that turns "9A4A2B" back into the original text, and assert decode(encode(s)) == s for both examples.',
  }),
  algo({
    id: 'algo-binary-search',
    number: 70,
    topic: 'Binary search',
    goal: 'Find a target\'s index by halving the sorted search range on each comparison. Done when Results shows index 3 for 33 and -1 for the missing value.',
    why: 'Binary search turns a million-item scan into about twenty comparisons. Getting the bounds right — mid + 1 and mid - 1 — is exactly what interviewers watch for.',
    tasks: ['Drop the left half when the middle is too small', 'Drop the right half when the middle is too big', 'Run both searches and match 3 and -1'],
    taskInstructions: [
      'Inside binary_search, move the lower index beyond the middle whenever nums at the middle is below target. Searching for 33 should return index 3.',
      'For a middle value above target, move the upper index before the middle. Return the missing marker once the range is empty; searching for 70 should finish with -1.',
      'Read the two search results. Expect 3 and -1; a hanging second call means the chosen middle position was not excluded from the next range.',
    ],
    code: `# Algorithms — Binary search
# Index of target in a sorted list, or -1.

def binary_search(nums, target):
    # Start with the whole list as the search range
    #
    # While the range is not empty:
    #     Look at the middle value
    #
    #     If it is the target:
    #         Return its index
    #     If it is too small:
    #         Search the right half
    #     Otherwise:
    #         Search the left half
    #
    # Return -1
    ???

nums = [0, 1, 21, 33, 45, 45, 61, 71, 72, 73]
print(binary_search(nums, 33))
print(binary_search(nums, 70))
`,
    codeIncludes: [],
    printPatterns: ['^3$', '^-1$'],
    hints: ['middle_index is already ruled out, so the new low_index is middle_index + 1.', 'Likewise the new high_index is middle_index - 1; using middle_index can loop forever.'],
    predict: { prompt: 'How many comparisons for a list of 1,000,000 items, at most?', answer: 'About 20', distractors: ['About 1,000', 'About 500,000'] },
    compare: { note: 'Setting low_index = middle_index can leave the range unchanged and loop forever.', wrong: 'low_index = middle_index', fixed: 'low_index = middle_index + 1' },
    stretch: 'Stretch: return the first index of a repeated value by continuing left after a match, and print 4 for target 45.',
  }),
  algo({
    id: 'algo-three-number-sort',
    number: 71,
    topic: 'Three number sort',
    goal: 'Sort three values in one pass using low, mid and high pointers, without calling sorted. Done when Results follows the requested order with [0, 0, 0, 1, 1, 1, -1, -1].',
    why: 'This is the Dutch national flag problem: partition into three groups in place, O(n) time and O(1) memory. Quicksort’s three-way partition uses the same pointers.',
    tasks: ['Leave the middle value where it is and move on', 'Shrink high after swapping a last-group value to the end', 'Print the array in the requested order'],
    taskInstructions: [
      'In three_number_sort, advance mid when array[mid] belongs to the second group in order. This keeps 1 values between the zeroes and negative ones.',
      'After swapping a last-group value to high, move high left but inspect the new array[mid] before advancing mid. Results should end with two -1 values.',
      'Return array from three_number_sort and inspect the groups. Expect [0, 0, 0, 1, 1, 1, -1, -1]; a stray middle value means a swapped-in element was skipped.',
    ],
    code: `# Algorithms — Three number sort (Dutch national flag)

def three_number_sort(array, order):
    """Sort array in place so its values follow order, in one pass."""
    # Read the first and second values from order
    # Start low and mid at the front, high at the back
    #
    # While mid has not passed high:
    #     If the value at mid is the first value:
    #         Swap it to low, move low and mid forward
    #     If it is the second value:
    #         Move mid forward
    #     Otherwise:
    #         Swap it to high, move high back
    #
    # Return the array
    ???

print(three_number_sort([1, 0, 0, -1, -1, 0, 1, 1], [0, 1, -1]))
`,
    codeIncludes: [],
    printPatterns: ['^\\[0, 0, 0, 1, 1, 1, -1, -1\\]$'],
    hints: ['Middle-group values already belong between low and high: compare with second_value.', 'The swapped value is now final at the end, so move high one step left.'],
    predict: { prompt: 'Why does mid not move after swapping with high?', answer: 'The value swapped in from the end is not checked yet', distractors: ['It would skip the first group', 'mid moves inside the swap'] },
    compare: { note: 'Counting then rewriting takes two passes; three pointers sort in one.', wrong: 'return sorted(array, key=order.index)', fixed: 'elif value == second_value:\n    mid += 1\nelse:\n    ...\n    high -= 1' },
    stretch: 'Stretch: print the array after every swap to watch the three regions grow, and count how many swaps the example needs.',
  }),
  algo({
    id: 'algo-merge-sort',
    number: 72,
    topic: 'Merge sort',
    goal: 'Sort both halves recursively and merge them into a new ordered list. Done when Results transforms [8, 5, 2, 9, 5, 6, 3] into [2, 3, 5, 5, 6, 8, 9].',
    why: 'Merge sort is the O(n log n) sort interviewers expect you to write from scratch, and its merge step is the same two-pointer walk used for merging sorted lists and files.',
    tasks: ['Sort the right half recursively', 'Append whatever is left of the right half after merging', 'Print the sorted list'],
    taskInstructions: [
      'In merge_sort, recurse on both slices around the midpoint, stopping for lists shorter than two. Both halves must be sorted before their first remaining items can be compared.',
      'After merging while both halves have items, append the unconsumed part of each half. Results should retain seven numbers, including both copies of 5.',
      'Return the merged list from merge_sort and read Results. Expect [2, 3, 5, 5, 6, 8, 9]; a missing final number usually means one half\'s leftover items were discarded.',
    ],
    code: `# Algorithms — Merge sort

def merge_sort(nums):
    """A new sorted list, by splitting in halves and merging."""
    # If the list has 0 or 1 items:
    #     Return it, it is already sorted
    #
    # Sort the left half and the right half recursively
    #
    # While both halves have items left:
    #     Move the smaller front item into the merged list
    #
    # Add whatever is left of either half
    # Return the merged list
    ???

print(merge_sort([8, 5, 2, 9, 5, 6, 3]))
`,
    codeIncludes: [],
    printPatterns: ['^\\[2, 3, 5, 5, 6, 8, 9\\]$'],
    hints: ['The right half starts at middle: nums[middle:].', 'One side runs out first; the rest of the other side is already sorted, so extend with right_half[right_index:].'],
    predict: { prompt: 'Merge sort on n items takes…', answer: 'O(n log n) always', distractors: ['O(n²) in the worst case', 'O(n)'] },
    compare: { note: '<= keeps equal items in their original order, which makes the sort stable.', wrong: 'if left_half[left_index] < right_half[right_index]:', fixed: 'if left_half[left_index] <= right_half[right_index]:' },
    stretch: 'Stretch: count inversions (pairs out of order) by adding len(left) - i each time a right item is taken first, and print 11 for the example.',
  }),
  algo({
    id: 'algo-validate-bst',
    number: 73,
    topic: 'Validate a BST',
    goal: 'Validate each tree node against limits inherited from all its ancestors. Done when Results shows True for the valid tree and False when 11 is hidden in the left subtree.',
    why: 'Checking only a node’s direct children misses a value that breaks a limit set higher up. Carrying low and high bounds down the recursion is the reliable O(n) check.',
    tasks: ['Cap the left subtree at the current value', 'Start the right subtree at the current value', 'Run both trees and match True, False'],
    taskInstructions: [
      'In is_bst, check that node.value is at least low and strictly below high, then pass the current value as the left subtree\'s upper limit. The bad tree\'s 11 should be rejected.',
      'For is_bst\'s right recursion, use the current value as the lower limit and retain the inherited upper limit. This allows a duplicate on the right; good should return True.',
      'Read the two is_bst outputs. Expect True then False; accepting bad means the test checked immediate parents without carrying an ancestor\'s limit down the tree.',
    ],
    code: `# Algorithms — Validate a binary search tree
${TREE_NODE}
def is_bst(node, low=float("-inf"), high=float("inf")):
    """Is every left subtree smaller and every right subtree at least as large?"""
    # If the node is empty:
    #     Return True
    #
    # If the value is outside the allowed range:
    #     Return False
    #
    # Check the left subtree with this value as its new upper limit
    # Check the right subtree with this value as its new lower limit
    # Return whether both are valid
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
    goal: 'Mirror a tree by swapping both children at every node. Done when Results changes the level-order list [1, 2, 3, 4, 5, 6, 7] to [1, 3, 2, 7, 6, 5, 4].',
    why: 'Inverting a tree is the shortest test of whether you can think recursively about trees: do the work at one node, trust the recursion for the children.',
    tasks: ['Swap the two children with a temporary variable', 'Recurse into both children', 'Print the inverted tree level by level'],
    taskInstructions: [
      'In invert, save one child before swapping node.left and node.right so neither link is lost. The level-order result should place 3 before 2.',
      'Call invert on both children after swapping, with an early return for an empty node. The next level should become 7, 6, 5, 4.',
      'Read level_order(invert(tree)) in Results. Expect [1, 3, 2, 7, 6, 5, 4]; unchanged grandchildren mean only the root was swapped.',
    ],
    code: `# Algorithms — Invert a binary tree
${TREE_NODE}
def invert(node):
    """Mirror the tree: swap left and right at every node. Return the root."""
    # If the node is empty:
    #     Return None
    #
    # Swap the left and right children
    # Invert both children the same way
    #
    # Return the node
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
    hints: ['Keep the old left child in original_left before you overwrite it.', 'Then the new left is node.right and the new right is original_left.'],
    predict: { prompt: 'After inverting, the leftmost leaf is…', answer: '7', distractors: ['4', '6'] },
    compare: { note: 'Two separate assignments overwrite one child before it is read.', wrong: 'node.left = node.right\nnode.right = node.left', fixed: 'original_left = node.left\nnode.left = node.right\nnode.right = original_left' },
    stretch: 'Stretch: rewrite invert without recursion using a queue of nodes, and confirm it prints the same level order.',
  }),
  algo({
    id: 'algo-tree-diameter',
    number: 75,
    topic: 'Binary tree diameter',
    goal: 'Calculate each subtree\'s height once and track the longest path through every node. Done when Results shows diameter 6 for the example, even though that path skips the root.',
    why: 'Many tree answers need two things from each child at once — here its height and the best path so far. Returning one and tracking the other gives O(n) instead of recomputing heights.',
    tasks: ['Measure the path through this node as left_height + right_height', 'Return this subtree’s height and best diameter', 'Print the diameter'],
    taskInstructions: [
      'Inside diameter, write a helper returning height and longest path for each subtree. Add the child heights for a path through the current node; the supplied tree should yield 6 edges.',
      'Return a pair from the helper: one more than the taller child, and the largest of the through-path and both child diameters. A longest path may stay below root.',
      'Read diameter(tree). Expect 6; a smaller value can mean only paths through the root were counted, while 7 would count nodes instead of edges.',
    ],
    code: `# Algorithms — Binary tree diameter
# Longest path (in edges) between any two nodes.
${TREE_NODE}
def diameter(root):
    # Write a helper that returns a node's height and best diameter:
    #     An empty node has height 0 and diameter 0
    #
    #     Get the height and diameter of both children
    #     The path through this node is the two heights added
    #     The height is one more than the taller child
    #     The diameter is the biggest of the path and both children's diameters
    #
    # Return the diameter of the root
    ???

tree = Node(1, Node(3, Node(7, Node(8, Node(9))), Node(4, None, Node(5, None, Node(6)))), Node(2))
print(diameter(tree))
`,
    codeIncludes: [],
    printPatterns: ['^6$'],
    hints: ['The longest path through a node goes down both sides: left_height + right_height edges.', 'A node’s height is one more than its taller child: 1 + max(left_height, right_height).'],
    predict: { prompt: 'Must the longest path go through the root?', answer: 'No — here it bends at node 3', distractors: ['Yes, always', 'Only in balanced trees'] },
    compare: { note: 'Calling a separate height() at every node recomputes subtrees: O(n²).', wrong: 'return max(height(n.left) + height(n.right), diameter(n.left), diameter(n.right))', fixed: 'path_through_node = left_height + right_height\nreturn height, max(path_through_node, left_diameter, right_diameter)' },
    stretch: 'Stretch: also record which node the best path bends at, and print 3 for the example tree.',
  }),
  algo({
    id: 'algo-river-sizes',
    number: 76,
    topic: 'River sizes (connected areas)',
    goal: 'Explore each unvisited water cell with a stack and count its connected river. Done when Results shows sorted river sizes [1, 2, 2, 2, 5].',
    why: 'Counting islands, rooms or connected pixels is graph traversal on a grid. Marking cells as seen when you push them stops double counting and keeps it O(rows × cols).',
    tasks: ['Mark the neighbour as seen when you find it', 'Push the neighbour onto the stack to explore later', 'Print the sorted river sizes'],
    taskInstructions: [
      'In river_sizes, save a water cell\'s coordinates in a visited set when it is first discovered. This prevents two neighboring cells from counting the same water twice.',
      'Add each unvisited up, down, left or right water neighbor to the exploration stack. Diagonal water cells should remain separate rivers in the printed sizes.',
      'Sort and return the collected sizes from river_sizes. Expect [1, 2, 2, 2, 5]; a larger merged river suggests diagonal cells were joined.',
    ],
    code: `# Algorithms — River sizes
# 1 = water. Rivers connect up, down, left and right.

def river_sizes(grid):
    # Start an empty set of visited cells and a list of sizes
    #
    # For each cell in the grid:
    #     Skip it if it is land or already visited
    #
    #     Start a stack with this cell and a river size of zero
    #     While the stack has cells:
    #         Pop a cell and count it
    #         Push every unvisited water neighbour
    #
    #     Save the river size
    #
    # Return the sizes, sorted
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
    hints: ['Cells are stored as (row, column) tuples, so add (next_row, next_column).', 'The same tuple goes on the stack so its neighbours are explored next.'],
    predict: { prompt: 'Why mark a cell seen when pushing, not when popping?', answer: 'Otherwise the same cell can be pushed twice and counted twice', distractors: ['It is faster to type', 'Popping order would change the sizes'] },
    compare: { note: 'Recursion can hit Python’s depth limit on a big grid; an explicit stack cannot.', wrong: 'def dfs(r, c):\n    ...\n    dfs(r + 1, c)', fixed: 'stack = [(row, column)]\nwhile stack:\n    current_row, current_column = stack.pop()' },
    stretch: 'Stretch: allow diagonal connections by adding the four diagonal neighbours, and print the new sizes to see which rivers merge.',
  }),
  algo({
    id: 'algo-cycle-in-graph',
    number: 77,
    topic: 'Cycle in a directed graph',
    goal: 'Detect directed cycles using white, grey and black node states during depth-first search. Done when Results shows True for the first graph and False for the second, detecting edges back to a grey node.',
    why: 'Deadlock detection, build-order checks and import loops all ask “is there a cycle?”. Grey means “on the current path”, so an edge back to grey closes a loop.',
    tasks: ['Report a cycle when an edge reaches a grey node', 'Mark the node black when it is finished', 'Run both graphs and match True, False'],
    taskInstructions: [
      'In has_cycle\'s visit helper, report success when an outgoing edge reaches a node on the current path. The first graph should return True because it leads back to node 0.',
      'Mark a node fully explored only after all its outgoing edges have been processed. The second graph should return False even though two routes can reach node 2.',
      'Read the two has_cycle results. Expect True then False; rejecting the second graph means a previously finished node was mistaken for one still on the current path.',
    ],
    code: `# Algorithms — Cycle in a directed graph
# edges[i] lists the nodes that i points to.

def has_cycle(edges):
    # Mark every node WHITE (not visited yet)
    #
    # Write a visit function:
    #     Mark the node GREY (on the current path)
    #
    #     For each neighbour:
    #         If it is GREY, there is a cycle
    #         If it is WHITE, visit it and pass a found cycle up
    #
    #     Mark the node BLACK (fully explored)
    #     Return False
    #
    # For each WHITE node:
    #     If visiting it finds a cycle, return True
    #
    # Return False
    ???

print(has_cycle([[1, 3], [2, 3, 4], [0], [], [2, 5], []]))
print(has_cycle([[1, 2], [2], []]))
`,
    codeIncludes: [],
    printPatterns: ['^True$', '^False$'],
    hints: ['Grey nodes are still on the current path; reaching one again means a loop.', 'Once all its edges are explored, the node is done: colour it BLACK.'],
    predict: { prompt: 'In [[1, 2], [2], []], node 2 is reached twice. Is that a cycle?', answer: 'No — two paths meet, but nothing loops back', distractors: ['Yes, any repeat is a cycle', 'Only if 2 has edges'] },
    compare: { note: 'A single “visited” set flags the diamond 0→1→2, 0→2 as a cycle by mistake.', wrong: 'if neighbor in visited:\n    return True', fixed: 'if color[neighbor] == GREY:\n    return True' },
    stretch: 'Stretch: return the cycle itself by keeping the current path in a list, and print [0, 1, 2, 0] for the first graph.',
  }),
  algo({
    id: 'algo-dijkstra',
    number: 78,
    topic: "Dijkstra's shortest paths",
    goal: 'Find shortest paths by taking the closest heap entry and saving improved distances to neighbors. Done when Results shows [0, 7, 13, 27, 10, -1], using -1 for the unreachable node.',
    why: 'Routing, maps and network latency all use Dijkstra. The heap always hands you the closest node, so once popped its distance is final — as long as no edge weight is negative.',
    tasks: ['Compute the distance through the current node', 'Push the improved distance with its node', 'Print every shortest distance'],
    taskInstructions: [
      'In dijkstra, add the popped distance to each outgoing edge weight and compare it with the stored neighbor distance. The route from 0 to 4 should improve to 10.',
      'Whenever a neighbor improves, push its distance-and-node pair onto the heap. Skip stale longer entries when popped; Results should preserve the shorter route to node 3.',
      'Return all distances with an unreachable marker from dijkstra. Expect [0, 7, 13, 27, 10, -1]; infinity at the end means the missing-route value was not converted.',
    ],
    code: `# Algorithms — Dijkstra's algorithm
# edges[i] = [[neighbour, weight], ...]

import heapq

def dijkstra(start, edges):
    # Start every distance at infinity, the start at 0
    # Put (0, start) on a heap
    #
    # While the heap has items:
    #     Pop the closest node
    #     Skip it if a shorter distance was already found
    #
    #     For each edge from it:
    #         Calculate the distance through this node
    #         If it is shorter, store it and push it on the heap
    #
    # Return the distances, with -1 for unreachable nodes
    ???

edges = [[[1, 7]], [[2, 6], [3, 20], [4, 3]], [[3, 14]], [[4, 2]], [], []]
print(dijkstra(0, edges))
`,
    codeIncludes: [],
    printPatterns: ['^\\[0, 7, 13, 27, 10, -1\\]$'],
    hints: ['Going to neighbor through node costs the distance so far plus the edge: distance + weight.', 'The heap orders by its first item, so push (new_distance, neighbor).'],
    predict: { prompt: 'Why skip a popped entry when d > dist[node]?', answer: 'It is an old, longer entry for a node already improved', distractors: ['The node is unreachable', 'Negative weights'] },
    compare: { note: 'Plain BFS ignores weights; the heap always expands the cheapest node first.', wrong: 'queue = deque([start])', fixed: 'heap = [(0, start)]\ndistance, node = heapq.heappop(heap)' },
    stretch: 'Stretch: keep a previous-node list and print the actual path to node 3, [0, 1, 2, 3] or [0, 1, 3], whichever is shortest.',
  }),
  algo({
    id: 'algo-staircase',
    number: 79,
    topic: 'Staircase traversal',
    goal: 'Count staircase routes by summing ways to reach earlier steps for jumps from 1 through max_steps. Done when Results shows 5 for the first staircase and 274 for the second.',
    why: 'This is the gentlest dynamic-programming problem: today’s answer is built from smaller answers you already stored. Plain recursion recomputes them and takes exponential time.',
    tasks: ['Add the ways to reach the step you jumped from', 'Return the ways to reach the top', 'Run both staircases and match 5 and 274'],
    taskInstructions: [
      'Inside ways, start with one way to reach step zero and sum the counts at valid jump-back positions for each step. Height 4 with jumps up to 2 should produce 5.',
      'Return the saved count at height after filling the table. The second call should show 274 ways to reach step 10 with jumps up to 3.',
      'Read both ways results. Expect 5 and 274; zeroes usually mean the starting count for step zero was missing.',
    ],
    code: `# Algorithms — Staircase traversal
# Ways to climb height steps taking 1..max_steps at a time.

def ways(height, max_steps):
    # Start a list of ways to reach each step, with 1 way for the bottom
    #
    # For each step up to the top:
    #     For each allowed jump size:
    #         If the jump starts at or above the bottom:
    #             Add the ways to reach the step you jumped from
    #
    # Return the ways to reach the top
    ???

print(ways(4, 2))
print(ways(10, 3))
`,
    codeIncludes: [],
    printPatterns: ['^5$', '^274$'],
    hints: ['Every way to reach step - jump becomes a way to reach step.', 'The table is filled up to height, the top of the stairs.'],
    predict: { prompt: 'With max_steps = 2, the counts follow which sequence?', answer: 'Fibonacci', distractors: ['Powers of two', 'Squares'] },
    compare: { note: 'Naive recursion solves the same smaller staircase many times.', wrong: 'return sum(ways(height - j, k) for j in range(1, k + 1))', fixed: 'ways_to_reach[step] += ways_to_reach[step - jump]' },
    stretch: 'Stretch: use a sliding window sum so each step costs O(1) instead of O(max_steps), and confirm both prints stay the same.',
  }),
  algo({
    id: 'algo-house-robber',
    number: 80,
    topic: 'Max subset sum, no adjacent',
    goal: 'Choose nonadjacent values by tracking the best total so far and the best from two positions earlier. Done when Results shows 330 for the example and 0 for an empty list.',
    why: 'Known as “house robber”, it is the classic take-or-skip DP. Two variables replace the whole table, which is the space optimisation interviewers like to see.',
    tasks: ['Taking this value adds it to the best from two values back', 'Keep the better of skipping or taking it', 'Run both cases and match 330 and 0'],
    taskInstructions: [
      'In max_no_adjacent, calculate taking a value from the saved best two positions earlier. The first example should reach 330 without selecting neighboring entries.',
      'Update the two saved totals while keeping the larger of taking and skipping the current value. Starting both at zero should make an empty values list return 0.',
      'Read both max_no_adjacent results. Expect 330 and 0; a larger first sum may include adjacent values, while an error on [] suggests initialization assumed a first item.',
    ],
    code: `# Algorithms — Max subset sum with no adjacent values

def max_no_adjacent(values):
    """Largest sum of values with no two neighbours both taken."""
    # Start the best so far and the best from two values back at 0
    #
    # For each value:
    #     Calculate the best if you take it (best from two values back + value)
    #     Move the best so far into the best from two values back
    #     Keep whichever is bigger: the best so far or taking this value
    #
    # Return the best so far
    ???

print(max_no_adjacent([75, 105, 120, 75, 90, 135]))
print(max_no_adjacent([]))
`,
    codeIncludes: [],
    printPatterns: ['^330$', '^0$'],
    hints: ['If you take this value, the previous one was skipped: best_before_previous + value.', 'Shift best_so_far back before updating it, then keep the larger: max(best_so_far, best_with_value).'],
    predict: { prompt: 'Which values make 330 in the example?', answer: '75 + 120 + 135', distractors: ['105 + 75 + 135', '105 + 90 + 135'] },
    compare: { note: 'Overwriting best_before_previous before using it loses the old value; compute best_with_value first.', wrong: 'best_before_previous = best_so_far\nbest_with_value = best_before_previous + value', fixed: 'best_with_value = best_before_previous + value\nbest_before_previous = best_so_far' },
    stretch: 'Stretch: make the houses a circle (first and last are neighbours) by running the function twice — without the first, then without the last — and print the larger.',
  }),
  algo({
    id: 'algo-ways-to-change',
    number: 81,
    topic: 'Number of ways to make change',
    goal: 'Count coin combinations in a table, processing one coin type at a time. Done when Results shows 2 ways for 6 using [1, 5], and 4 ways for 10 using [1, 5, 10, 25].',
    why: 'Looping coins outside and amounts inside counts combinations, not orderings — 1+5 and 5+1 count once. Swapping the loops is the most common bug in this question.',
    tasks: ['Start each coin at the smallest amount it can make', 'Add the ways to make the remaining amount', 'Run both cases and match 2 and 4'],
    taskInstructions: [
      'In ways_to_make_change, loop over coins outside the totals loop, starting each total at that coin\'s value. This counts combinations once; the first example should produce 2.',
      'For each total, add the stored count for the amount remaining after this coin. Seed the zero-amount count with one so a coin can form its own first combination.',
      'Read both ways_to_make_change outputs. Expect 2 and 4; larger counts suggest different orders of the same coins were counted separately.',
    ],
    code: `# Algorithms — Number of ways to make change

def ways_to_make_change(amount, coins):
    """How many coin combinations add up to amount (order does not matter)?"""
    # Start a list of ways to make each amount, with 1 way to make 0
    #
    # For each coin:
    #     For each total from the coin's value up to the amount:
    #         Add the ways to make what is left after using this coin
    #
    # Return the ways to make the amount
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
    goal: 'Find the fewest inserts, deletes and substitutions using one rolling table row. Done when Results shows 2 for abc to yabd and 3 for kitten to sitting.',
    why: 'Edit distance powers spell checkers, fuzzy search and diff tools. It is the standard two-string DP grid, and keeping only the previous row cuts memory to O(len(b)).',
    tasks: ['Copy the diagonal value when the characters match', 'Roll current_row into previous_row for the next character', 'Run both pairs and match 2 and 3'],
    taskInstructions: [
      'Inside edit_distance, reuse the previous row\'s diagonal cost when the current characters match. A match adds no new edit; abc to yabd should need 2.',
      'After processing one character of a, save the completed row for the next iteration. The final column after the last row should give the whole-string distance.',
      'Read the two edit_distance outputs. Expect 2 and 3; adding a cost for matching characters would inflate these minimum edit counts.',
    ],
    code: `# Algorithms — Levenshtein distance

def edit_distance(a, b):
    """Fewest inserts, deletes or replacements that turn a into b."""
    # Start the first row with 0, 1, 2… (turning "" into b)
    #
    # For each character of a:
    #     Start a new row with its position
    #
    #     For each character of b:
    #         If the characters match:
    #             Copy the diagonal value
    #         Otherwise:
    #             Take 1 plus the cheapest of insert, delete and replace
    #
    #     The new row becomes the previous row
    #
    # Return the last value of the previous row
    ???

print(edit_distance("abc", "yabd"))
print(edit_distance("kitten", "sitting"))
`,
    codeIncludes: [],
    printPatterns: ['^2$', '^3$'],
    hints: ['Matching characters cost nothing: take the diagonal, previous_row[j - 1].', 'The row you just filled becomes the previous row for the next character of a.'],
    predict: { prompt: 'The three values in min() stand for…', answer: 'Delete, insert and substitute', distractors: ['Three previous characters', 'Left, right and middle halves'] },
    compare: { note: 'The full grid is O(len(a) × len(b)) memory; two rows are enough.', wrong: 'grid = [[0] * (len(b) + 1) for _ in range(len(a) + 1)]', fixed: 'previous_row = list(range(len(b) + 1))\n...\nprevious_row = current_row' },
    stretch: 'Stretch: adapt it to longest common subsequence (+1 on match, max of left and up otherwise) and print 4 for "ZXVVYZW" and "XKYKZPW".',
  }),
  algo({
    id: 'algo-knapsack',
    number: 83,
    topic: '0/1 knapsack',
    goal: 'Fill a best-value table, scanning capacities downward so each item is used at most once. Done when Results shows 10 for the first item set and 220 for the second.',
    why: 'Knapsack is the template for “choose items under a budget” — resource allocation, batching, feature selection. The downward loop is the detail that keeps each item single-use.',
    tasks: ['Stop the capacity loop at the item’s weight', 'Add the item’s value to the best for the remaining room', 'Run both item sets and match 10 and 220'],
    taskInstructions: [
      'In knapsack, scan capacities downward from capacity through the current weight, including that weight. This lets each item be taken once; the first answer should be 10.',
      'Compare the existing best with the current value plus the best for the leftover capacity. Use the earlier-item totals so the second answer stays 220.',
      'Read both knapsack outputs. Expect 10 and 220; a higher value can mean the same item was reused because capacities were updated in ascending order.',
    ],
    code: `# Algorithms — 0/1 knapsack
# items = [[value, weight], ...]; each item at most once.

def knapsack(items, capacity):
    # Start a list of the best value for each capacity, all 0
    #
    # For each item:
    #     For each capacity from the largest down to the item's weight:
    #         Calculate the value if you take the item
    #         Keep whichever is bigger: the current best or taking it
    #
    # Return the best value for the full capacity
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
    goal: 'Remove the kth node from the end using two pointers separated by k steps. Done when Results shows the first list without 6 and an empty list after removing the only item from [1].',
    why: 'Fast and slow pointers find positions in one pass without knowing the length. A dummy head node removes the special case where the first node is the one to delete.',
    tasks: ['Move slow forward together with fast', 'Skip over the node after slow', 'Run both lists and match the results'],
    taskInstructions: [
      'In remove_kth_from_end, create a dummy node and advance fast k places before moving both pointers together. Slow should stop just before the node with value 6 in the first case.',
      'Change slow\'s next link to bypass one node, then return the dummy\'s next link. Removing the only node from the second list should return an empty list.',
      'Read both converted lists. Expect [0, 1, 2, 3, 4, 5, 7, 8, 9] and []; removing 5 or 7 indicates the pointer gap or stopping condition is off by one.',
    ],
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
    # Put a dummy node in front of the head
    # Start fast and slow at the dummy
    #
    # Move fast k steps ahead
    #
    # While fast is not at the last node:
    #     Move fast and slow one step
    #
    # Skip the node after slow
    # Return the node after the dummy
    ???

print(to_list(remove_kth_from_end(build([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]), 4)))
print(to_list(remove_kth_from_end(build([1]), 1)))
`,
    codeIncludes: [],
    printPatterns: ['^\\[0, 1, 2, 3, 4, 5, 7, 8, 9\\]$', '^\\[\\]$'],
    hints: ['Both pointers advance one node per step: slow becomes slow.next.', 'To remove the node after slow, point slow past it: slow.next.next.'],
    predict: { prompt: 'Why start both pointers at a dummy node?', answer: 'So removing the first node needs no special case', distractors: ['To make the list longer', 'Python lists need it'] },
    compare: { note: 'Counting the length first takes two passes; the k-step gap does it in one.', wrong: 'n = len(to_list(head))\n# walk again to n - k', fixed: 'for _ in range(k):\n    fast = fast.next\nwhile fast.next is not None:\n    fast = fast.next\n    slow = slow.next' },
    stretch: 'Stretch: find the middle node with the same idea — fast moves two steps, slow one — and print 5 for the ten-node list.',
  }),
  algo({
    id: 'algo-reverse-polish',
    number: 85,
    topic: 'Reverse Polish notation',
    goal: 'Evaluate postfix expressions with a stack, taking the right operand before the left for each operator. Done when Results shows 2 for the first expression and 6 for the second.',
    why: 'Calculators, compilers and query engines evaluate expressions with a stack. Popping in the right order matters because subtraction and division are not symmetric.',
    tasks: ['Pop the left operand after the right one', 'Push each number as an int', 'Run both expressions and match 2 and 6'],
    taskInstructions: [
      'In evaluate_rpn, pop the right operand before the left and preserve that order for subtraction and division. The first expression should evaluate to 2.',
      'Convert numeric tokens to integers before putting them on the stack, then push numeric operator results. The second expression should evaluate to 6 without joining strings.',
      'Read both evaluate_rpn outputs. Expect 2 and 6; a different quotient may mean operands were reversed or division was rounded instead of truncated toward zero.',
    ],
    code: `# Algorithms — Reverse Polish notation
# "3 4 +" means 3 + 4. Division truncates toward zero.

def evaluate_rpn(tokens):
    # Start an empty stack
    #
    # For each token:
    #     If it is a number:
    #         Push it and continue
    #
    #     Pop the right operand, then the left one
    #     Apply the operator and push the result
    #
    # Return the one value left on the stack
    ???

print(evaluate_rpn(["50", "3", "17", "+", "2", "-", "/"]))
print(evaluate_rpn(["4", "13", "5", "/", "+"]))
`,
    codeIncludes: [],
    printPatterns: ['^2$', '^6$'],
    hints: ['The left operand was pushed earlier, so it is the next one on the stack: stack.pop().', 'Tokens are strings; convert numbers with int(token) before pushing.'],
    predict: { prompt: 'For ["8", "2", "-"], popping in the wrong order gives…', answer: '-6 instead of 6', distractors: ['6 either way', 'An error'] },
    compare: { note: 'The first pop is the right operand; swapping them breaks - and /.', wrong: 'left_operand = stack.pop()\nright_operand = stack.pop()', fixed: 'right_operand = stack.pop()\nleft_operand = stack.pop()' },
    stretch: 'Stretch: print the stack after every token to trace the evaluation, then add support for a "^" power operator.',
  }),
  algo({
    id: 'algo-permutations',
    number: 86,
    topic: 'Permutations',
    goal: 'Build every ordering by choosing a remaining item and recursively arranging the rest. Done when Results shows six permutations of [1, 2, 3] and a count of 24 for four items.',
    why: 'Permutations are the backtracking template for ordering problems — scheduling, routes, anagrams. The tree has n! leaves, so it is also the example of when brute force is the only option.',
    tasks: ['Save a finished ordering when nothing is left', 'Recurse without the chosen item', 'Print the six orderings and the count 24'],
    taskInstructions: [
      'Inside permutations, make the recursive helper save its current ordering when the remaining-items list is empty. The first print should contain six complete three-item lists.',
      'For each recursive choice, append the selected item to a new ordering and remove just that item from the remaining slice. Every printed ordering should contain 1, 2 and 3 once each.',
      'Read the six orderings and the second count. Expect 24 for four items; a smaller count means a branch was skipped, while repeated values mean chosen items stayed available.',
    ],
    code: `# Algorithms — Permutations

def permutations(items):
    """Every ordering of items, as a list of lists."""
    # Start an empty list of orderings
    #
    # Write a build function with the ordering so far and the items left:
    #     If no items are left:
    #         Save the ordering and stop
    #
    #     For each item left:
    #         Build again with that item added and removed from the items left
    #
    # Build from an empty ordering and all items
    # Return the orderings
    ???

print(permutations([1, 2, 3]))
print(len(permutations([1, 2, 3, 4])))
`,
    codeIncludes: [],
    printPatterns: ['^\\[\\[1, 2, 3\\], \\[1, 3, 2\\], \\[2, 1, 3\\], \\[2, 3, 1\\], \\[3, 1, 2\\], \\[3, 2, 1\\]\\]$', '^24$'],
    hints: ['When remaining_items is empty, current_ordering holds one full ordering.', 'Everything except the chosen item: remaining_items[:index] + remaining_items[index + 1:].'],
    predict: { prompt: 'How many permutations do 6 items have?', answer: '720', distractors: ['36', '64'] },
    compare: { note: 'current_ordering + [chosen_item] makes a new list, so saved results are never changed by later steps.', wrong: 'current_ordering.append(chosen_item)\nbuild(current_ordering, ...)\n# no pop', fixed: 'build(current_ordering + [chosen_item], items_left)' },
    stretch: 'Stretch: generate only the permutations of "aab" without duplicates by skipping an item equal to one already tried at this level, and print 3 results.',
  }),
]
