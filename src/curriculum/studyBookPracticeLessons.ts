import type { LessonDraft } from '../examples'

/**
 * Playground tasks that pair with the live study book.
 * The book shows the tape; these lessons make you pick the pattern
 * and fill the missing move. Browser-local Python only.
 */
export function practice(spec: {
  id: string
  difficulty: 'intermediate' | 'api' | 'fastapi' | 'harness'
  number: number
  topic: string
  chapter: string
  bookChapter: string
  goal: string
  why: string
  tasks: [string, string, string]
  taskInstructions: [string, string, string]
  code: string
  codeIncludes: string[]
  printPatterns: string[]
  hints: string[]
  predict: { prompt: string; answer: string; distractors: [string, string] }
  compare: { note: string; wrong: string; fixed: string }
  stretch: string
  pipeline?: string[]
}): LessonDraft {
  return {
    id: spec.id,
    difficulty: spec.difficulty,
    number: spec.number,
    topic: spec.topic,
    chapter: spec.chapter,
    bookChapter: spec.bookChapter,
    goal: spec.goal,
    why: spec.why,
    tasks: spec.tasks,
    taskInstructions: spec.taskInstructions,
    code: spec.code,
    goalCheck: {
      requireSuccess: true,
      requireFreshRun: true,
      mustEditStarter: true,
      noBlanks: true,
      codeIncludes: spec.codeIncludes,
      printPatterns: spec.printPatterns,
      minNonEmptyPrints: spec.printPatterns.length,
    },
    hints: spec.hints,
    predict: {
      prompt: spec.predict.prompt,
      choices: [spec.predict.answer, ...spec.predict.distractors],
      correctIndex: 0,
    },
    compare: spec.compare,
    stretch: spec.stretch,
    pipeline: spec.pipeline,
  }
}

export const STUDY_BOOK_PRACTICE_LESSON_DRAFTS: LessonDraft[] = [
  practice({
    id: 'mid-pattern-pick',
    difficulty: 'intermediate',
    number: 44,
    topic: 'Which array pattern?',
    chapter: 'Array patterns',
    bookChapter: 'dsa-sql',
    goal:
      'Label four interview prompts as sliding window, two pointers, prefix sums, or binary search on the answer, then print ok for every correct pick.',
    why:
      'The screen is not “can you recite code.” It is “can you see the constraint and name the pattern before you type.” Wrong pattern, clever code, still a fail.',
    tasks: [
      'Fill picks with the four pattern ids in order',
      'Keep the zip loop so each prompt prints ok or WRONG',
      'Run and confirm four ok lines in Results',
    ],
    taskInstructions: [
      'In picks, use quoted ids from the comment and match each to the constraint in prompts: contiguous text, sorted pairs, repeated range queries or a feasible minimum. Each row should print ok.',
      'Trace the three zip inputs in the loop without rearranging them. Each prompt must be compared with the pick at the same index, so a misplaced choice will print WRONG.',
      'Read the four prompt lines in Results. Expect four ok labels; WRONG want= identifies which pattern choice disagrees with the corresponding prompt.',
    ],
    code: `# Study book practice — Which array pattern?
# Pair with DSA & SQL screens in the study book (the L/R tapes).
# Pick: "sliding" | "two_pointers" | "prefix" | "binsearch"

prompts = [
    "longest substring without repeating characters",
    "two-sum on a SORTED array, O(1) extra space",
    "many range-sum queries on a static array",
    "minimum ship capacity so all parcels arrive in D days",
]
want = ["sliding", "two_pointers", "prefix", "binsearch"]
picks = [???, ???, ???, ???]

for name, got, expected in zip(prompts, picks, want):
    print(name, "ok" if got == expected else f"WRONG want={expected}")
`,
    codeIncludes: ['sliding', 'two_pointers', 'prefix', 'binsearch'],
    printPatterns: [
      'longest substring.*ok',
      'two-sum.*ok',
      'range-sum.*ok',
      'ship capacity.*ok',
    ],
    hints: [
      'A shrinking/growing L–R range on one array is sliding window.',
      'Sorted two-sum is two pointers; unsorted two-sum is a hash map (not in this list).',
      'Many range sums after one preprocess is prefix. Min feasible k is binary search on the answer.',
    ],
    predict: {
      prompt: '“Min eating speed so piles finish in h hours” is which pattern?',
      answer: 'Binary search on the answer (search k, not an index)',
      distractors: [
        'Sliding window on the piles array',
        'Prefix sums of banana counts',
      ],
    },
    compare: {
      note: 'Name the constraint first. Sorted two-sum is not a hash-map problem.',
      wrong: 'picks = ["sliding", "sliding", "sliding", "sliding"]',
      fixed: 'picks = ["sliding", "two_pointers", "prefix", "binsearch"]',
    },
    stretch:
      'Stretch: add a fifth prompt “two-sum on an unsorted array” and pick hash_map, then print why two_pointers would be wrong.',
  }),
  practice({
    id: 'mid-sliding-window',
    difficulty: 'intermediate',
    number: 45,
    topic: 'Sliding window',
    chapter: 'Array patterns',
    bookChapter: 'dsa-sql',
    goal:
      'Finish a unique-substring window whose left edge only moves forward, visiting each index at most once per edge. Done when Results shows abcabcbb, bbbbb and pwwkew with lengths 3, 1 and 3.',
    why:
      'Sliding window is the default for longest or shortest subarray/substring with a constraint. Restarting a new window from scratch is O(n²) and not the pattern the tape showed.',
    tasks: [
      'Advance L by one when the new character is already in seen',
      'Keep seen and best updates intact',
      'Run the three cases and match 3, 1, 3',
    ],
    taskInstructions: [
      'The blank is on the l += line inside the while loop. Write how far the left edge moves after removing one repeated character. When correct, abcabcbb prints 3.',
      'Trace seen.add and the best update after the while loop in longest_unique. They should count the current duplicate-free span; bbbbb should produce 1.',
      'Read abcabcbb, bbbbb and pwwkew in Results. Their lengths should be 3, 1 and 3; a larger result usually means a repeated character stayed inside the window.',
    ],
    code: `# Study book practice — Sliding window
# Longest substring without repeating characters (the abcabcbb tape).

def longest_unique(s):
    seen, l, best = set(), 0, 0
    for r, ch in enumerate(s):
        while ch in seen:
            seen.remove(s[l])
            l += ???
        seen.add(ch)
        best = max(best, r - l + 1)
    return best

print("abcabcbb", longest_unique("abcabcbb"))
print("bbbbb", longest_unique("bbbbb"))
print("pwwkew", longest_unique("pwwkew"))
`,
    codeIncludes: ['while ch in seen', 'l += 1', 'seen.add'],
    printPatterns: ['abcabcbb 3', 'bbbbb 1', 'pwwkew 3'],
    hints: [
      'L must move forward by 1 so the duplicate leaves the window.',
      'Do not reset L to 0 — that would skip the O(n) guarantee.',
    ],
    predict: {
      prompt: 'On a duplicate, the O(n) move is…',
      answer: 'Shrink L until the duplicate is gone, then keep expanding R',
      distractors: [
        'Restart the window at R from scratch',
        'Sort the string first',
      ],
    },
    compare: {
      note: 'L only moves forward. Restarting from zero is a different, slower algorithm.',
      wrong: 'while ch in seen:\n    seen = set()\n    l = r',
      fixed: 'while ch in seen:\n    seen.remove(s[l])\n    l += 1',
    },
    stretch:
      'Stretch: also print the best window length for "dvdf" and assert it equals 3 (vdf), not 2.',
  }),
  practice({
    id: 'mid-two-pointers',
    difficulty: 'intermediate',
    number: 46,
    topic: 'Two pointers',
    chapter: 'Array patterns',
    bookChapter: 'dsa-sql',
    goal:
      'Finish sorted two-sum by moving the right pointer for excessive sums and the left pointer for smaller sums. Done when Results shows indices [0, 1] selecting values 2 and 7 from [2, 7, 11, 15] for target 9.',
    why:
      'When the array is sorted, two pointers use O(1) extra space. A hash map still works but spends O(n) memory. Interviewers want you to name that trade.',
    tasks: [
      'Decrement R when the pair sum is above the target',
      'Keep the L++ branch for sums that are too small',
      'Print the index pair and the values that add to 9',
    ],
    taskInstructions: [
      'In two_sum_sorted, fill the decrement after r with the amount needed to move one position left. The returned indices should be [0, 1].',
      'Trace the else branch that advances l when the sum is too small. Moving toward larger values should eventually find the pair whose printed values are 2 and 7.',
      'Read indices and values together. Expect [0, 1] followed by 2 and 7; indices without the matching values indicate confusion between positions and the numbers stored there.',
    ],
    code: `# Study book practice — Two pointers (sorted two-sum)

def two_sum_sorted(a, t):
    l, r = 0, len(a) - 1
    while l < r:
        s = a[l] + a[r]
        if s == t:
            return [l, r]
        if s > t:
            r -= ???
        else:
            l += 1
    return []

nums = [2, 7, 11, 15]
pair = two_sum_sorted(nums, 9)
print("indices", pair)
print("values", nums[pair[0]], nums[pair[1]])
`,
    codeIncludes: ['r -= 1', 'l += 1', 'while l < r'],
    printPatterns: ['indices \\[0, 1\\]', 'values 2 7'],
    hints: [
      'Too big: the only way to decrease a sorted pair is to pull R left.',
      'Too small: push L right. Do not scan from the start each time.',
    ],
    predict: {
      prompt: 'On a sorted array, 2 + 15 = 17 and target is 9. Next move?',
      answer: 'R-- (sum too big)',
      distractors: ['L++ (sum too big)', 'Hash the rest of the array'],
    },
    compare: {
      note: 'Unsorted two-sum is a hash map. Sorted two-sum is two pointers.',
      wrong: 'for i in range(len(a)):\n    for j in range(i + 1, len(a)):',
      fixed: 'l, r = 0, len(a) - 1\nwhile l < r:\n    s = a[l] + a[r]',
    },
    stretch:
      'Stretch: also solve target 26 (11+15) and print those indices without rewriting the loop.',
  }),
  practice({
    id: 'mid-prefix-sums',
    difficulty: 'intermediate',
    number: 47,
    topic: 'Prefix sums',
    chapter: 'Array patterns',
    bookChapter: 'dsa-sql',
    goal:
      'Build prefix totals so slot i sums the first i items and each range query needs one subtraction. Done when Results shows 9 for indices 1 through 3 of [2, 3, 5, 1].',
    why:
      'If you will answer many range-sum queries, looping l..r each time is O(n) per query. One O(n) preprocess plus O(1) lookups is the prefix pattern.',
    tasks: [
      'Return prefix[r + 1] minus prefix[l] from range_sum',
      'Keep prefix[0] = 0 in make_prefix',
      'Print the range 1..3 result and the full prefix row',
    ],
    taskInstructions: [
      'In range_sum, use an index one position beyond the inclusive right endpoint. Subtracting the prefix at l should make sum_1_3 print 9.',
      'Trace make_prefix starting from its initial zero. The prefix line should show [0, 2, 5, 10, 11], with each position storing the sum before that array index.',
      'Read prefix and sum_1_3 in Results. The total for indices 1 through 3 should be 9; getting 8 means the rightmost value was left out.',
    ],
    code: `# Study book practice — Prefix sums

def make_prefix(a):
    p = [0]
    for x in a:
        p.append(p[-1] + x)
    return p

def range_sum(p, l, r):
    return p[???] - p[l]

nums = [2, 3, 5, 1]
prefix = make_prefix(nums)
print("prefix", prefix)
print("sum_1_3", range_sum(prefix, 1, 3))
`,
    codeIncludes: ['p[r + 1]', 'p[-1] + x'],
    printPatterns: ['prefix \\[0, 2, 5, 10, 11\\]', 'sum_1_3 9'],
    hints: [
      'prefix[i] is the sum of nums[0:i], so prefix[0] is 0.',
      'sum[l..r] inclusive is prefix[r+1] - prefix[l]. For l=1,r=3 that is 11 - 2.',
    ],
    predict: {
      prompt: 'prefix = [0, 2, 5, 10, 11]. sum of nums[1..3] is…',
      answer: 'prefix[4] - prefix[1] = 9',
      distractors: ['prefix[3] - prefix[1] = 8', 'Loop 3+5+1 each time'],
    },
    compare: {
      note: 'The extra 0 at the front makes the subtraction work for l = 0 too.',
      wrong: 'return sum(nums[l:r + 1])',
      fixed: 'return prefix[r + 1] - prefix[l]',
    },
    stretch:
      'Stretch: print range_sum for l=0,r=3 (the whole array) and assert it equals 11.',
  }),
  practice({
    id: 'mid-binsearch-answer',
    difficulty: 'intermediate',
    number: 48,
    topic: 'Binary search on the answer',
    chapter: 'Array patterns',
    bookChapter: 'dsa-sql',
    goal:
      'Search for the smallest eating speed, raising lo above an infeasible midpoint and keeping a feasible midpoint as hi. Done when Results shows speed 4 finishing piles [3, 6, 7, 11] in 8 hours.',
    why:
      'The piles are not a sorted search key. You search the integer answer. The predicate “can we finish at speed k?” is monotonic, so binary search still applies.',
    tasks: [
      'Set lo to mid + 1 when hours(mid) exceeds h',
      'Keep hi = mid when mid is feasible',
      'Print the min speed and the hours that speed needs',
    ],
    taskInstructions: [
      'In min_speed\'s else branch, set lo to the first candidate strictly above mid. The min_speed line should finish at 4 instead of getting stuck on an infeasible candidate.',
      'Trace the feasible branch where hi becomes mid. Keeping that candidate available should find the smallest speed; Results should show min_speed 4.',
      'Read min_speed and hours together. Expect 4 and 8; fewer hours at a larger speed means the search found a feasible answer without proving it was the smallest.',
    ],
    code: `# Study book practice — Binary search on the answer (koko)

def hours(piles, k):
    return sum((p + k - 1) // k for p in piles)

def min_speed(piles, h):
    lo, hi = 1, max(piles)
    while lo < hi:
        mid = (lo + hi) // 2
        if hours(piles, mid) <= h:
            hi = mid
        else:
            lo = ???
    return lo

piles = [3, 6, 7, 11]
k = min_speed(piles, 8)
print("min_speed", k)
print("hours", hours(piles, k))
`,
    codeIncludes: ['lo = mid + 1', 'hi = mid', '(p + k - 1) // k'],
    printPatterns: ['min_speed 4', 'hours 8'],
    hints: [
      'If mid is too slow, every smaller k is also too slow: lo = mid + 1.',
      'If mid works, a smaller k might also work: hi = mid (keep mid in range).',
    ],
    predict: {
      prompt: 'You are searching min k so hours(k) <= 8. What is lo/hi?',
      answer: 'Values of k (1 .. max pile), not indices in piles',
      distractors: [
        'Indices 0 .. len(piles)-1',
        'The sorted unique pile sizes only',
      ],
    },
    compare: {
      note: 'Ordinary binary search finds a target in a sorted array. This flavour searches the answer.',
      wrong: 'lo, hi = 0, len(piles) - 1',
      fixed: 'lo, hi = 1, max(piles)',
    },
    stretch:
      'Stretch: print hours at k-1 as well and show it is greater than 8 so speed 4 is the tight minimum.',
  }),
  practice({
    id: 'mid-pattern-mixed',
    difficulty: 'intermediate',
    number: 49,
    topic: 'Pick then code',
    chapter: 'Array patterns',
    bookChapter: 'dsa-sql',
    goal:
      'Choose the pattern for repeated range sums and finish the marked calculation. Done when Results shows the pattern id prefix and the numeric answer 9 together.',
    why:
      'On a real screen you do not get a chapter title. You read the prompt, name the pattern, then write ten lines. This lesson forces both.',
    tasks: [
      'Set pattern to prefix because the job is many range sums',
      'Finish range_sum using the prefix row',
      'Print the pattern id and the range result 9',
    ],
    taskInstructions: [
      'Set pattern to the quoted id for precomputed running totals. Repeated sums on an unchanged array should produce the pattern label prefix.',
      'In range_sum, select the prefix index immediately before the requested interval begins. The supplied range from 1 through 3 should print answer 9.',
      'Read pattern and answer in Results. Expect prefix and 9; a different total means the subtraction removed too many or too few values before the requested range.',
    ],
    code: `# Study book practice — Pick then code
# Job: answer sum(nums[1..3]) quickly on a static array.

pattern = ???          # "sliding" | "two_pointers" | "prefix" | "binsearch"

def make_prefix(a):
    p = [0]
    for x in a:
        p.append(p[-1] + x)
    return p

def range_sum(p, l, r):
    return p[r + 1] - p[???]

nums = [2, 3, 5, 1]
prefix = make_prefix(nums)
answer = range_sum(prefix, 1, 3)
print("pattern", pattern)
print("answer", answer)
`,
    codeIncludes: ['pattern = "prefix"', 'p[r + 1]'],
    printPatterns: ['pattern prefix', 'answer 9'],
    hints: [
      'Many queries, static array, range sums → prefix, not sliding window.',
      'The second ??? is l, not r. sum[1..3] = prefix[4] - prefix[1].',
    ],
    predict: {
      prompt: 'Static array, many sum(l..r) queries. Pattern?',
      answer: 'Prefix sums',
      distractors: ['Sliding window', 'Binary search on the answer'],
    },
    compare: {
      note: 'Sliding window is for a single expanding/shrinking range with a constraint, not random queries.',
      wrong: 'pattern = "sliding"',
      fixed: 'pattern = "prefix"',
    },
    stretch:
      'Stretch: add a comment naming the pattern you would use if the array kept changing (Fenwick/segment — out of this lesson, just name it).',
  }),
  practice({
    id: 'api-fastapi-status',
    difficulty: 'fastapi',
    number: 23,
    topic: 'FastAPI status map',
    chapter: 'FastAPI in the playground',
    bookChapter: 'fastapi',
    pipeline: ['read the failure', 'name the layer', 'pick 404 / 422 / 401 / 200', 'print the map'],
    goal:
      'Map request failures to HTTP status codes by their layer. Done when Results prints ok for unknown path 404, missing field 422, missing Bearer 401 and valid POST /query 200.',
    why:
      'The study-book FastAPI gates are Route → Pydantic → Depends → handler. Status codes are how those gates talk. Mixing 401 and 422 is the usual junior miss.',
    tasks: [
      'Fill codes in the same order as cases',
      'Keep the zip so each row prints ok or WRONG',
      'Run until all four lines say ok',
    ],
    taskInstructions: [
      'In codes, put an integer HTTP status beside each corresponding case. Use the layer notes above the list; each case should print ok when its code matches the failure location.',
      'Trace how zip pairs cases, codes and want before running. Each printed row should refer to its own case; changing the order of one list would produce WRONG labels.',
      'Read all four case lines in Results. Each should end in ok; WRONG want= names the status to reconsider for that layer.',
    ],
    code: `# Study book practice — FastAPI status map
# Layers: path (404) · Pydantic body (422) · Depends/auth (401) · handler (200)
# This is a local dict exercise, not a live uvicorn process.

cases = [
    "unknown path",
    "POST /query with no q field",
    "POST /query with no Authorization header",
    "POST /query with Bearer + valid q",
]
want = [404, 422, 401, 200]
codes = [???, ???, ???, ???]

for name, got, expected in zip(cases, codes, want):
    print(name, "ok" if got == expected else f"WRONG want={expected}")
`,
    codeIncludes: ['404', '422', '401', '200'],
    printPatterns: [
      'unknown path ok',
      'no q field ok',
      'no Authorization header ok',
      'valid q ok',
    ],
    hints: [
      'Pydantic validation failure is 422 before your handler runs.',
      'Missing credentials is 401, not 422. Unknown route is 404.',
    ],
    predict: {
      prompt: 'Missing JSON field on a FastAPI body model. Status?',
      answer: '422 Unprocessable Entity',
      distractors: ['401 Unauthorized', '500 Internal Server Error'],
    },
    compare: {
      note: 'Authz failures are Depends (401/403). Schema failures are Pydantic (422).',
      wrong: 'codes = [404, 401, 422, 200]',
      fixed: 'codes = [404, 422, 401, 200]',
    },
    stretch:
      'Stretch: add “wrong tenant on a valid body” as 403 and keep it distinct from 401.',
  }),
  practice({
    id: 'api-fastapi-dispatch',
    difficulty: 'fastapi',
    number: 24,
    topic: 'FastAPI-shaped dispatcher',
    chapter: 'FastAPI in the playground',
    bookChapter: 'fastapi',
    pipeline: ['match route', 'validate body', 'Depends tenant', 'return envelope'],
    goal:
      'Finish a local dispatcher that validates paths, query bodies and tenants. Done when Results shows 422 for missing q, 401 for missing tenant, 404 for unknown paths and 200 for valid queries. The successful query response must echo its tenant.',
    why:
      'FastAPI is path + Pydantic + Depends, not “if request then call OpenAI.” This local dispatcher is the same order as the study-book gates, without pretending Pyodide is uvicorn.',
    tasks: [
      'Return 422 when the POST body is missing q',
      'Keep 401 when x-tenant is absent',
      'Print the four case statuses including 200 for the happy path',
    ],
    taskInstructions: [
      'In dispatch\'s missing-q branch, fill status with the validation-error code described by the task. The missing_q line should show 422.',
      'Trace the tenant check after body validation and leave its rejection path in place. no_tenant should show 401 while a request with both tenant and q reaches 200.',
      'Read every cases entry in Results: health and ok should be 200, missing_q 422, no_tenant 401 and ghost 404. A wrong label points to the corresponding dispatch branch.',
    ],
    code: `# Study book practice — FastAPI-shaped dispatcher (local, no server)

def dispatch(method, path, headers, body):
    if (method, path) not in {("GET", "/health"), ("POST", "/query")}:
        return {"status": 404, "body": {"detail": "not found"}}
    if method == "POST":
        if "q" not in body:
            return {"status": ???, "body": {"detail": "q required"}}
        tenant = headers.get("x-tenant")
        if not tenant:
            return {"status": 401, "body": {"detail": "tenant"}}
        return {"status": 200, "body": {"tenant": tenant, "q": body["q"]}}
    return {"status": 200, "body": {"ok": True}}

cases = {
    "health": dispatch("GET", "/health", {}, {}),
    "missing_q": dispatch("POST", "/query", {"x-tenant": "acme"}, {}),
    "no_tenant": dispatch("POST", "/query", {}, {"q": "refund?"}),
    "ok": dispatch("POST", "/query", {"x-tenant": "acme"}, {"q": "refund?"}),
    "ghost": dispatch("POST", "/nope", {}, {}),
}
for name, res in cases.items():
    print(name, res["status"])
`,
    codeIncludes: ['status": 422', 'status": 401', 'x-tenant'],
    printPatterns: [
      'health 200',
      'missing_q 422',
      'no_tenant 401',
      'ok 200',
      'ghost 404',
    ],
    hints: [
      'The first ??? is 422 — Pydantic-style body validation, not 400 unless you choose that contract.',
      'Depends-style tenant lives in headers, not in the JSON body.',
    ],
    predict: {
      prompt: 'POST /query with a valid q but no tenant header. Status?',
      answer: '401',
      distractors: ['422', '200'],
    },
    compare: {
      note: 'Validate the body before you trust Depends, and Depends before the handler.',
      wrong: 'if "q" not in body:\n    return {"status": 401, "body": {"detail": "q required"}}',
      fixed: 'if "q" not in body:\n    return {"status": 422, "body": {"detail": "q required"}}',
    },
    stretch:
      'Stretch: reject GET /query with 405 and print that status next to the existing cases.',
  }),
]
