import type { LessonDraft } from '../examples'

/**
 * Beginner gaps found by comparing the track with a typical first-Python course outline: comments and indentation,
 * operators, string methods, combined conditions, parameters, scope, common errors, classes, files and imports.
 * Numbers and chapters come from BEGINNER_PATH, so the values here are placeholders.
 */
function foundation(spec: {
  id: string
  topic: string
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
}): LessonDraft {
  return {
    id: spec.id,
    difficulty: 'beginner',
    number: 0,
    topic: spec.topic,
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
    },
    hints: spec.hints,
    predict: { prompt: spec.predict.prompt, choices: [spec.predict.answer, ...spec.predict.distractors], correctIndex: 0 },
    compare: spec.compare,
    stretch: spec.stretch,
  }
}

export const FOUNDATION_LESSON_DRAFTS: LessonDraft[] = [
  foundation({
    id: 'comments-indentation',
    topic: 'Comments & indentation',
    goal: 'Write your own comment above the if and indent its print, so the hot-day message and "Done checking" both print while the commented-out line stays silent.',
    why: 'Python uses indentation instead of braces to know which lines belong to an if, a loop or a function. Comments are notes for people; Python skips them, which also makes them a quick way to switch a line off.',
    tasks: [
      'Replace ??? with a comment that says what the if checks',
      'Indent the hot-day print by 4 spaces so it belongs to the if',
      'Run and check that the debug line does not print',
    ],
    taskInstructions: [
      'Keep the # and replace ??? with a short sentence in your own words, such as "Warn when it is hot".',
      'Read the IndentationError, then put 4 spaces before print("Hot day: drink water").',
      'The line starting with # print(...) is a comment, so it must not show in Results.',
    ],
    code: `# Lesson 2 — Comments and indentation
# Anything after # is a comment: Python skips it, people read it.
# Lines inside an if, a loop or a function are indented by 4 spaces.

temperature = 31

# ???
if temperature > 30:
print("Hot day: drink water")

# print("debug: temperature is", temperature)
print("Done checking")
`,
    codeIncludes: ['    print("Hot day: drink water")'],
    printPatterns: ['^Hot day: drink water$', '^Done checking$'],
    hints: [
      'An if line ends with a colon; the next line must be indented to belong to it.',
      'Do not remove the # from the debug line: commented-out code is a common temporary switch.',
    ],
    predict: {
      prompt: 'What does Python do with a line that starts with #?',
      answer: 'Skips it',
      distractors: ['Prints it', 'Raises an error'],
    },
    compare: {
      note: 'Without indentation Python cannot tell which lines belong to the if.',
      wrong: 'if temperature > 30:\nprint("Hot day")',
      fixed: 'if temperature > 30:\n    print("Hot day")',
    },
    stretch: 'Stretch: change temperature to 20, predict which lines print, then run to check, and explain the result in a comment.',
  }),
  foundation({
    id: 'operators',
    topic: 'Operators',
    goal: 'Use whole-number division and an in-place update so the program prints 2 h 15 min, a total of 14, a grouped total of 20 and 15 points.',
    why: 'Python has two divisions: / always gives a float, // gives whole units and % the remainder. Multiplication runs before addition unless brackets say otherwise, and += updates a variable in place.',
    tasks: [
      'Split 135 minutes into whole hours with the right operator',
      'Add 5 to points with an assignment shortcut',
      'Run and compare Total with Grouped',
    ],
    taskInstructions: [
      'Replace the first ??? so hours is 2, not 2.25. The remainder line already uses %.',
      'Replace the second ??? with the operator that adds to points in place, so it becomes 15.',
      'Run and read why 2 + 3 * price is 14 while (2 + 3) * price is 20: * runs before + unless brackets say otherwise.',
    ],
    code: `# Lesson 6 — Operators
# Arithmetic: +  -  *  /  //  %  **
# Shortcuts:  +=  -=  *=

minutes = 135
hours = minutes ??? 60
rest = minutes % 60
print("Time:", hours, "h", rest, "min")

price = 4
total = 2 + 3 * price
grouped = (2 + 3) * price
print("Total:", total)
print("Grouped:", grouped)

points = 10
points ??? 5
print("Points:", points)
print("Power:", 2 ** 10)
`,
    codeIncludes: ['minutes // 60', 'points += 5'],
    printPatterns: ['^Time: 2 h 15 min$', '^Total: 14$', '^Grouped: 20$', '^Points: 15$', '^Power: 1024$'],
    hints: [
      '135 / 60 is 2.25. The operator for whole hours is //.',
      'points += 5 means points = points + 5.',
    ],
    predict: {
      prompt: 'What is 2 + 3 * 4?',
      answer: '14',
      distractors: ['20', '24'],
    },
    compare: {
      note: '/ always returns a float; // returns whole units.',
      wrong: 'hours = minutes / 60  # 2.25',
      fixed: 'hours = minutes // 60  # 2',
    },
    stretch: 'Stretch: convert 100000 seconds into days, hours and minutes using only // and %, and print one readable line.',
  }),
  foundation({
    id: 'string-methods',
    topic: 'String methods',
    goal: 'Clean a messy name with a string method and swap a word with replace, so the program prints Ada Lovelace, ada lovelace, 12 and I like Python.',
    why: 'Real text arrives with extra spaces and odd capitals. String methods like strip, title, lower, replace and find return a new cleaned string; the original never changes in place.',
    tasks: [
      'Remove the spaces around raw with a string method',
      'Replace Java with Python in the sentence',
      'Run and check the length is 12 after cleaning',
    ],
    taskInstructions: [
      'Replace the first ??? with the method name that removes spaces from both ends.',
      'Replace the second ??? with the new word, in quotes, so the sentence says Python.',
      'len counts characters. "Ada LOVELACE" has 12, so a different number means spaces are still there.',
    ],
    code: `# Lesson 8 — String methods
# A method is called on a value with a dot: text.lower()

raw = "   Ada LOVELACE   "
name = raw.???()
print(name.title())
print(name.lower())
print(len(name))

sentence = "I like Java"
print(sentence.replace("Java", ???))
print(sentence.find("like"))

print("Grace" + " " + "Hopper")
print("-" * 10)
`,
    codeIncludes: ['raw.strip()', 'replace("Java", "Python")'],
    printPatterns: ['^Ada Lovelace$', '^ada lovelace$', '^12$', '^I like Python$', '^Grace Hopper$', '^-{10}$'],
    hints: [
      'strip() removes spaces at both ends; lstrip and rstrip do one side.',
      'replace(old, new) needs both values as strings.',
    ],
    predict: {
      prompt: 'After name = raw.strip(), what is raw?',
      answer: 'Still "   Ada LOVELACE   "',
      distractors: ['"Ada LOVELACE"', 'Empty'],
    },
    compare: {
      note: 'String methods return a new string; keep the result.',
      wrong: 'raw.strip()\nprint(raw)',
      fixed: 'name = raw.strip()\nprint(name)',
    },
    stretch: 'Stretch: split "tea,coffee,juice" into a list with split(","), then join it back with " | " and print both results.',
  }),
  foundation({
    id: 'elif-and-or',
    topic: 'Combined conditions',
    goal: 'Finish the ticket rules with or and and, so ages 4, 70, a 30-year-old student, 12 and 30 cost 0, 8, 8, 10 and 14.',
    why: 'Real rules combine facts. or needs one side true, and needs both, and not flips a value. An elif chain stops at the first true branch, so the order of the rules matters.',
    tasks: [
      'Give seniors or students the reduced price with one keyword',
      'Write the teen rule for ages 6 to 17 using and',
      'Run and compare all five prices',
    ],
    taskInstructions: [
      'Replace the first ??? with the keyword that is true when either side is true.',
      'Replace the second ??? with a condition that is true for ages 6 up to and including 17, joined with and.',
      'Check every printed line; the 30-year-old student must pay 8 while the 30-year-old non-student pays 14.',
    ],
    code: `# Lesson 11 — Combined conditions
# and: both sides true   or: at least one true   not: flips True/False

def ticket_price(age, is_student):
    if age < 6:
        return 0
    elif age >= 65 ??? is_student:
        return 8
    elif ???:
        return 10
    else:
        return 14

for age, is_student in [(4, False), (70, False), (30, True), (12, False), (30, False)]:
    print(age, is_student, "->", ticket_price(age, is_student))
`,
    codeIncludes: ['age >= 65 or is_student', ' and '],
    printPatterns: ['^4 False -> 0$', '^70 False -> 8$', '^30 True -> 8$', '^12 False -> 10$', '^30 False -> 14$'],
    hints: [
      'A senior who is not a student should still get 8, so you need or, not and.',
      'age >= 6 and age < 18 covers 6 through 17. Python also allows 6 <= age < 18.',
    ],
    predict: {
      prompt: 'age = 70, is_student = False. Is age >= 65 or is_student true?',
      answer: 'True',
      distractors: ['False', 'Error'],
    },
    compare: {
      note: 'Write the full comparison on both sides of or.',
      wrong: 'if age == 6 or 7 or 8:',
      fixed: 'if age == 6 or age == 7 or age == 8:',
    },
    stretch: 'Stretch: add an is_weekend flag and use not so the student discount only applies when it is not the weekend, then add a case that proves it.',
  }),
  foundation({
    id: 'function-parameters',
    topic: 'Parameters & return values',
    goal: 'Call make_badge with a keyword argument and return two values from min_max, so the program prints GRACE (GUEST) and low 2 high 9.',
    why: 'Default values make parameters optional, keyword arguments let callers skip to the one they need, and a function can return several values at once as a tuple that the caller unpacks.',
    tasks: [
      'Make Grace’s badge uppercase with a keyword argument',
      'Return the smallest and largest number from min_max',
      'Run and check that low and high unpack correctly',
    ],
    taskInstructions: [
      'Replace the first ??? with uppercase=True. Do not pass role, so it keeps its default.',
      'Replace the second ??? with two values separated by a comma: min(numbers), max(numbers).',
      'low, high = min_max(...) unpacks the returned pair into two names.',
    ],
    code: `# Lesson 17 — Parameters and return values
# Defaults make parameters optional; keywords name the one you set.

def make_badge(name, role="guest", uppercase=False):
    text = f"{name} ({role})"
    if uppercase:
        return text.upper()
    return text

print(make_badge("Ada"))
print(make_badge("Linus", role="admin"))
print(make_badge("Grace", ???))

def min_max(numbers):
    return ???

low, high = min_max([7, 2, 9, 4])
print("low", low, "high", high)
`,
    codeIncludes: ['uppercase=True', 'return min(numbers), max(numbers)'],
    printPatterns: ['^Ada \\(guest\\)$', '^Linus \\(admin\\)$', '^GRACE \\(GUEST\\)$', '^low 2 high 9$'],
    hints: [
      'make_badge("Grace", True) would set role to True. Name the parameter: uppercase=True.',
      'return a, b returns a tuple (a, b).',
    ],
    predict: {
      prompt: 'What does make_badge("Ada") return?',
      answer: 'Ada (guest)',
      distractors: ['ADA (GUEST)', 'An error: role is missing'],
    },
    compare: {
      note: 'print shows a value; return hands it back so the caller can use it.',
      wrong: 'def min_max(numbers):\n    print(min(numbers), max(numbers))',
      fixed: 'def min_max(numbers):\n    return min(numbers), max(numbers)',
    },
    stretch: 'Stretch: add a separator parameter with a default of " " to make_badge and call it once by keyword with " - ".',
  }),
  foundation({
    id: 'variable-scope',
    topic: 'Local & global scope',
    goal: 'Finish add so it returns the new total and use it to update total, so the bad version leaves total at 0 and the good version reaches 12.',
    why: 'A name assigned inside a function is local: it exists only there and hides any global with the same name. Passing values in and returning results out keeps functions predictable without the global keyword.',
    tasks: [
      'Return the sum of current and amount from add',
      'Call add to update the global total',
      'Run and explain why the bad version prints 0',
    ],
    taskInstructions: [
      'Replace the first ??? with current + amount, using only the two parameters.',
      'Replace the second ??? with the function name, so total = add(total, 5).',
      'set_total_bad creates its own local total; the global one never changes.',
    ],
    code: `# Lesson 18 — Local and global scope
total = 0

def set_total_bad(amount):
    total = amount
    return total

set_total_bad(5)
print("after bad:", total)

def add(current, amount):
    return ???

total = ???(total, 5)
total = add(total, 7)
print("after add:", total)

def count_words(text):
    words = text.split()
    return len(words)

print("words:", count_words("one two three"))
print("is words global?", "words" in globals())
`,
    codeIncludes: ['return current + amount', 'total = add(total, 5)'],
    printPatterns: ['^after bad: 0$', '^after add: 12$', '^words: 3$', '^is words global\\? False$'],
    hints: [
      'A function sees its parameters as local names: current and amount.',
      'The global total only changes when you assign to it outside the function.',
    ],
    predict: {
      prompt: 'After set_total_bad(5), what is the global total?',
      answer: '0',
      distractors: ['5', 'An error'],
    },
    compare: {
      note: 'Return the new value instead of reaching for a global.',
      wrong: 'def add(amount):\n    global total\n    total += amount',
      fixed: 'def add(current, amount):\n    return current + amount',
    },
    stretch: 'Stretch: rewrite add with the global keyword, then write a comment explaining why the version with parameters is easier to test.',
  }),
  foundation({
    id: 'common-errors',
    topic: 'Common errors',
    goal: 'Fix the three lines that used to raise KeyError, IndexError and TypeError, so the program prints banana: 0, last: c and Age: 30.',
    why: 'Most beginner crashes are the same few errors. The last line of a traceback names the type, and each type points at one kind of fix: a missing key, an index past the end, or mixing text and numbers.',
    tasks: [
      'Give get a default so a missing key does not crash',
      'Read the last item with a negative index',
      'Turn age into text before joining it to a string',
    ],
    taskInstructions: [
      'Replace the first ??? with 0, the value to use when "banana" is not in prices.',
      'Replace the second ??? with -1, which always means the last item.',
      'Replace the third ??? with str(age) so both sides of + are strings.',
    ],
    code: `# Lesson 20 — Common errors
# Each comment shows the error the old line raised.

prices = {"apple": 1.2, "pear": 0.9}
# KeyError: 'banana'  <- was prices["banana"]
print("banana:", prices.get("banana", ???))

items = ["a", "b", "c"]
# IndexError: list index out of range  <- was items[3]
print("last:", items[???])

age = 30
# TypeError: can only concatenate str (not "int") to str  <- was "Age: " + age
print("Age: " + ???)
`,
    codeIncludes: ['prices.get("banana", 0)', 'items[-1]', 'str(age)'],
    printPatterns: ['^banana: 0$', '^last: c$', '^Age: 30$'],
    hints: [
      'dict.get(key, default) returns the default instead of raising KeyError.',
      'A list of 3 items has indexes 0, 1 and 2. Index -1 is the last one.',
    ],
    predict: {
      prompt: 'items = ["a", "b", "c"]. What does items[3] raise?',
      answer: 'IndexError',
      distractors: ['KeyError', 'It returns None'],
    },
    compare: {
      note: 'Convert numbers to text before joining with +, or use an f-string.',
      wrong: 'print("Age: " + age)',
      fixed: 'print(f"Age: {age}")',
    },
    stretch: 'Stretch: call int("forty-two"), read the ValueError it raises, and write a comment naming the fix you would use for user input.',
  }),
  foundation({
    id: 'classes-basics',
    topic: 'Classes & objects',
    goal: 'Store the starting balance on self and subtract in withdraw, so Ada ends with 120 EUR, Bob has 0 EUR and an overdraft prints Not enough money.',
    why: 'A class bundles data (attributes on self) with the functions that change it (methods). Each object made from the class keeps its own copy of the data, so Ada and Bob never share a balance.',
    tasks: [
      'Save the balance argument on self in __init__',
      'Subtract the amount in withdraw with an assignment shortcut',
      'Run and check both accounts',
    ],
    taskInstructions: [
      'Replace the first ??? with balance, the parameter passed to __init__.',
      'Replace the second ??? with -= so the balance goes down by amount.',
      'Ada starts at 100, deposits 50 and withdraws 30. Bob uses the default balance.',
    ],
    code: `# Lesson 24 — Classes and objects
class BankAccount:
    def __init__(self, owner, balance=0):
        self.owner = owner
        self.balance = ???

    def deposit(self, amount):
        self.balance += amount
        return self.balance

    def withdraw(self, amount):
        if amount > self.balance:
            return "Not enough money"
        self.balance ??? amount
        return self.balance

    def describe(self):
        return f"{self.owner} has {self.balance} EUR"

ada = BankAccount("Ada", 100)
bob = BankAccount("Bob")
ada.deposit(50)
print(ada.withdraw(500))
ada.withdraw(30)
print(ada.describe())
print(bob.describe())
`,
    codeIncludes: ['self.balance = balance', 'self.balance -= amount'],
    printPatterns: ['^Not enough money$', '^Ada has 120 EUR$', '^Bob has 0 EUR$'],
    hints: [
      'self is the object being built, so self.balance = balance stores it on that object.',
      'self.balance -= amount means self.balance = self.balance - amount.',
    ],
    predict: {
      prompt: 'ada.deposit(50) runs. Does bob.balance change?',
      answer: 'No, each object has its own balance',
      distractors: ['Yes, they share it', 'Only if Bob is created first'],
    },
    compare: {
      note: 'Without self., the value is a local variable that disappears after __init__.',
      wrong: 'def __init__(self, owner, balance=0):\n    balance = balance',
      fixed: 'def __init__(self, owner, balance=0):\n    self.balance = balance',
    },
    stretch: 'Stretch: add a history list attribute that records every deposit and withdrawal, and print it for Ada at the end.',
  }),
  foundation({
    id: 'inheritance',
    topic: 'Inheritance',
    goal: 'Call the parent initializer with super() and make EmailNotifier inherit from Notifier, so the email line uses the shared format and the SMS line uses its own.',
    why: 'Inheritance lets a child class reuse everything from a parent and replace only what differs. Overriding one method changes behavior while the shared send logic stays in one place.',
    tasks: [
      'Run the parent __init__ from SmsNotifier with super()',
      'Make EmailNotifier a child of Notifier',
      'Run and compare the email and SMS lines',
    ],
    taskInstructions: [
      'Replace the first ??? with super() so recipient is stored by Notifier.__init__.',
      'Replace the second ??? with the parent class name, so EmailNotifier gets send and format for free.',
      'The SMS line is cut to 20 characters by its own format method; the email line is not.',
    ],
    code: `# Lesson 25 — Inheritance
class Notifier:
    def __init__(self, recipient):
        self.recipient = recipient

    def format(self, message):
        return f"To {self.recipient}: {message}"

    def send(self, message):
        return self.format(message)

class SmsNotifier(Notifier):
    def __init__(self, recipient, phone):
        ???.__init__(recipient)
        self.phone = phone

    def format(self, message):
        return f"SMS {self.phone}: {message[:20]}"

class EmailNotifier(???):
    pass

for notifier in [EmailNotifier("ada@example.com"), SmsNotifier("Bob", "555-0100")]:
    print(notifier.send("Your order has shipped today"))

print("is a Notifier:", isinstance(SmsNotifier("Bob", "555-0100"), Notifier))
`,
    codeIncludes: ['super().__init__(recipient)', 'class EmailNotifier(Notifier)'],
    printPatterns: [
      '^To ada@example\\.com: Your order has shipped today$',
      '^SMS 555-0100: Your order has shipp$',
      '^is a Notifier: True$',
    ],
    hints: [
      'super() refers to the parent class, so super().__init__(recipient) runs Notifier.__init__.',
      'Put the parent in brackets after the class name: class Child(Parent):',
    ],
    predict: {
      prompt: 'SmsNotifier defines format. Which format does its send call?',
      answer: 'The SmsNotifier one',
      distractors: ['The Notifier one', 'Both'],
    },
    compare: {
      note: 'Call the parent initializer so its attributes exist.',
      wrong: 'def __init__(self, recipient, phone):\n    self.phone = phone',
      fixed: 'def __init__(self, recipient, phone):\n    super().__init__(recipient)\n    self.phone = phone',
    },
    stretch: 'Stretch: add a PushNotifier that overrides format to add a "[push]" prefix, then add it to the loop without changing send.',
  }),
  foundation({
    id: 'files-pathlib',
    topic: 'Files & paths',
    goal: 'Read the todo file back with pathlib and convert each CSV amount to a number, so the program prints 2 tasks and a total of 10 sold.',
    why: 'Most real data lives in files. pathlib joins paths with / and reads or writes text in one call, and csv.DictReader turns each row into a dictionary. Everything in a file is text until you convert it.',
    tasks: [
      'Read todo.txt back with the matching pathlib method',
      'Convert each amount to an int before adding it',
      'Run and check the task list and the total',
    ],
    taskInstructions: [
      'Replace the first ??? with read_text, the partner of write_text.',
      'Replace the second ??? with int so the text "3" becomes the number 3.',
      'These files live in the playground’s in-browser file system, not on your computer.',
    ],
    code: `# Lesson 26 — Files and paths
# Files here live in the browser's memory, not on your disk.
from pathlib import Path
import csv

folder = Path("notes")
folder.mkdir(exist_ok=True)
todo = folder / "todo.txt"
todo.write_text("buy milk\\ncall Ada\\n")

lines = todo.???().splitlines()
print(len(lines), "tasks:", lines)

sales = folder / "sales.csv"
with open(sales, "w", newline="") as file:
    writer = csv.writer(file)
    writer.writerow(["product", "amount"])
    writer.writerows([["tea", 3], ["coffee", 5], ["tea", 2]])

total = 0
with open(sales, newline="") as file:
    for row in csv.DictReader(file):
        total += ???(row["amount"])
print("total sold:", total)
print("name:", todo.name, "suffix:", todo.suffix, "exists:", todo.exists())
`,
    codeIncludes: ['todo.read_text()', 'int(row["amount"])'],
    printPatterns: [
      "^2 tasks: \\['buy milk', 'call Ada'\\]$",
      '^total sold: 10$',
      '^name: todo\\.txt suffix: \\.txt exists: True$',
    ],
    hints: [
      'Path has write_text and read_text; each takes or returns the whole file as one string.',
      'CSV values are always strings. Adding "3" to a number raises TypeError.',
    ],
    predict: {
      prompt: 'What type is row["amount"] when read from a CSV?',
      answer: 'str',
      distractors: ['int', 'float'],
    },
    compare: {
      note: 'Use with open(...) so the file closes even if something fails.',
      wrong: 'file = open(sales)\nrows = file.read()',
      fixed: 'with open(sales) as file:\n    rows = file.read()',
    },
    stretch: 'Stretch: total the amounts per product with a dictionary and write the result to summary.csv, then read it back and print it.',
  }),
  foundation({
    id: 'modules-imports',
    topic: 'Modules & imports',
    goal: 'Import your own helpers module under a short name and import only sqrt from math, so the program prints hello world, 4.0, hi and True.',
    why: 'Any .py file is a module you can import, which is how bigger programs are split into files. Python finds modules through sys.path, and import x as y or from x import y control the names you get.',
    tasks: [
      'Import helpers under the name h',
      'Import only sqrt from the math module',
      'Run and check that your helper cleaned the text',
    ],
    taskInstructions: [
      'Replace the first ??? with helpers, the file written just above.',
      'Replace the second ??? with sqrt so it can be called without the math. prefix.',
      'clean is defined in helpers.py, so the call goes through h.clean.',
    ],
    code: `# Lesson 27 — Modules and imports
# Any .py file is a module. Write one, then import it.
import sys
from pathlib import Path

Path("helpers.py").write_text(
    'GREETING = "hi"\\n'
    "def clean(text):\\n"
    '    return " ".join(text.split()).lower()\\n'
)
sys.path.insert(0, ".")
sys.modules.pop("helpers", None)  # forget the copy from an earlier run

import ??? as h
from math import ???

print(h.clean("  Hello    WORLD  "))
print(sqrt(16))
print(h.GREETING)
print("helpers" in sys.modules)
`,
    codeIncludes: ['import helpers as h', 'from math import sqrt'],
    printPatterns: ['^hello world$', '^4\\.0$', '^hi$', '^True$'],
    hints: [
      'import helpers as h gives the module a shorter name.',
      'from math import sqrt brings just that one function into your file.',
    ],
    predict: {
      prompt: 'After import helpers as h, how do you call clean?',
      answer: 'h.clean(...)',
      distractors: ['clean(...)', 'helpers.clean(...) only'],
    },
    compare: {
      note: 'from x import * hides where names come from; import what you use.',
      wrong: 'from math import *',
      fixed: 'from math import sqrt',
    },
    stretch: 'Stretch: add a second function to helpers.py, import it with from helpers import ..., and print sys.path[0] to see where Python looked first.',
  }),
]
