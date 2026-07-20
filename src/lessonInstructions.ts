/**
 * Actionable detail for each lesson task. The short task title stays easy to
 * scan; the matching instruction explains where to edit, what shape to keep,
 * and what result confirms the step.
 */
export const TASK_INSTRUCTIONS: Readonly<Record<string, readonly string[]>> = {
  printing: [
    'Edit the text inside the first print(...). Keep the quotes and parentheses, and include your own name in the greeting.',
    'Replace ??? in the second print with a new sentence inside quotes. Check that Results shows two separate lines.',
  ],
  variables: [
    'Replace ??? after name = with your name as a quoted string, such as "Ada". Keep the variable name and equals sign.',
    'Leave the f-string print in place and check Results for “Hello,” followed by the value you stored in name.',
  ],
  types: [
    'Replace the four blanks with a whole number, decimal number, quoted text, and True or False in that order.',
    'Pass the quoted text "42" into int(...). The final value should be the number 42, not a string.',
  ],
  expressions: [
    'Change 2 + 2 to another calculation. Put the expression by itself so its value appears beside that source line.',
    'Replace ??? with a second bare expression, such as subtraction or string repetition; do not assign or print it.',
  ],
  strings: [
    'Change word to text with at least four letters, then adjust the [start:end] numbers and compare the slice in Results.',
    'Replace ??? with your name in quotes. Keep the f before the string so {name} and {word} are substituted.',
  ],
  booleans: [
    'Set score to 60 or more so score >= 60 evaluates to True. Watch the value aligned with that comparison.',
    'Replace ??? with a comparison that is false for the same score, using ==, <, >, <=, or >=.',
  ],
  conditionals: [
    'Replace ??? with a score from 60 through 89. That skips Excellent and enters the Passed branch.',
    'After Passed works, change only score to 90 or more and confirm the first branch prints Excellent.',
  ],
  lists: [
    'Replace all four blanks inside [ ] with numbers separated by commas. Keep the list non-empty so len and sum work.',
    'Read the final Average score in Results and confirm it equals the total of your numbers divided by four.',
  ],
  'for-loops': [
    'Replace ??? with two range arguments that start at 1 and stop just after 5: range(start, stop).',
    'Keep print(n) indented inside the loop. Results should show five lines: 1, 2, 3, 4, and 5.',
  ],
  'while-loops': [
    'Set the condition so it stays true for n values 0, 1, and 2, then becomes false before a fourth iteration.',
    'Replace the second ??? with an update based on the old n, such as n + 1, so the loop moves toward its end.',
  ],
  dicts: [
    'Replace the name and year blanks with a quoted name and a whole-number year; keep each key-value pair comma-separated.',
    'Pass "city" and an optional fallback into person.get(...). Results should show London without raising KeyError.',
  ],
  functions: [
    'Inside square, replace ??? with n multiplied by itself and keep return so the caller receives the value.',
    'Replace the call blank with a number. The value aligned with square(...) should be that number squared.',
  ],
  errors: [
    'Run the starter once, then open the friendly explanation and use the exception type plus marked line as clues.',
    'Change only b to a non-zero number. Run again and confirm the result replaces the ZeroDivisionError card.',
  ],
  'python-for': [
    'Read the error first, then remove the entire C-style header, including parentheses and i++.',
    'Write for i in range(10): on the header line and keep print(i) indented beneath it; Results should show 0 through 9.',
  ],
  infinite: [
    'Run the starter to see the timeout, then replace while True with a condition based on a counter that can become false.',
    'Initialize the counter before the loop, print it inside, and increase it each time so Results ends after 0, 1, 2.',
  ],
  capstone: [
    'Replace ??? with a comparison between the current score and passing so 60 and above use the pass branch.',
    'Keep the average calculation outside the loop. Confirm Results includes pass, retry, and one final Average line.',
  ],

  'mid-enumerate-zip': [
    'Replace the enumerate blank with 1 so the displayed positions begin at one instead of zero.',
    'Pass names and years to zip in matching order. Each loop iteration should unpack one name-year pair.',
  ],
  'mid-nested-loops': [
    'Use range(1, 5) for both loops; range stops before 5, so rows and columns cover 1 through 4.',
    'Replace the product blank with row * col, convert it to text, and keep appending it to the current line.',
  ],
  'mid-list-methods': [
    'Replace ??? inside append with n * 10. The loop should grow nums to five multiples of ten.',
    'Replace the final ??? with 30 so the membership expression reads 30 in nums and evaluates to True.',
  ],
  'mid-comprehensions': [
    'Use range(...) as the source after for n in. The first comprehension should produce a list of square numbers.',
    'Replace the filter blank with n % 2 == 0 so only numbers with zero remainder are kept.',
  ],
  'mid-dict-loops': [
    'Keep scores.items() so each iteration receives both name and score; check the three printed pairs first.',
    'Replace ??? with score + 5 in the dict comprehension. Each original name should map to its boosted number.',
  ],
  'mid-sets': [
    'Replace ??? with two or more quoted skills separated by commas, including at least one skill shared with skills_a.',
    'Use skills_a | skills_b for all skills and skills_a & skills_b for only shared skills; compare both results.',
  ],
  'mid-tuples': [
    'Assign point to x, y in one statement so the tuple positions are unpacked into two names.',
    'Put b, a on the right side of the swap assignment. The final tuple should read (2, 1).',
  ],
  'mid-fn-defaults': [
    'Add a quoted default after greeting in the function signature, keeping the required name parameter first.',
    'Call greet once with only a name, then once with both name and greeting; compare the two printed messages.',
  ],
  'mid-sorting': [
    'Pass a key function that reads each record’s "year" field so sorted compares years rather than whole dictionaries.',
    'Keep reverse=True only for the newest-first result, then compare the first person in each ordering.',
  ],
  'mid-try-except': [
    'Keep int(raw) inside try so valid strings are converted and printed normally.',
    'Replace ??? with ValueError. The "oops" item should print the friendly fallback while the loop continues to "3".',
  ],
  'mid-classes': [
    'Assign start to self.value inside __init__ so each Counter instance owns its initial state.',
    'Update self.value with its old value plus step. The two bump calls should leave c.value equal to 5.',
  ],
  'mid-stdlib': [
    'Replace the import blanks with math and random, one module per import statement.',
    'Pass a perfect square to math.sqrt and keep randint bounds at 1 and 6; both expressions should show values.',
  ],
  'mid-json': [
    'Pass the Python data dictionary into json.dumps. The resulting text value should contain JSON double quotes.',
    'Pass text into json.loads, then read parsed["name"] to confirm the round trip restored a dictionary.',
  ],
  'mid-capstone': [
    'Set key to a function that returns r["score"] and keep reverse=True so the highest score is first.',
    'Use limit as the slice end in ranked[:limit]. Return only each selected record’s name string.',
  ],
  'mid-counter-defaultdict': [
    'Pass the complete words list to Counter. most_common(2) should put python first with a count of two.',
    'Keep groups as defaultdict(list), append each word under word[0], and convert to dict only when printing.',
  ],
  'mid-generators': [
    'Replace ??? with n * n after yield. Values are produced only when the surrounding even-number condition passes.',
    'Call next(stream) once, then list(stream). The second operation contains only the remaining values, not the first one.',
  ],
  'mid-heapq': [
    'Keep heapq.heapify(tasks) before the loop so the tuple list obeys heap order.',
    'Pass tasks into heappop. Confirm priorities print in ascending order: 1, then 2, then 3.',
  ],
  'mid-dataclasses': [
    'Replace ??? with True in @dataclass(frozen=...). This makes ModelSpec immutable and hashable.',
    'Leave the model instance as the dictionary key and confirm availability[model] returns "ready".',
  ],
  'mid-decorators-cache': [
    'Complete Fibonacci with fib(n - 2) as the second recursive call; the base case already stops the recursion.',
    'Run fib(10), then read cache_info. The answer should be 55 and hits should be greater than zero.',
  ],
  'mid-context-managers': [
    'Return self from __enter__ so the object after as receives this active StudySession instance.',
    'Watch the output order: open, studying vectors, close. __exit__ must run after the with block.',
  ],

  'ai-tokens': [
    'Replace ??? with text.split(). Keep the return inside tokenize so callers receive a list of pieces.',
    'Run the sample and inspect both the printed token list and len(tokens); the sentence should produce four tokens.',
  ],
  'ai-bag-of-words': [
    'Replace ??? with 1 so each visit adds one to the existing count returned by counts.get(t, 0).',
    'Print counts after the loop and confirm "cat" maps to 2 while the other tokens map to 1.',
  ],
  'ai-vocab': [
    'Assign next_id only when a token is not already in vocab, then increment it for the next new token.',
    'Build ids by looking up every original token in vocab. Repeated "the" tokens should reuse the same id.',
  ],
  'ai-dot-product': [
    'Inside the loop, multiply a[i] by b[i] and add that product to total; do not add the vector values directly.',
    'Print dot(v1, v2) and verify the aligned products sum to 5.',
  ],
  'ai-cosine': [
    'Keep magnitude as the square root of summed squares and preserve the zero-denominator guard.',
    'Return dot(a, b) divided by denom. The two sample vectors should produce a cosine score of 0.5.',
  ],
  'ai-prompt-template': [
    'Replace ??? with a student name inside quotes; the variable must exist before the multiline f-string is built.',
    'Print prompt and inspect its sections in Results: system instruction, student, task, and answer constraint.',
  ],
  'ai-json-contract': [
    'For each required key, test whether it is absent from payload and collect only those missing names.',
    'Print the validation object and confirm ok is True and missing is empty before using payload.',
  ],
  'ai-pipeline': [
    'Implement top_token with max(counts, key=counts.get) so dictionary values decide the winning key.',
    'Pass tokens into count_tokens, then print tokens, counts, and winner in stage order. The winner should be "to".',
  ],
  'ai-softmax': [
    'Divide every exponential weight by total in the returned list. The probabilities should add to about 1.',
    'Compare both printed distributions: temperature 0.5 should concentrate more probability on the largest logit.',
  ],
  'ai-data-splits': [
    'End the validation slice at 8 so it contains e6 and e7 but does not overlap the test slice.',
    'Inspect the printed dictionary and sizes. Train, validation, and test should contain 6, 2, and 2 examples.',
  ],
  'ai-classifier-metrics': [
    'Keep precision as tp/(tp+fp) and recall as tp/(tp+fn); each denominator answers a different question.',
    'Replace ??? with precision + recall. The rounded F1 value should be 0.727.',
  ],
  'ai-next-token': [
    'Use options.get as max’s key function so probabilities, not alphabetical token order, choose the result.',
    'Follow the loop after each append. The final joined sequence should read “Python is clear”.',
  ],
  'ai-attention': [
    'Keep allowed sliced through query_position + 1 so the current token is included and future tokens stay excluded.',
    'Use scores.get to choose focus. "cat" should win among allowed tokens while "there" remains listed as masked.',
  ],
  'ai-retrieval': [
    'Replace ??? with k in ranked[:k]. Keep reverse=True so the highest-scoring evidence appears first.',
    'Run both queries: the strong query should return Python lists, while the weak query should return “I don’t know”.',
  ],
  'ai-evals': [
    'Compare each case["actual"] with case["expected"] inside the sum so True results count as correct cases.',
    'Report correctness and citation support separately; the sample should show 0.667 and 0.333.',
  ],
  'ai-safe-tools': [
    'Validate the tool name and all required argument keys before considering any execution path.',
    'Replace ??? with spec["destructive"]. Search should validate, delete should require approval, and email should be unknown.',
  ],

  'api-request': [
    'Set method to "GET" and path to a string beginning with /. Keep headers and query as dictionaries.',
    'Print request["method"] and request["path"] and confirm Results shows both values from the same request object.',
  ],
  'api-response': [
    'Replace the status blank with 200 while keeping headers and body as separate response fields.',
    'Print ok("hello from the browser") and inspect the rendered HTTP card for status 200 and the message body.',
  ],
  'api-status': [
    'Leave the found branch at 200 and replace the missing branch blank with 404.',
    'Run both ids. The existing item should return its data, while id 99 should return a not-found error body.',
  ],
  'api-routing': [
    'Replace ??? with the exact path string "/hello". Keep the health and fallback branches unchanged.',
    'Print /health, /hello, and /missing requests and confirm they produce True, hi, and 404 outcomes.',
  ],
  'api-query': [
    'Use "name" as the .get key and keep "world" as the fallback for an absent query parameter.',
    'Run one request with name=Ada and one empty query. Results should greet Ada and world.',
  ],
  'api-json-body': [
    'Replace the non-POST status blank with 405 so unsupported methods stop before body handling.',
    'Keep name validation before the 201 response. Confirm GET returns 405 and valid POST returns Ada with id 1.',
  ],
  'api-middleware': [
    'Replace ??? with handler(request) so wrapped first receives the inner response.',
    'Copy or create the headers dictionary, add x-request-id, and confirm the final response still includes the original body.',
  ],
  'api-mini-app': [
    'Keep the health and /items/ branches ordered before the fallback route.',
    'Replace the final status blank with 404. The three requests should return healthy, Notebook, and missing results.',
  ],
  'api-auth': [
    'Read the lowercase "authorization" key with headers.get(..., "") so a missing header is safe.',
    'Compare the token with SECRET and run both requests. Missing auth should be 401; the Bearer token should be 200.',
  ],
}

export function taskInstructionsFor(
  lessonId: string,
  tasks: readonly string[],
): string[] {
  const instructions = TASK_INSTRUCTIONS[lessonId]
  return tasks.map(
    (task, index) =>
      instructions?.[index] ??
      `Make the smallest code change that completes “${task}”, then confirm the result in the Results pane.`,
  )
}
