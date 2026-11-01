import type { LessonDraft } from '../examples'

/**
 * Browser-local adaptations of study-book concepts that need more than a
 * title-level mention. Frameworks and infrastructure are represented through
 * small deterministic models so every lesson remains runnable in Pyodide.
 */
export const STUDY_BOOK_AI_LESSON_DRAFTS: LessonDraft[] = [
  {
    id: 'ai-learning-paradigms-lifecycle',
    difficulty: 'ai',
    number: 37,
    topic: 'Learning paradigms & lifecycle',
    chapter: 'Study Book foundations',
    goal:
      'Classify three learning paradigms, complete an inspectable ML lifecycle, apply one gradient update, and expose both an overfitting signal and the role PyTorch autograd would play.',
    why:
      'Model training is more than choosing an algorithm: engineers must identify the learning signal, preserve honest evaluation boundaries, recognize overfitting, and understand what a tensor framework automates.',
    tasks: [
      'Map supervised, unsupervised, and reinforcement learning to their signals',
      'Complete the lifecycle through monitoring and compare learned embeddings',
      'Apply a backprop-style weight update and detect validation overfitting',
      'Describe the narrow role of PyTorch autograd without importing a framework',
    ],
    taskInstructions: [
      'Fill the unsupervised signal with "structure" so the mapping distinguishes labels, unlabeled structure, and rewards rather than treating every task as supervised.',
      'Append "monitor" to the ordered lifecycle and keep the embedding dot product visible; the vectors stand in for learned representations whose geometry can be compared.',
      'Subtract learning_rate * gradient from the current weight, then compare validation loss with training loss plus the declared tolerance so the widening gap prints True.',
      'Use the phrase "computes gradients" in the PyTorch role. The lesson models the contract of autograd rather than pretending that a scalar list is a real tensor graph.',
    ],
    code: `# AI 37 — Learning paradigms and the ML lifecycle
# Pure Python models decisions that a framework later automates.

PARADIGM_SIGNALS = {
    "supervised": "labels",
    "unsupervised": ???,
    "reinforcement": "rewards",
}

lifecycle = ["data", "train", "validate", "test", "deploy", ???]

def dot(left, right):
    return sum(a * b for a, b in zip(left, right))

def update_weight(weight, gradient, learning_rate):
    return weight - ???

def is_overfitting(training_loss, validation_loss, tolerance=0.10):
    return validation_loss > ???

emb_a = [0.8, 0.6]
emb_b = [1.0, 0.0]
new_weight = update_weight(1.0, gradient=2.0, learning_rate=0.1)

print("signals", PARADIGM_SIGNALS)
print("lifecycle", lifecycle)
print("embedding similarity", round(dot(emb_a, emb_b), 2))
print("updated weight", round(new_weight, 2))
print("overfit", is_overfitting(0.20, 0.45))
print("PyTorch role", "autograd tracks tensor operations and computes gradients")
`,
    goalCheck: {
      requireSuccess: true,
      requireFreshRun: true,
      mustEditStarter: true,
      noBlanks: true,
      codeIncludes: [
        '"structure"',
        '"monitor"',
        'learning_rate * gradient',
        'training_loss + tolerance',
        'computes gradients',
      ],
      printPatterns: [
        'signals.*supervised.*labels.*unsupervised.*structure.*reinforcement.*rewards',
        'lifecycle.*data.*train.*validate.*test.*deploy.*monitor',
        'embedding similarity 0.8',
        'updated weight 0.8',
        'overfit True',
        'PyTorch role.*computes gradients',
      ],
      minNonEmptyPrints: 6,
    },
    hints: [
      'Unsupervised learning looks for structure; monitoring follows deployment in the lifecycle.',
      'The update moves opposite the gradient, and the overfit comparison includes training_loss + tolerance.',
    ],
    predict: {
      prompt: 'Training loss falls while validation loss rises. What is the clearest diagnosis?',
      choices: ['Overfitting', 'Unsupervised learning', 'A successful test release'],
      correctIndex: 0,
    },
    compare: {
      note: 'Backpropagation supplies gradients; the optimizer still has to move parameters in the opposite direction.',
      wrong: 'weight = weight + learning_rate * gradient',
      fixed: 'weight = weight - learning_rate * gradient',
    },
    stretch:
      'Stretch: add a ranking paradigm example and print one lifecycle check that rejects using the test split for tuning.',
    pipeline: ['choose signal', 'learn representations', 'validate', 'update weights', 'monitor'],
  },
  {
    id: 'ai-transformer-block',
    difficulty: 'ai',
    number: 38,
    topic: 'Complete Transformer block',
    chapter: 'Study Book foundations',
    goal:
      'Build a full three-by-three attention matrix from embedded positions, combine two heads, then apply residual, LayerNorm, and FFN stages while distinguishing parallel training from sequential inference.',
    why:
      'A single attention row explains only one fragment of a Transformer; the complete block joins all-position attention, multiple representation heads, normalization, residual paths, and position-wise computation.',
    tasks: [
      'Combine token embeddings with positional vectors and score every query-key pair',
      'Normalize every matrix row and combine two different value heads',
      'Apply a residual connection, LayerNorm, and a position-wise FFN',
      'State why training can process positions together while decoding remains sequential',
    ],
    taskInstructions: [
      'Set the scale to sqrt(len(states[0])) and build one score against every key for every query; the resulting matrix must contain three rows of three weights.',
      'Pass each score row through softmax, then average the two head outputs dimension by dimension so the exercise preserves multiple attention views.',
      'Add each merged head vector back to its original state before LayerNorm, and divide variance by len(vector) so every normalized row has mean approximately zero.',
      'Complete the inference description with "one new token sequentially"; the training description deliberately says all positions can be processed together with a causal mask.',
    ],
    code: `# AI 38 — A complete Transformer block, reduced to tiny vectors
import math

token_embeddings = [[1.0, 0.0], [0.5, 0.5], [0.0, 1.0]]
positions = [[0.0, 0.1], [0.1, 0.0], [0.1, 0.1]]
states = [
    [token[d] + position[d] for d in range(2)]
    for token, position in zip(token_embeddings, positions)
]

def dot(left, right):
    return sum(a * b for a, b in zip(left, right))

def softmax(values):
    offset = max(values)
    weights = [math.exp(value - offset) for value in values]
    total = sum(weights)
    return [weight / total for weight in weights]

def full_attention_matrix(rows):
    scale = math.sqrt(???)
    return [
        softmax([dot(query, key) / scale for key in rows])
        for query in rows
    ]

def attend(matrix, values):
    return [
        [
            sum(weight * values[key_index][dimension]
                for key_index, weight in enumerate(weight_row))
            for dimension in range(len(values[0]))
        ]
        for weight_row in matrix
    ]

def layer_norm(vector):
    mean = sum(vector) / len(vector)
    variance = sum((value - mean) ** 2 for value in vector) / ???
    scale = math.sqrt(variance + 1e-6)
    return [(value - mean) / scale for value in vector]

matrix = full_attention_matrix(states)
head_a = attend(matrix, states)
head_b = attend(matrix, [[row[1], row[0]] for row in states])
merged = [
    [(head_a[i][d] + head_b[i][d]) / 2 for d in range(2)]
    for i in range(len(states))
]
residual = [
    [states[i][d] + ??? for d in range(2)]
    for i in range(len(states))
]
normalized = [layer_norm(row) for row in residual]
ffn = [[max(0.0, value) * 0.5 for value in row] for row in normalized]
block_output = [
    [normalized[i][d] + ffn[i][d] for d in range(2)]
    for i in range(len(states))
]

modes = {
    "training": "all positions in parallel with a causal mask",
    "inference": ???,
}

print("matrix shape", len(matrix), "x", len(matrix[0]))
print("row sums", [round(sum(row), 6) for row in matrix])
print("heads", 2, "block shape", len(block_output), "x", len(block_output[0]))
print("normalized means", [round(sum(row) / len(row), 6) for row in normalized])
print("modes", modes)
`,
    goalCheck: {
      requireSuccess: true,
      requireFreshRun: true,
      mustEditStarter: true,
      noBlanks: true,
      codeIncludes: [
        'math.sqrt(len(rows[0]))',
        '/ len(vector)',
        'merged[i][d]',
        '"one new token sequentially"',
        'head_a',
        'head_b',
      ],
      printPatterns: [
        'matrix shape 3 x 3',
        'row sums.*1.0.*1.0.*1.0',
        'heads 2 block shape 3 x 2',
        'normalized means.*0.0.*0.0.*0.0',
        'modes.*parallel.*sequentially',
      ],
      minNonEmptyPrints: 5,
    },
    hints: [
      'The attention scale uses the key width: math.sqrt(len(rows[0])).',
      'Variance is an average; the residual term at position i and dimension d is merged[i][d].',
    ],
    predict: {
      prompt: 'Which Transformer component gives each position a direct path back to its prior representation?',
      choices: ['Residual connection', 'Top-k sampling', 'A train/test split'],
      correctIndex: 0,
    },
    compare: {
      note: 'Attention alone is not a complete Transformer block; normalization, residuals, and the FFN are essential stages.',
      wrong: 'block_output = attention(states)',
      fixed: 'block_output = residual_then_layer_norm_then_ffn(attention(states))',
    },
    stretch:
      'Stretch: apply an upper-triangular causal mask to the matrix and prove the first query assigns zero weight to future positions.',
    pipeline: ['embed + position', 'full attention', 'multi-head merge', 'residual + norm', 'FFN'],
  },
  {
    id: 'ai-markov-chains',
    difficulty: 'ai',
    number: 39,
    topic: 'Markov chains',
    chapter: 'Study Book foundations',
    goal:
      'Simulate a deterministic walk through a transition matrix, state the memoryless property, connect four historical applications, and explicitly distinguish fixed-state Markov memory from an LLM context window.',
    why:
      'Markov chains explain important simulation and ranking systems, but their current-state assumption is also the precise reason that calling a long-context Transformer “just a Markov chain” is misleading.',
    tasks: [
      'Choose the next state from only the current state and a deterministic roll',
      'Run a reproducible weather-chain path and expose the memoryless property',
      'Connect Pushkin, PageRank, MCMC, and HMMs to their actual uses',
      'Contrast fixed-state conditioning with attention over an LLM context window',
    ],
    taskInstructions: [
      'Look up options with transitions[current] rather than the full path, then return the first state whose cumulative probability reaches the supplied deterministic roll.',
      'Use the four declared rolls to append exactly four next states and keep the printed path reproducible without random or wall-clock behavior.',
      'Fill PageRank with "random surfer with damping" and keep the Pushkin, MCMC, and HMM descriptions visible so this is more than a weather toy.',
      'Set the LLM comparison to "attention over the context window"; that phrase makes the key memory distinction explicit instead of equating next-token prediction with a Markov chain.',
    ],
    code: `# AI 39 — Markov chains from transitions to PageRank
TRANSITIONS = {
    "sunny": [("sunny", 0.7), ("rainy", 0.3)],
    "rainy": [("sunny", 0.4), ("rainy", 0.6)],
}

def next_state(current, roll):
    cumulative = 0.0
    for candidate, probability in ???:
        cumulative += probability
        if roll <= cumulative:
            return candidate
    return TRANSITIONS[current][-1][0]

path = ["sunny"]
for roll in [0.8, 0.5, 0.2, 0.9]:
    path.append(next_state(path[-1], roll))

applications = {
    "Pushkin": "letter dependence and convergence without independence",
    "PageRank": ???,
    "MCMC": "sampling from difficult posterior distributions",
    "HMM": "hidden-state sequence and regime modeling",
}
memory = {
    "Markov": "next state uses the current state only",
    "LLM": ???,
}
damping = ???

print("path", path)
print("property", "memoryless: next depends only on current state")
print("applications", applications)
print("memory contrast", memory)
print("PageRank damping", damping)
`,
    goalCheck: {
      requireSuccess: true,
      requireFreshRun: true,
      mustEditStarter: true,
      noBlanks: true,
      codeIncludes: [
        'TRANSITIONS[current]',
        '"random surfer with damping"',
        '"attention over the context window"',
        '0.85',
      ],
      printPatterns: [
        'path.*sunny.*rainy.*rainy.*sunny.*rainy',
        'property.*memoryless.*current state',
        'applications.*Pushkin.*PageRank.*MCMC.*HMM',
        'memory contrast.*current state only.*context window',
        'PageRank damping 0.85',
      ],
      minNonEmptyPrints: 5,
    },
    hints: [
      'Iterate over TRANSITIONS[current]; the path is deliberately not an input to the transition lookup.',
      'PageRank models a random surfer with damping, while an LLM uses attention over its context window.',
    ],
    predict: {
      prompt: 'What defines the first-order Markov property?',
      choices: ['The next state depends only on the current state', 'Every state has equal probability', 'The full history is always stored'],
      correctIndex: 0,
    },
    compare: {
      note: 'Both systems can predict a next item, but they condition on fundamentally different amounts of history.',
      wrong: 'LLMs are just Markov chains because both predict next tokens.',
      fixed: 'Markov uses current state; a Transformer attends over a long context window.',
    },
    stretch:
      'Stretch: count visits across one hundred deterministic rolls and compare the long-run sunny share with a second starting state.',
    pipeline: ['current state', 'transition probabilities', 'simulate', 'connect applications', 'contrast memory'],
  },
  {
    id: 'ai-data-science-workflow',
    difficulty: 'ai',
    number: 40,
    topic: 'Data-science workflow',
    chapter: 'Study Book classical ML',
    goal:
      'Audit and clean tabular rows, fit imputation only on a training fold, apply the frozen preprocessing to validation, and explain where NumPy, pandas, and scikit-learn belong.',
    why:
      'Reliable tabular modeling depends on reproducible exploration and preprocessing boundaries; fitting a scaler or imputer on all rows leaks validation statistics before a model is evaluated.',
    tasks: [
      'Assign NumPy, pandas, and scikit-learn their distinct workflow roles',
      'Report missingness, duplicates, skew clues, categories, and raw range',
      'Deduplicate training rows and fit an imputation value from training only',
      'Transform validation with the frozen fit and compare loop versus vectorized intent',
    ],
    taskInstructions: [
      'Fill the three role strings so NumPy owns vectorized array math, pandas owns labeled tabular exploration, and scikit-learn owns fit/transform/predict pipelines.',
      'Count a row as missing when amount is None, count repeated IDs separately, and keep the large maximum visible as an outlier or skew clue rather than deleting it silently.',
      'Add every first-seen ID to seen, then compute the median from observed training amounts only; the validation fold must never contribute to this fit.',
      'Use the fitted median for missing validation amounts and cap values through the same transform. The two doubling outputs should match while the role text explains why real array vectorization is faster.',
    ],
    code: `# AI 40 — A library-shaped data-science workflow in pure Python
LIBRARY_ROLES = {
    "NumPy": ???,
    "pandas": ???,
    "scikit-learn": ???,
}

train_raw = [
    {"id": "r1", "amount": "10", "sector": "tech"},
    {"id": "r2", "amount": None, "sector": "finance"},
    {"id": "r2", "amount": None, "sector": "finance"},
    {"id": "r3", "amount": "30", "sector": "tech"},
    {"id": "r4", "amount": "1000", "sector": "energy"},
]
validation_raw = [{"id": "v1", "amount": None, "sector": "tech"}]

def eda(rows):
    ids = [row["id"] for row in rows]
    amounts = [float(row["amount"]) for row in rows if row["amount"] is not None]
    return {
        "rows": len(rows),
        "missing": sum(row["amount"] is None for row in rows),
        "duplicates": len(ids) - len(set(ids)),
        "range": (min(amounts), max(amounts)),
        "categories": sorted({row["sector"] for row in rows}),
    }

def deduplicate(rows):
    clean = []
    seen = set()
    for row in rows:
        if row["id"] in seen:
            continue
        ???.add(row["id"])
        clean.append(dict(row))
    return clean

def fit_preprocessor(rows):
    observed = sorted(float(row["amount"]) for row in rows if row["amount"] is not None)
    median = observed[???]
    return {"median": median, "cap": 100.0}

def transform(rows, fitted):
    transformed = []
    for row in rows:
        amount = fitted["median"] if row["amount"] is None else float(row["amount"])
        transformed.append({**row, "amount": min(amount, fitted["cap"])})
    return transformed

clean_train = deduplicate(train_raw)
fitted = fit_preprocessor(clean_train)
validation = transform(validation_raw, fitted)
numbers = [1, 2, 3]
loop_result = []
for number in numbers:
    loop_result.append(number * 2)
vectorized_intent = [number * 2 for number in numbers]

print("roles", LIBRARY_ROLES)
print("eda", eda(train_raw))
print("fitted on train", fitted)
print("validation", validation)
print("loop equals vectorized intent", loop_result == vectorized_intent)
`,
    goalCheck: {
      requireSuccess: true,
      requireFreshRun: true,
      mustEditStarter: true,
      noBlanks: true,
      codeIncludes: [
        '"vectorized array math"',
        '"labeled tabular exploration"',
        '"fit transform predict pipelines"',
        'seen.add',
        'len(observed) // 2',
      ],
      printPatterns: [
        'roles.*NumPy.*vectorized.*pandas.*tabular.*scikit-learn.*fit transform predict',
        "eda.*'missing': 2.*'duplicates': 1.*1000",
        "fitted on train.*'median': 30.0.*'cap': 100.0",
        "validation.*'amount': 30.0",
        'loop equals vectorized intent True',
      ],
      minNonEmptyPrints: 5,
    },
    hints: [
      'The three role strings are "vectorized array math", "labeled tabular exploration", and "fit transform predict pipelines".',
      'Use seen.add(row["id"]) and choose observed[len(observed) // 2] after sorting.',
    ],
    predict: {
      prompt: 'Where should an imputer learn its fill value during cross-validation?',
      choices: ['Inside each training fold', 'From the full dataset', 'From the final test answers'],
      correctIndex: 0,
    },
    compare: {
      note: 'A reproducible pipeline learns preprocessing statistics from training data and only applies them elsewhere.',
      wrong: 'median = median(train + validation + test)',
      fixed: 'median = fit(train); validation = transform(validation, median)',
    },
    stretch:
      'Stretch: add a string date and high-cardinality category audit, then print a warning without fitting either transform on validation.',
    pipeline: ['load', 'EDA', 'clean', 'fit preprocessing on train', 'transform', 'evaluate'],
  },
  {
    id: 'ai-boosting-decisions',
    difficulty: 'ai',
    number: 41,
    topic: 'Boosting decisions',
    chapter: 'Study Book classical ML',
    goal:
      'Contrast bagging with boosting, select XGBoost, LightGBM, or CatBoost from data constraints, apply early stopping, and pair global versus local explanations with appropriate methods.',
    why:
      'Knowing residual updates is not enough to choose a production tree ensemble; dataset size, categorical structure, regularization, stopping policy, and explanation needs all shape the decision.',
    tasks: [
      'Describe how bagging and boosting differ in training order and error behavior',
      'Choose among XGBoost, LightGBM, and CatBoost from explicit constraints',
      'Apply patience-based early stopping to a validation-loss history',
      'Expose the core tuning order and distinguish global from local explanation',
    ],
    taskInstructions: [
      'Set bagging to independent parallel trees that reduce variance and boosting to sequential residual-correcting trees that reduce bias; preserve both contrasts in printed output.',
      'Choose CatBoost for many categorical features, LightGBM for very large row counts, and XGBoost as the regularized default after those earlier conditions.',
      'Reset stale rounds on a new best loss, increment otherwise, and stop when stale reaches patience. The supplied history must stop at epoch five using zero-based indexes.',
      'Fill the local explanation with "SHAP values" while keeping permutation importance global; the tuning order must place a modest learning rate before complexity and regularization.',
    ],
    code: `# AI 41 — Choosing and operating a boosting system
ENSEMBLES = {
    "bagging": "independent parallel trees reduce variance",
    "boosting": ???,
}

def choose_library(rows, categorical_ratio):
    if categorical_ratio >= 0.40:
        return "CatBoost"
    if rows >= 1_000_000:
        return ???
    return ???

def stopping_epoch(validation_losses, patience):
    best = float("inf")
    stale = 0
    for epoch, loss in enumerate(validation_losses):
        if loss < best:
            best = loss
            stale = 0
        else:
            stale += 1
        if stale >= ???:
            return epoch
    return len(validation_losses) - 1

tuning_order = [
    "modest learning rate",
    "tree depth or leaves",
    "row and column subsampling",
    "L1/L2 regularization",
    "more estimators with early stopping",
]
explanations = {
    "global": "permutation importance",
    "local": ???,
}

losses = [0.62, 0.51, 0.46, 0.45, 0.47, 0.49, 0.50]
print("ensembles", ENSEMBLES)
print("choices", choose_library(50_000, 0.60), choose_library(2_000_000, 0.05), choose_library(50_000, 0.05))
print("stop epoch", stopping_epoch(losses, patience=2))
print("tuning", tuning_order)
print("explanations", explanations)
`,
    goalCheck: {
      requireSuccess: true,
      requireFreshRun: true,
      mustEditStarter: true,
      noBlanks: true,
      codeIncludes: [
        '"sequential residual-correcting trees reduce bias"',
        '"LightGBM"',
        '"XGBoost"',
        'stale >= patience',
        '"SHAP values"',
      ],
      printPatterns: [
        'ensembles.*bagging.*parallel.*variance.*boosting.*sequential.*bias',
        'choices CatBoost LightGBM XGBoost',
        'stop epoch 5',
        'tuning.*learning rate.*depth.*subsampling.*regularization.*early stopping',
        'explanations.*permutation importance.*SHAP values',
      ],
      minNonEmptyPrints: 5,
    },
    hints: [
      'The library order is CatBoost for categoricals, LightGBM for scale, then XGBoost as the default.',
      'Stop once stale >= patience; SHAP values provide a local per-prediction explanation.',
    ],
    predict: {
      prompt: 'Which library has native categorical handling and ordered boosting?',
      choices: ['CatBoost', 'LightGBM', 'Random Forest'],
      correctIndex: 0,
    },
    compare: {
      note: 'Bagging trains independent trees, while boosting depends on the current ensemble error and therefore trains sequentially.',
      wrong: 'boosting = "average unrelated deep trees"',
      fixed: 'boosting = "sequential trees correct residual errors"',
    },
    stretch:
      'Stretch: add a regulated-use flag that requires both local SHAP output and a global permutation-importance report.',
    pipeline: ['choose ensemble', 'choose library', 'tune', 'early-stop', 'explain'],
  },
  {
    id: 'ai-frameworks-bias-variance',
    difficulty: 'ai',
    number: 42,
    topic: 'Frameworks & bias-variance',
    chapter: 'Study Book classical ML',
    goal:
      'Diagnose underfitting and overfitting from train-validation losses, compare TensorFlow/Keras with PyTorch, and select layers plus training controls for tabular, image, and sequence work.',
    why:
      'Framework names are useful only when connected to model behavior: engineers must read the bias-variance signal, choose suitable building blocks, and know which API owns the training loop.',
    tasks: [
      'Classify underfit, overfit, and balanced loss pairs with explicit boundaries',
      'Describe Keras model.fit and PyTorch nn.Module plus dynamic autograd',
      'Map data shapes to Dense, Conv, Embedding, and sequence layers',
      'List optimizer, schedule, batch, regularization, and early-stopping controls',
    ],
    taskInstructions: [
      'Return "underfit" when both losses remain high, then return "overfit" when validation exceeds training by more than the gap; all other supplied pairs are balanced.',
      'Fill the PyTorch API with "nn.Module + explicit loop" and retain dynamic autograd, while Keras remains the high-level compile/model.fit path.',
      'Choose Conv for images and LSTM/attention for sequences; keep Dense for tabular data and Embedding for categorical or token IDs.',
      'Add early stopping to the controls beside Adam, learning-rate schedule, batch size, dropout, and weight decay so the remedy is executable policy rather than vague advice.',
    ],
    code: `# AI 42 — Framework choice starts with the learning curves
def diagnose(training_loss, validation_loss, high=0.50, gap=0.15):
    if training_loss >= high and validation_loss >= high:
        return ???
    if validation_loss - training_loss > ???:
        return "overfit"
    return "balanced"

frameworks = {
    "TensorFlow/Keras": {
        "api": "compile + model.fit",
        "graph": "eager by default with production serving tools",
    },
    "PyTorch": {
        "api": ???,
        "graph": "dynamic autograd is pythonic to debug",
    },
}
layers = {
    "tabular": "Dense",
    "images": ???,
    "tokens": "Embedding",
    "sequences": ???,
}
training_controls = [
    "Adam optimizer",
    "learning-rate schedule",
    "batch size",
    "dropout",
    "weight decay",
    ???,
]

print("diagnoses", diagnose(0.70, 0.72), diagnose(0.10, 0.40), diagnose(0.20, 0.27))
print("frameworks", frameworks)
print("layers", layers)
print("controls", training_controls)
print("default", "boosting for tabular; deep learning for images, text, audio, sequences")
`,
    goalCheck: {
      requireSuccess: true,
      requireFreshRun: true,
      mustEditStarter: true,
      noBlanks: true,
      codeIncludes: [
        '"underfit"',
        'validation_loss - training_loss > gap',
        '"nn.Module + explicit loop"',
        '"Conv"',
        '"LSTM or attention"',
        '"early stopping"',
      ],
      printPatterns: [
        'diagnoses underfit overfit balanced',
        'frameworks.*model.fit.*nn.Module.*dynamic autograd',
        'layers.*Dense.*Conv.*Embedding.*LSTM or attention',
        'controls.*Adam.*schedule.*batch size.*dropout.*weight decay.*early stopping',
        'default.*boosting for tabular.*deep learning',
      ],
      minNonEmptyPrints: 5,
    },
    hints: [
      'The diagnosis blanks are "underfit" and gap; PyTorch uses an nn.Module plus an explicit loop.',
      'Images use Conv layers, sequences use LSTM or attention, and early stopping watches validation.',
    ],
    predict: {
      prompt: 'Train loss falls while validation loss rises. Which remedy is appropriate?',
      choices: ['Early stopping or stronger regularization', 'Train on the test set', 'Remove validation'],
      correctIndex: 0,
    },
    compare: {
      note: 'The same training math can be exposed through a manual PyTorch loop or hidden behind Keras model.fit.',
      wrong: 'PyTorch and Keras use unrelated learning mathematics.',
      fixed: 'Both perform forward, loss, gradient, and update steps through different APIs.',
    },
    stretch:
      'Stretch: add a rule that recommends a smaller model for overfitting and a higher-capacity model for underfitting.',
    pipeline: ['read curves', 'diagnose bias/variance', 'choose framework', 'choose layers', 'control training'],
  },
  {
    id: 'ai-spark-dataflow',
    difficulty: 'ai',
    number: 43,
    topic: 'Spark dataflow',
    chapter: 'Study Book production ML',
    goal:
      'Execute a local map-shuffle-reduce simulation over partitions, preserve Spark lazy-plan terminology, distinguish driver from executors and DataFrames from RDDs, and choose batch or streaming.',
    why:
      'Distributed processing becomes understandable when planning, partition-local work, network shuffles, and aggregation are kept separate; the same model explains Spark performance without running a cluster.',
    tasks: [
      'Create partitions and map records locally before any cross-partition movement',
      'Shuffle mapped pairs by key and reduce each group to a stable total',
      'Identify lazy transformations, actions, driver, executors, DataFrame, and RDD roles',
      'Choose batch or streaming from a concrete freshness requirement',
    ],
    taskInstructions: [
      'Build two partitions with slicing stride workers, then emit key/value pairs inside each partition; this models executor-local map work before the expensive shuffle.',
      'Append each mapped value to shuffled[key], then sum each group. Results must retain both region keys and total 17 across all records.',
      'Fill the preferred API with "DataFrame/SQL" and keep collect labeled dangerous because moving an unbounded result to the driver can exhaust its memory.',
      'Return streaming only when freshness_minutes is at most one; nightly work must select batch and preserve the explanation that streaming needs recovery.',
    ],
    code: `# AI 43 — Spark concepts through a deterministic local dataflow
from collections import defaultdict

records = [
    {"region": "east", "value": 4},
    {"region": "west", "value": 7},
    {"region": "east", "value": 6},
]
lazy_plan = ["filter value > 0", "select region,value", "groupBy region"]

def partition(rows, workers):
    return [rows[index::workers] for index in range(workers)]

def map_partition(rows):
    return [(row["region"], row["value"]) for row in rows]

def shuffle_and_reduce(mapped_partitions):
    shuffled = defaultdict(list)
    for mapped in mapped_partitions:
        for key, value in mapped:
            ???[key].append(value)
    return {key: sum(values) for key, values in sorted(shuffled.items())}

def choose_mode(freshness_minutes):
    return "streaming" if ??? else "batch"

parts = partition(records, workers=2)
mapped = [map_partition(part) for part in parts]
totals = shuffle_and_reduce(mapped)
roles = {
    "driver": "builds the plan and coordinates actions",
    "executors": "run tasks on partitions",
    "preferred api": ???,
    "RDD": "low-level edge cases",
    "collect": "dangerous when results do not fit on the driver",
}

print("lazy", lazy_plan, "action", "reduce totals")
print("partitions", parts)
print("totals", totals, "grand", sum(totals.values()))
print("roles", roles)
print("modes", choose_mode(0.5), choose_mode(720))
`,
    goalCheck: {
      requireSuccess: true,
      requireFreshRun: true,
      mustEditStarter: true,
      noBlanks: true,
      codeIncludes: [
        'shuffled[key]',
        'freshness_minutes <= 1',
        '"DataFrame/SQL"',
        'defaultdict',
        'rows[index::workers]',
      ],
      printPatterns: [
        'lazy.*filter.*groupBy.*action.*reduce',
        'partitions.*east.*west',
        "totals.*'east': 10.*'west': 7.*grand 17",
        'roles.*driver.*executors.*DataFrame/SQL.*RDD.*collect.*dangerous',
        'modes streaming batch',
      ],
      minNonEmptyPrints: 5,
    },
    hints: [
      'The shuffle blank is shuffled[key], and streaming is selected for freshness_minutes <= 1.',
      'Spark normally prefers the optimized DataFrame/SQL API; raw RDDs are for unusual low-level needs.',
    ],
    predict: {
      prompt: 'Which common Spark operations usually trigger an expensive network shuffle?',
      choices: ['groupBy and join', 'select and filter only', 'Reading one local variable'],
      correctIndex: 0,
    },
    compare: {
      note: 'Transformations build a lazy plan; an action triggers executor work and any required shuffle.',
      wrong: 'collect every row to the driver, then group it',
      fixed: 'map partitions, shuffle by key, and reduce on the cluster',
    },
    stretch:
      'Stretch: add a tiny lookup table and simulate a broadcast join that avoids shuffling the larger record collection.',
    pipeline: ['lazy plan', 'partition', 'map locally', 'shuffle', 'reduce or stream'],
  },
  {
    id: 'ai-optimization-quantization',
    difficulty: 'ai',
    number: 44,
    topic: 'Optimization & quantization',
    chapter: 'Study Book production ML',
    goal:
      'Calculate model memory under quantization, choose prompt versus KV caching, compare distillation with QLoRA, and select hosted or self-hosted deployment from volume and residency constraints.',
    why:
      'Inference optimization is a set of explicit cost-quality-memory trades rather than one magic switch; caching, precision, adaptation, and hosting decisions solve different bottlenecks.',
    tasks: [
      'Compare fp16 and int4 parameter memory with one transparent formula',
      'Select prompt-response and KV caches from repeated-request structure',
      'Differentiate quantization, distillation, and QLoRA responsibilities',
      'Choose hosted API or self-hosting from volume and data-residency needs',
    ],
    taskInstructions: [
      'Convert parameter count times bit width into gigabytes by dividing by eight and one billion; use four bits for the quantized result so 7B parameters print 3.5 GB.',
      'Enable the prompt cache only for an identical full request and the KV cache for a repeated prefix; the two cache decisions must remain independent.',
      'Fill QLoRA with "train adapters over a quantized base" while retaining distillation as teacher-to-student behavior transfer.',
      'Choose self-hosted when residency is mandatory or monthly volume reaches the declared threshold; otherwise preserve the hosted API default.',
    ],
    code: `# AI 44 — Optimization levers without loading a real model
def parameter_gb(parameters, bits_per_parameter):
    return parameters * bits_per_parameter / 8 / 1_000_000_000

def cache_plan(repeated_request, repeated_prefix):
    return {
        "prompt cache": bool(???),
        "KV cache": bool(???),
    }

def hosting(monthly_tokens, residency_required):
    if residency_required or monthly_tokens >= ???:
        return "self-hosted"
    return "hosted API"

techniques = {
    "quantization": "fewer bits reduce memory with possible quality loss",
    "distillation": "a smaller student imitates a larger teacher",
    "QLoRA": ???,
}

parameters = 7_000_000_000
print("memory GB", {"fp16": parameter_gb(parameters, 16), "int4": parameter_gb(parameters, ???)})
print("caches", cache_plan(True, False), cache_plan(False, True))
print("techniques", techniques)
print("hosting", hosting(2_000_000, False), hosting(200_000_000, False), hosting(2_000_000, True))
print("tradeoff", "quality, latency, memory, cost, and data residency")
`,
    goalCheck: {
      requireSuccess: true,
      requireFreshRun: true,
      mustEditStarter: true,
      noBlanks: true,
      codeIncludes: [
        'bool(repeated_request)',
        'bool(repeated_prefix)',
        '100_000_000',
        '"train adapters over a quantized base"',
        'parameter_gb(parameters, 4)',
      ],
      printPatterns: [
        "memory GB.*'fp16': 14.0.*'int4': 3.5",
        "caches.*prompt cache': True.*KV cache': False.*prompt cache': False.*KV cache': True",
        'techniques.*quantization.*distillation.*QLoRA.*quantized base',
        'hosting hosted API self-hosted self-hosted',
        'tradeoff.*quality.*latency.*memory.*cost.*residency',
      ],
      minNonEmptyPrints: 5,
    },
    hints: [
      'Prompt caching follows repeated_request; KV caching follows repeated_prefix.',
      'Use 100_000_000 monthly tokens as the teaching threshold and four bits for int4.',
    ],
    predict: {
      prompt: 'What does a KV cache avoid recomputing during autoregressive generation?',
      choices: ['Past key and value projections', 'The training labels', 'The deployment region'],
      correctIndex: 0,
    },
    compare: {
      note: 'Quantization changes numeric precision; distillation transfers behavior into a smaller model.',
      wrong: 'quantization and distillation are the same compression method',
      fixed: 'quantize weights; distill teacher behavior into a student',
    },
    stretch:
      'Stretch: add an int8 option and print the memory-quality ordering for fp16, int8, and int4 deployments.',
    pipeline: ['measure bottleneck', 'cache', 'compress or adapt', 'estimate cost', 'choose hosting'],
  },
  {
    id: 'ai-query-rewrite-embeddings',
    difficulty: 'ai',
    number: 45,
    topic: 'Query rewriting & embeddings',
    chapter: 'Study Book GenAI',
    goal:
      'Validate and quarantine malformed documents, expand a query with governed synonyms, compare exact versus expanded embedding-like retrieval, and expose model-version metadata with every result.',
    why:
      'Retrieval quality begins before ranking: bad records need quarantine, user wording needs controlled normalization or expansion, and embedding behavior must be measured and versioned rather than assumed.',
    tasks: [
      'Validate document schema and quarantine missing IDs or empty text with reasons',
      'Rewrite query tokens through a small governed synonym dictionary',
      'Build deterministic count vectors and compare exact with expanded retrieval',
      'Attach the embedding model version so quality changes remain attributable',
    ],
    taskInstructions: [
      'Accept only records with a non-empty string id and non-empty text; append a reason-bearing quarantine record for each rejected input instead of silently dropping it.',
      'Extend each normalized query token with SYNONYMS.get(token, []) so refund adds reimbursement and latency adds delay without replacing the original exact terms.',
      'Count vocabulary terms into vectors, use cosine similarity, and rank descending. Exact retrieval should favor d2 while expanded retrieval should favor d1.',
      'Return the constant model version "domain-count-v2" beside every ranked result so a future embedding change can be evaluated and invalidated deliberately.',
    ],
    code: `# AI 45 — Data quality, query rewriting, and embedding quality
import math

RAW_DOCUMENTS = [
    {"id": "d1", "text": "reimbursement delay policy"},
    {"id": "d2", "text": "refund form"},
    {"id": "", "text": "orphan content"},
    {"id": "d3", "text": "   "},
]
SYNONYMS = {"refund": ["reimbursement"], "latency": ["delay"]}

def validate(rows):
    accepted, quarantined = [], []
    for row in rows:
        if not isinstance(row.get("id"), str) or not row["id"].strip():
            quarantined.append({"row": row, "reason": "missing id"})
        elif not isinstance(row.get("text"), str) or not row["text"].strip():
            quarantined.append({"row": row, "reason": "empty text"})
        else:
            accepted.append(dict(row))
    return accepted, quarantined

def rewrite(query):
    expanded = []
    for token in query.lower().split():
        expanded.append(token)
        expanded.extend(???)
    return expanded

def embed(tokens, vocabulary):
    return [tokens.count(term) for term in vocabulary]

def cosine(left, right):
    dot = sum(a * b for a, b in zip(left, right))
    norm_left = math.sqrt(sum(value * value for value in left))
    norm_right = math.sqrt(sum(value * value for value in right))
    return 0.0 if not norm_left or not norm_right else dot / (norm_left * norm_right)

def rank(query_tokens, documents):
    vocabulary = sorted(set(query_tokens) | {
        token for document in documents for token in document["text"].lower().split()
    })
    query_vector = embed(query_tokens, vocabulary)
    ranked = []
    for document in documents:
        score = cosine(query_vector, embed(document["text"].lower().split(), vocabulary))
        ranked.append({
            "id": document["id"],
            "score": round(score, 3),
            "embedding_model": ???,
        })
    return sorted(ranked, key=lambda row: (-row["score"], row["id"]))

documents, quarantine = validate(RAW_DOCUMENTS)
exact = rank(["refund", "latency"], documents)
expanded = rank(rewrite("refund latency"), documents)
print("accepted", [row["id"] for row in documents])
print("quarantine", [row["reason"] for row in quarantine])
print("rewritten", rewrite("refund latency"))
print("exact top", exact[0])
print("expanded top", expanded[0])
`,
    goalCheck: {
      requireSuccess: true,
      requireFreshRun: true,
      mustEditStarter: true,
      noBlanks: true,
      codeIncludes: [
        'SYNONYMS.get(token, [])',
        '"domain-count-v2"',
        'quarantined.append',
        'cosine',
        'embedding_model',
      ],
      printPatterns: [
        "accepted.*d1.*d2",
        'quarantine.*missing id.*empty text',
        'rewritten.*refund.*reimbursement.*latency.*delay',
        "exact top.*'id': 'd2'.*domain-count-v2",
        "expanded top.*'id': 'd1'.*domain-count-v2",
      ],
      minNonEmptyPrints: 5,
    },
    hints: [
      'The rewrite extension is SYNONYMS.get(token, []), preserving the original token as well.',
      'Use "domain-count-v2" as explicit provenance for each deterministic embedding-like result.',
    ],
    predict: {
      prompt: 'What should happen to a document with empty text during ingestion?',
      choices: ['Quarantine it with a reason', 'Embed it as all zeros and hide the issue', 'Invent replacement text'],
      correctIndex: 0,
    },
    compare: {
      note: 'Governed query expansion can bridge vocabulary mismatch, but every rewrite and embedding version remains measurable.',
      wrong: 'query = model_rewrites_anything(query)',
      fixed: 'query_tokens += governed_synonyms.get(token, [])',
    },
    stretch:
      'Stretch: add one ambiguous synonym and an evaluation case that rejects the rewrite when it lowers relevant-document rank.',
    pipeline: ['validate', 'quarantine', 'rewrite', 'embed', 'rank', 'measure quality'],
  },
  {
    id: 'ai-agent-react-planning',
    difficulty: 'ai',
    number: 46,
    topic: 'Agent ReAct & planning',
    chapter: 'Study Book GenAI',
    goal:
      'Choose a deterministic workflow before an agent, execute a bounded ReAct-style plan through validated schemas, separate planner from executor, and require approval for irreversible tools.',
    why:
      'Agent reliability comes from deterministic boundaries around model decisions: explicit plans, typed tool calls, limited steps, permission checks, and human approval matter more than autonomous-sounding labels.',
    tasks: [
      'Choose workflow or agent architecture from task uncertainty',
      'Create a planner output and validate every tool call against a schema',
      'Run a bounded observe-decide-act loop through a separate executor',
      'Compare single and multi-agent coordination and block unapproved side effects',
    ],
    taskInstructions: [
      'Return workflow when steps_known is true and agent otherwise; this preserves deterministic orchestration as the default rather than making every task autonomous.',
      'Require exactly the declared argument names for each tool and reject unknown tools. The planner may propose calls, but only the executor can validate and run them.',
      'Slice the plan to max_steps and append observation, decision, action, and result fields for each executed call so the ReAct-shaped trace stays inspectable and bounded.',
      'Block send_email unless approved is true, then return multi-agent only for independent specialisms without shared mutable state; otherwise prefer one agent.',
    ],
    code: `# AI 46 — Bounded planning and tool execution
TOOL_SCHEMAS = {
    "search_docs": {"required": {"query"}, "irreversible": False},
    "send_email": {"required": {"to", "body"}, "irreversible": True},
}

def architecture(steps_known):
    return "workflow" if ??? else "agent"

def validate_call(call):
    spec = TOOL_SCHEMAS.get(call.get("tool"))
    if spec is None:
        return False, "unknown tool"
    if set(call.get("args", {})) != spec["required"]:
        return False, "schema mismatch"
    if spec["irreversible"] and not call.get("approved", False):
        return False, "approval required"
    return True, "ok"

def planner(goal):
    return [
        {"tool": "search_docs", "args": {"query": goal}},
        {"tool": "send_email", "args": {"to": "reviewer", "body": "summary"}},
    ]

def executor(call):
    valid, status = validate_call(call)
    if not valid:
        return {"ok": False, "status": status}
    return {"ok": True, "status": "executed", "tool": call["tool"]}

def react(goal, observations, max_steps=2):
    trace = []
    for index, call in enumerate(planner(goal)[:???]):
        trace.append({
            "observation": observations[index],
            "decision": f"step {index + 1}",
            "action": call["tool"],
            "result": executor(call),
        })
    return trace

def coordination(independent_specialisms, shared_mutable_state):
    if independent_specialisms and not shared_mutable_state:
        return ???
    return "single-agent"

print("architecture", architecture(True), architecture(False))
print("trace", react("refund policy", ["need evidence", "need approval"]))
print("bad schema", validate_call({"tool": "search_docs", "args": {"text": "x"}}))
print("approved", executor({"tool": "send_email", "args": {"to": "reviewer", "body": "summary"}, "approved": True}))
print("coordination", coordination(True, False), coordination(True, True))
`,
    goalCheck: {
      requireSuccess: true,
      requireFreshRun: true,
      mustEditStarter: true,
      noBlanks: true,
      codeIncludes: [
        'steps_known',
        'planner(goal)[:max_steps]',
        '"multi-agent"',
        'approval required',
        'schema mismatch',
      ],
      printPatterns: [
        'architecture workflow agent',
        'trace.*search_docs.*executed.*send_email.*approval required',
        'bad schema.*False.*schema mismatch',
        'approved.*True.*executed.*send_email',
        'coordination multi-agent single-agent',
      ],
      minNonEmptyPrints: 5,
    },
    hints: [
      'The workflow condition is steps_known, the plan slice ends at max_steps, and independent work can return "multi-agent".',
      'Do not add approved=True inside planner; approval must arrive at the executor boundary.',
    ],
    predict: {
      prompt: 'Where should an irreversible agent action be authorized?',
      choices: ['At a deterministic executor approval gate', 'Inside an unconstrained model thought', 'After the action has completed'],
      correctIndex: 0,
    },
    compare: {
      note: 'A planner proposes intent; a typed executor validates permissions, arguments, approval, and step budgets.',
      wrong: 'for idea in model_output: run(idea)',
      fixed: 'plan → validate schema → authorize → execute → record result',
    },
    stretch:
      'Stretch: add a total tool-cost budget and prove a third planned call is skipped before any side effect occurs.',
    pipeline: ['choose workflow', 'plan', 'validate schema', 'authorize', 'execute', 'observe'],
  },
  {
    id: 'ai-capital-markets-timeseries',
    difficulty: 'ai',
    number: 47,
    topic: 'Capital markets & time series',
    chapter: 'Study Book domain ML',
    goal:
      'Derive spread, midpoint, and imbalance from an order-book snapshot, reject a future-derived feature, create walk-forward folds with purge and embargo gaps, and attach audit-ready explanations.',
    why:
      'Market data is ordered, non-stationary, and easy to leak; credible evaluation preserves time direction and trading gaps while regulated decisions require traceable global and local explanations.',
    tasks: [
      'Calculate order-book spread, midpoint, and size imbalance',
      'Reject target or future fields that are unavailable at prediction time',
      'Build forward-only train and test folds separated by an embargo',
      'Select permutation importance and SHAP for global and local explanations',
    ],
    taskInstructions: [
      'Subtract bid from ask for spread, average bid and ask for midpoint, and divide the size difference by total size for imbalance; keep every value deterministic.',
      'Set allowed features to bid, ask, bid_size, and ask_size only. The future_move target must print as rejected leakage rather than entering the feature row.',
      'Start each test window after train_size plus embargo and end training at test_start minus embargo, proving that test timestamps never appear in training.',
      'Fill the local explanation with SHAP and preserve permutation importance globally so both portfolio-level and per-decision review needs are represented.',
    ],
    code: `# AI 47 — Honest market features and temporal validation
snapshot = {
    "bid": 99.5,
    "ask": 100.5,
    "bid_size": 60,
    "ask_size": 40,
    "future_move": 1,
}
ALLOWED_FEATURES = {???}

def order_book_features(row):
    total_size = row["bid_size"] + row["ask_size"]
    return {
        "spread": row["ask"] - row["bid"],
        "midpoint": (row["ask"] + row["bid"]) / 2,
        "imbalance": (row["bid_size"] - row["ask_size"]) / total_size,
    }

def leakage_fields(row):
    return sorted(set(row) - ALLOWED_FEATURES)

def walk_forward(timestamps, train_size, test_size, embargo):
    folds = []
    for test_start in range(train_size + embargo, len(timestamps), test_size):
        train_end = test_start - ???
        train = timestamps[:train_end]
        test = timestamps[test_start:test_start + test_size]
        if train and test:
            folds.append({"train": train, "test": test})
    return folds

explanations = {
    "global": "permutation importance",
    "local": ???,
}
folds = walk_forward(list(range(8)), train_size=3, test_size=2, embargo=1)

print("features", order_book_features(snapshot))
print("leakage", leakage_fields(snapshot))
print("folds", folds)
print("forward only", all(max(fold["train"]) < min(fold["test"]) for fold in folds))
print("explanations", explanations)
`,
    goalCheck: {
      requireSuccess: true,
      requireFreshRun: true,
      mustEditStarter: true,
      noBlanks: true,
      codeIncludes: [
        '"bid", "ask", "bid_size", "ask_size"',
        'test_start - embargo',
        '"SHAP"',
        'row["ask"] - row["bid"]',
        'set(row) - ALLOWED_FEATURES',
      ],
      printPatterns: [
        "features.*'spread': 1.0.*'midpoint': 100.0.*'imbalance': 0.2",
        'leakage.*future_move',
        "folds.*'train': \\[0, 1, 2\\].*'test': \\[4, 5\\]",
        'forward only True',
        'explanations.*permutation importance.*SHAP',
      ],
      minNonEmptyPrints: 5,
    },
    hints: [
      'Allow only the four order-book fields; train_end is test_start - embargo.',
      'SHAP is the local explanation, while permutation importance summarizes global behavior.',
    ],
    predict: {
      prompt: 'Why is random k-fold unsafe for a trading time series?',
      choices: ['It can leak future regimes into training', 'It always creates too few rows', 'It removes every feature'],
      correctIndex: 0,
    },
    compare: {
      note: 'A high backtest score is meaningless when future-derived fields or future timestamps entered training.',
      wrong: 'shuffle all timestamps, then cross-validate',
      fixed: 'walk forward with purge/embargo gaps and prediction-time features only',
    },
    stretch:
      'Stretch: add a second instrument and purge overlapping label windows so neither entity nor future horizon crosses a fold boundary.',
    pipeline: ['order book', 'prediction-time features', 'purge + embargo', 'walk forward', 'explain'],
  },
  {
    id: 'ai-semantic-layer',
    difficulty: 'ai',
    number: 48,
    topic: 'Semantic layer & ontologies',
    chapter: 'Study Book semantic systems',
    goal:
      'Represent finance facts as RDF-like triples, validate them with a SHACL-like shape, apply taxonomy and ontology relationships, and route exact semantic questions differently from vector similarity.',
    why:
      'A semantic layer gives business terms stable identities and governed relationships; this supports exact, auditable answers that fuzzy vector retrieval alone cannot guarantee.',
    tasks: [
      'Build taxonomy, ontology, knowledge-graph, and semantic-layer distinctions',
      'Represent a FIBO-shaped bond fact with RDF subject-predicate-object triples',
      'Validate required predicates through a deterministic SHACL-like shape',
      'Route governed aggregation and relationship questions to semantics, not vectors',
    ],
    taskInstructions: [
      'Fill ontology with formal relationships and constraints while keeping taxonomy as a simpler parent-child classification; the semantic layer maps business language onto governed definitions.',
      'Use fibo:hasIssuer as the missing predicate so bond-1 has a type, issuer, and coupon expressed as explicit RDF-like triples.',
      'Calculate present predicates for the selected subject and subtract them from REQUIRED; an empty missing list must make the SHACL-like validation pass.',
      'Route exact relationship, aggregation, and regulated questions to "semantic", leaving fuzzy similarity wording to "vector"; neither approach replaces the other.',
    ],
    code: `# AI 48 — Semantic systems with small RDF-like structures
concepts = {
    "taxonomy": "parent-child classification",
    "ontology": ???,
    "knowledge graph": "entities and typed relationships as facts",
    "semantic layer": "business terms mapped to governed definitions",
}

triples = [
    ("bond-1", "rdf:type", "fibo:Bond"),
    ("bond-1", ???, "issuer-7"),
    ("bond-1", "fibo:couponRate", 0.05),
    ("issuer-7", "rdfs:label", "Example Bank"),
]
REQUIRED = {"rdf:type", "fibo:hasIssuer", "fibo:couponRate"}

def validate_shape(subject):
    present = {predicate for source, predicate, _ in triples if source == subject}
    missing = sorted(???)
    return {"valid": not missing, "missing": missing}

def object_for(subject, predicate):
    return [
        target for source, relation, target in triples
        if source == subject and relation == predicate
    ]

def retrieval_mode(question_kind):
    if question_kind in {"relationship", "aggregation", "regulated"}:
        return ???
    return "vector"

print("concepts", concepts)
print("shape", validate_shape("bond-1"))
print("issuer", object_for("bond-1", "fibo:hasIssuer"))
print("modes", retrieval_mode("relationship"), retrieval_mode("similarity"))
print("standards", ["RDF", "OWL", "SHACL", "FIBO"])
`,
    goalCheck: {
      requireSuccess: true,
      requireFreshRun: true,
      mustEditStarter: true,
      noBlanks: true,
      codeIncludes: [
        '"formal relationships and constraints"',
        '"fibo:hasIssuer"',
        'REQUIRED - present',
        '"semantic"',
        '"RDF", "OWL", "SHACL", "FIBO"',
      ],
      printPatterns: [
        'concepts.*taxonomy.*ontology.*knowledge graph.*semantic layer',
        "shape.*'valid': True.*'missing': \\[\\]",
        'issuer.*issuer-7',
        'modes semantic vector',
        'standards.*RDF.*OWL.*SHACL.*FIBO',
      ],
      minNonEmptyPrints: 5,
    },
    hints: [
      'Ontology means "formal relationships and constraints"; the bond issuer predicate is "fibo:hasIssuer".',
      'Shape gaps are REQUIRED - present, and governed relationship questions route to "semantic".',
    ],
    predict: {
      prompt: 'Which representation is best for an exact governed issuer relationship?',
      choices: ['A validated semantic graph', 'Only nearest-vector similarity', 'An unversioned prompt guess'],
      correctIndex: 0,
    },
    compare: {
      note: 'Vector retrieval is useful for fuzzy language; semantic retrieval is useful for exact governed relationships and aggregation.',
      wrong: 'semantic search and vector search are interchangeable',
      fixed: 'route fuzzy similarity to vectors and governed relations to the semantic layer',
    },
    stretch:
      'Stretch: add an OWL-style Bond subclass and a failing SHACL case whose missing coupon predicate is printed explicitly.',
    pipeline: ['business term', 'ontology', 'RDF facts', 'SHACL validation', 'semantic or vector retrieval'],
  },
  {
    id: 'ai-graphrag-memory',
    difficulty: 'ai',
    number: 49,
    topic: 'GraphRAG & durable memory',
    chapter: 'Study Book semantic systems',
    goal:
      'Build and traverse a source-linked GraphRAG subgraph, choose RAG or CAG from freshness and corpus size, and store only consented durable facts in a context graph suitable for a graph database.',
    why:
      'GraphRAG retrieves relationships that isolated chunks can miss, while durable memory needs explicit provenance and consent; CAG is a separate choice for small stable knowledge that fits in context.',
    tasks: [
      'Extract source-linked entity relationships into an adjacency graph',
      'Traverse two hops without cycles and preserve evidence provenance',
      'Choose RAG for changing large knowledge and CAG for small stable context',
      'Write consented durable facts into a context graph and explain Neptune conceptually',
    ],
    taskInstructions: [
      'Append relation, target, and source metadata beneath each subject so GraphRAG evidence remains attributable to the document that created the edge.',
      'Track visited entities, add unseen targets to the next frontier, and replace frontier once per hop; the two-hop query from Fund-A must reach Sector-Tech through Company-X.',
      'Return RAG when knowledge changes or exceeds the context limit, otherwise return CAG. This models retrieval versus preloaded stable context without conflating them.',
      'Store a fact only when both durable and consented are true; keep its source in the context graph and describe Neptune as a managed graph database rather than making a network call.',
    ],
    code: `# AI 49 — GraphRAG, CAG, and durable memory
RELATIONS = [
    {"subject": "Fund-A", "relation": "holds", "target": "Company-X", "source": "d1"},
    {"subject": "Company-X", "relation": "belongs_to", "target": "Sector-Tech", "source": "d2"},
    {"subject": "Fund-A", "relation": "managed_by", "target": "Team-7", "source": "d3"},
]

def build_graph(rows):
    graph = {}
    for row in rows:
        edge = {
            "relation": row["relation"],
            "target": row["target"],
            "source": row["source"],
        }
        graph.setdefault(row["subject"], []).append(???)
    return graph

def expand(graph, start, hops):
    frontier = {start}
    visited = {start}
    evidence = []
    for _ in range(hops):
        next_frontier = set()
        for entity in sorted(frontier):
            for edge in graph.get(entity, []):
                evidence.append({"from": entity, **edge})
                if edge["target"] not in visited:
                    visited.add(edge["target"])
                    next_frontier.add(edge["target"])
        frontier = ???
    return {"entities": sorted(visited), "evidence": evidence}

def choose_context(changing_knowledge, corpus_tokens, context_limit):
    if changing_knowledge or corpus_tokens > context_limit:
        return ???
    return "CAG"

def remember(memory, subject, predicate, value, source, durable, consented):
    if durable and consented:
        memory.setdefault(subject, {})[predicate] = {
            "value": value,
            "source": source,
        }
    return memory

graph = build_graph(RELATIONS)
subgraph = expand(graph, "Fund-A", hops=2)
memory = remember({}, "user-1", "preferred_sector", "technology", "session-4", True, True)
memory = remember(memory, "user-1", "temporary_query", "price now", "session-4", False, True)

print("subgraph entities", subgraph["entities"])
print("evidence sources", sorted({edge["source"] for edge in subgraph["evidence"]}))
print("context choices", choose_context(True, 1000, 5000), choose_context(False, 1000, 5000))
print("memory", memory)
print("Neptune", "managed graph database for durable relationship queries")
`,
    goalCheck: {
      requireSuccess: true,
      requireFreshRun: true,
      mustEditStarter: true,
      noBlanks: true,
      codeIncludes: [
        'append(edge)',
        'frontier = next_frontier',
        'return "RAG"',
        'durable and consented',
        '"source": source',
      ],
      printPatterns: [
        'subgraph entities.*Company-X.*Fund-A.*Sector-Tech.*Team-7',
        'evidence sources.*d1.*d2.*d3',
        'context choices RAG CAG',
        'memory.*preferred_sector.*technology.*session-4',
        'Neptune.*managed graph database',
      ],
      minNonEmptyPrints: 5,
    },
    hints: [
      'Append edge to the subject list, then set frontier = next_frontier after each completed hop.',
      'Changing or oversized knowledge selects "RAG"; memory writes require durable and consented together.',
    ],
    predict: {
      prompt: 'When is CAG a reasonable choice instead of retrieval on every request?',
      choices: ['Knowledge is small, stable, and fits the context', 'The corpus changes every minute', 'Access controls are unknown'],
      correctIndex: 0,
    },
    compare: {
      note: 'GraphRAG retrieves connected evidence, while durable memory stores selected user or workflow facts with provenance and consent.',
      wrong: 'store every conversation token forever as memory',
      fixed: 'persist only consented durable facts with source metadata',
    },
    stretch:
      'Stretch: add reverse edges and tenant metadata, then prove a two-hop query cannot cross into another tenant subgraph.',
    pipeline: ['extract graph', 'link provenance', 'expand subgraph', 'choose RAG/CAG', 'write durable memory'],
  },
]
