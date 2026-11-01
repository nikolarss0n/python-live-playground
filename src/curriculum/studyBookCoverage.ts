export type StudyBookCoverageMode = 'direct' | 'adapted-simulation'

export type StudyBookObjectiveCoverage = {
  objective: string
  lessonIds: readonly string[]
  mode: StudyBookCoverageMode
}

export type StudyBookChapterCoverage = {
  number: number
  id: string
  group: string
  title: string
  objectives: readonly StudyBookObjectiveCoverage[]
}

export const STUDY_BOOK_SOURCE = {
  title: 'ML & AI Engineer',
  repository: 'nikolarss0n/study-book',
  sourceFile: 'content.js',
  baseCommit: '9c3323df9976cf562d05f53aa8dd6b0925dfbe58',
  inventoryDate: '2026-07-24',
  chapterCount: 43,
  contentBlockCount: 523,
  includesWorkingTreeAgenticSmeChapters: true,
} as const

/**
 * Auditable parity map for the current working-tree edition of the companion
 * study book. “Adapted simulation” means the learner exercises the underlying
 * decision or protocol locally rather than pretending a browser tab is a JVM,
 * Spark cluster, cloud account, model server, or production deployment.
 */
export const STUDY_BOOK_COVERAGE = [
  {
    number: 1,
    id: 'ml-fundamentals',
    group: 'Foundations',
    title: 'ML & deep-learning fundamentals',
    objectives: [
      {
        objective: 'Softmax, loss, gradients, backpropagation, and neural parameter updates',
        lessonIds: ['ai-softmax', 'ai-cross-entropy-gradient', 'ai-neural-training-loop'],
        mode: 'direct',
      },
      {
        objective: 'Embeddings, similarity, data splits, classifier metrics, and overfitting diagnosis',
        lessonIds: [
          'ai-vocab',
          'ai-dot-product',
          'ai-cosine',
          'ai-data-splits',
          'ai-classifier-metrics',
          'ai-learning-paradigms-lifecycle',
        ],
        mode: 'direct',
      },
      {
        objective: 'Supervised, unsupervised, and reinforcement learning plus the complete ML lifecycle',
        lessonIds: ['ai-problem-framing', 'ai-learning-paradigms-lifecycle'],
        mode: 'direct',
      },
      {
        objective: 'Minimum PyTorch vocabulary and tensor/autograd/training-loop responsibilities',
        lessonIds: ['ai-learning-paradigms-lifecycle', 'ai-frameworks-bias-variance'],
        mode: 'adapted-simulation',
      },
    ],
  },
  {
    number: 2,
    id: 'llm-internals',
    group: 'Foundations',
    title: 'LLM internals',
    objectives: [
      {
        objective: 'Autoregressive next-token generation and probabilistic sampling',
        lessonIds: ['ai-next-token', 'ai-softmax', 'ai-decoding-controls'],
        mode: 'direct',
      },
      {
        objective: 'Temperature, top-k, and top-p decoding controls',
        lessonIds: ['ai-softmax', 'ai-decoding-controls'],
        mode: 'direct',
      },
      {
        objective: 'Context windows and training-parallel versus inference-sequential behavior',
        lessonIds: ['ai-context-budgets', 'ai-transformer-block'],
        mode: 'direct',
      },
      {
        objective: 'Precise statistical-representation language and the distinction from Markov chains',
        lessonIds: ['ai-markov-chains', 'ai-transformer-block'],
        mode: 'direct',
      },
    ],
  },
  {
    number: 3,
    id: 'transformers',
    group: 'Foundations',
    title: 'Transformers',
    objectives: [
      {
        objective: 'Token and position representations, learned Q/K/V projections, and full attention matrices',
        lessonIds: ['ai-dot-product', 'ai-attention', 'ai-transformer-block'],
        mode: 'direct',
      },
      {
        objective: 'Multi-head attention, causal masking, and concatenated head output',
        lessonIds: ['ai-attention', 'ai-transformer-block'],
        mode: 'direct',
      },
      {
        objective: 'Feed-forward layers, residual connections, and layer normalization',
        lessonIds: ['ai-transformer-block'],
        mode: 'direct',
      },
      {
        objective: 'Why attention improves parallelism and long-range information paths over recurrence',
        lessonIds: ['ai-transformer-block'],
        mode: 'direct',
      },
    ],
  },
  {
    number: 4,
    id: 'markov-chains',
    group: 'Foundations',
    title: 'Markov chains — Pushkin to PageRank',
    objectives: [
      {
        objective: 'Memoryless transitions, state distributions, and deterministic transition simulation',
        lessonIds: ['ai-markov-chains'],
        mode: 'direct',
      },
      {
        objective: 'Pushkin and Shannon text experiments plus Monte Carlo, MCMC, and HMM uses',
        lessonIds: ['ai-markov-chains'],
        mode: 'direct',
      },
      {
        objective: 'PageRank random-surfer damping and convergence intuition',
        lessonIds: ['ai-markov-chains'],
        mode: 'direct',
      },
      {
        objective: 'Explicit fixed-state Markov versus long-context Transformer comparison',
        lessonIds: ['ai-markov-chains', 'ai-context-budgets'],
        mode: 'direct',
      },
    ],
  },
  {
    number: 5,
    id: 'data-science-stack',
    group: 'Classical ML',
    title: 'The data-science stack',
    objectives: [
      {
        objective: 'Vectorized array operations and broadcasting compared with Python loops',
        lessonIds: ['ai-data-science-workflow', 'mid-comprehensions'],
        mode: 'adapted-simulation',
      },
      {
        objective: 'NumPy, pandas, and scikit-learn roles and core APIs',
        lessonIds: ['ai-data-science-workflow'],
        mode: 'adapted-simulation',
      },
      {
        objective: 'EDA for distributions, skew, cardinality, correlations, and suspicious fields',
        lessonIds: ['ai-data-science-workflow', 'nested-records'],
        mode: 'direct',
      },
      {
        objective: 'Cleansing, imputation, type repair, encoding, and fold-safe preprocessing',
        lessonIds: [
          'missing-data-none',
          'text-normalization',
          'ai-data-quality-leakage',
          'ai-data-science-workflow',
        ],
        mode: 'direct',
      },
    ],
  },
  {
    number: 6,
    id: 'feature-engineering',
    group: 'Classical ML',
    title: 'Features, validation & metrics',
    objectives: [
      {
        objective: 'Scaling, interactions, ratios, aggregates, dates, lags, and categorical features',
        lessonIds: [
          'ai-feature-scaling',
          'ai-data-science-workflow',
          'ai-feature-engineering-deep-dive',
        ],
        mode: 'direct',
      },
      {
        objective: 'Stratified, grouped, time-series, and fold-safe cross-validation choices',
        lessonIds: [
          'ai-cross-validation',
          'ai-data-science-workflow',
          'ai-feature-engineering-deep-dive',
        ],
        mode: 'direct',
      },
      {
        objective: 'Class weights, resampling trade-offs, thresholds, and imbalanced evaluation',
        lessonIds: [
          'ai-imbalance-f1',
          'ai-threshold-confusion',
          'ai-feature-engineering-deep-dive',
        ],
        mode: 'direct',
      },
      {
        objective: 'Classification and regression metric choice based on failure cost',
        lessonIds: [
          'ai-problem-framing',
          'ai-classifier-metrics',
          'ai-imbalance-f1',
          'ai-feature-engineering-deep-dive',
        ],
        mode: 'direct',
      },
    ],
  },
  {
    number: 7,
    id: 'gradient-boosting',
    group: 'Classical ML',
    title: 'Gradient boosting: XGBoost, LightGBM, CatBoost',
    objectives: [
      {
        objective: 'Residual fitting, weak learners, shrinkage, and falling training loss',
        lessonIds: ['ai-boosting-residuals'],
        mode: 'direct',
      },
      {
        objective: 'Bagging versus boosting and Random Forest comparison',
        lessonIds: ['ai-boosting-decisions'],
        mode: 'direct',
      },
      {
        objective: 'XGBoost, LightGBM, and CatBoost trade-offs and APIs',
        lessonIds: ['ai-boosting-decisions'],
        mode: 'adapted-simulation',
      },
      {
        objective: 'Hyperparameters, regularization, early stopping, and explanation methods',
        lessonIds: ['ai-boosting-decisions'],
        mode: 'direct',
      },
    ],
  },
  {
    number: 8,
    id: 'deep-learning-frameworks',
    group: 'Classical ML',
    title: 'TensorFlow, Keras & PyTorch',
    objectives: [
      {
        objective: 'Bias, variance, underfitting, overfitting, and corrective actions',
        lessonIds: ['ai-frameworks-bias-variance', 'ai-learning-paradigms-lifecycle'],
        mode: 'direct',
      },
      {
        objective: 'TensorFlow/Keras versus PyTorch execution and API trade-offs',
        lessonIds: ['ai-frameworks-bias-variance'],
        mode: 'adapted-simulation',
      },
      {
        objective: 'Layers, embeddings, dropout, normalization, optimizers, schedules, batches, and early stopping',
        lessonIds: ['ai-frameworks-bias-variance', 'ai-neural-training-loop'],
        mode: 'adapted-simulation',
      },
      {
        objective: 'High-level model.fit and explicit nn.Module training-loop responsibilities',
        lessonIds: ['ai-frameworks-bias-variance', 'ai-neural-training-loop'],
        mode: 'adapted-simulation',
      },
    ],
  },
  {
    number: 9,
    id: 'model-serving',
    group: 'ML in production',
    title: 'Model serving: ONNX, TensorRT, TF Serving, TorchServe',
    objectives: [
      {
        objective: 'Train, export, optimize, register, deploy, and monitor lifecycle',
        lessonIds: ['api-serving-architecture', 'api-version-registry'],
        mode: 'adapted-simulation',
      },
      {
        objective: 'ONNX, TensorRT, TF Serving, TorchServe, SavedModel, and TorchScript roles',
        lessonIds: ['api-serving-architecture'],
        mode: 'adapted-simulation',
      },
      {
        objective: 'Online versus batch serving, hardware, replicas, and autoscaling',
        lessonIds: ['api-serving-architecture', 'api-autoscaling-serverless'],
        mode: 'adapted-simulation',
      },
      {
        objective: 'Latency and throughput tuning with batching, caching, and skew monitoring',
        lessonIds: [
          'api-dynamic-batching',
          'api-embedding-cache',
          'api-tracing-observability',
          'api-serving-architecture',
        ],
        mode: 'direct',
      },
    ],
  },
  {
    number: 10,
    id: 'mlops-tooling',
    group: 'ML in production',
    title: 'MLOps: MLflow, Kubeflow, Azure ML, SageMaker',
    objectives: [
      {
        objective: 'Experiment parameters, metrics, code and data versions, environments, and artifacts',
        lessonIds: ['api-mlops-retraining-loop', 'api-version-registry'],
        mode: 'adapted-simulation',
      },
      {
        objective: 'MLflow, Kubeflow, Azure ML, and SageMaker responsibilities',
        lessonIds: ['api-mlops-retraining-loop'],
        mode: 'adapted-simulation',
      },
      {
        objective: 'Training and deployment DAG, registry stages, and CI/CD release gates',
        lessonIds: ['api-mlops-retraining-loop', 'api-evaluation-gate', 'api-version-registry'],
        mode: 'direct',
      },
      {
        objective: 'Scheduled and drift-triggered retraining with quality monitoring',
        lessonIds: ['api-mlops-retraining-loop', 'api-drift-detection'],
        mode: 'direct',
      },
    ],
  },
  {
    number: 11,
    id: 'pyspark-data',
    group: 'ML in production',
    title: 'PySpark & large-scale data',
    objectives: [
      {
        objective: 'Map, shuffle, reduce, lazy transformations, actions, and execution DAGs',
        lessonIds: ['ai-spark-dataflow'],
        mode: 'adapted-simulation',
      },
      {
        objective: 'DataFrame versus RDD, driver versus executors, partitions, and collect hazards',
        lessonIds: ['ai-spark-dataflow'],
        mode: 'adapted-simulation',
      },
      {
        objective: 'Built-in operations, UDF trade-offs, broadcast joins, MLlib, and Parquet',
        lessonIds: ['ai-spark-dataflow'],
        mode: 'adapted-simulation',
      },
      {
        objective: 'Batch versus Structured Streaming and Kafka-style event flow',
        lessonIds: ['ai-spark-dataflow', 'mid-iterator-batching'],
        mode: 'adapted-simulation',
      },
    ],
  },
  {
    number: 12,
    id: 'optimization',
    group: 'ML in production',
    title: 'Model optimization & serving',
    objectives: [
      {
        objective: 'Smaller model selection, quantization, QLoRA, and distillation',
        lessonIds: ['ai-optimization-quantization'],
        mode: 'adapted-simulation',
      },
      {
        objective: 'Prompt, response, embedding, and KV cache behavior and invalidation',
        lessonIds: ['ai-optimization-quantization', 'api-embedding-cache'],
        mode: 'direct',
      },
      {
        objective: 'Embedding quality and dimension trade-offs',
        lessonIds: ['ai-query-rewrite-embeddings', 'ai-cosine'],
        mode: 'direct',
      },
      {
        objective: 'Hosted API versus self-hosting economics, hardware, privacy, and residency',
        lessonIds: ['ai-optimization-quantization', 'api-provider-routing'],
        mode: 'direct',
      },
    ],
  },
  {
    number: 13,
    id: 'llmops',
    group: 'ML in production',
    title: 'LLMOps & observability',
    objectives: [
      {
        objective: 'Versioned prompts, models, retrieval settings, and canary rollout mechanics',
        lessonIds: ['api-version-registry', 'api-llmops-canary'],
        mode: 'direct',
      },
      {
        objective: 'Unified quality, safety, refusal, latency, token, cost, and drift signals',
        lessonIds: [
          'api-tracing-observability',
          'api-token-cost-budgets',
          'api-drift-detection',
          'api-llmops-canary',
        ],
        mode: 'direct',
      },
      {
        objective: 'Full retrieval, tool, and output traces with safe logging and alert routing',
        lessonIds: ['api-safe-logging', 'api-tracing-observability', 'api-llmops-canary'],
        mode: 'direct',
      },
      {
        objective: 'Online feedback flowing into golden evaluation sets and release gates',
        lessonIds: ['api-evaluation-gate', 'api-llmops-canary', 'ai-evals'],
        mode: 'direct',
      },
    ],
  },
  {
    number: 14,
    id: 'rag',
    group: 'GenAI & LLM',
    title: 'Retrieval-Augmented Generation',
    objectives: [
      {
        objective: 'Ingestion, chunking strategies, traceable metadata, freshness, and deletion',
        lessonIds: ['ai-chunking-metadata', 'api-ingestion-store-selection'],
        mode: 'direct',
      },
      {
        objective: 'Dense, sparse, hybrid, reranked, and permission-filtered retrieval',
        lessonIds: ['ai-retrieval', 'ai-hybrid-rrf', 'ai-reranking-permissions'],
        mode: 'direct',
      },
      {
        objective: 'Context packing, calibrated thresholds, citations, and abstention',
        lessonIds: ['ai-context-budgets', 'ai-citations-abstention', 'ai-rag-evaluation'],
        mode: 'direct',
      },
      {
        objective: 'End-to-end retrieval, generation, evaluation, and hardening',
        lessonIds: ['ai-local-rag-capstone', 'api-document-rag-capstone'],
        mode: 'adapted-simulation',
      },
    ],
  },
  {
    number: 15,
    id: 'data-quality',
    group: 'GenAI & LLM',
    title: 'Data quality & embeddings',
    objectives: [
      {
        objective: 'Schema checks, missing values, exact hashes, near-duplicate policy, validation, and quarantine',
        lessonIds: [
          'ai-data-quality-leakage',
          'mid-jsonl-ingestion',
          'ai-query-rewrite-embeddings',
          'ai-data-quality-deep-dive',
        ],
        mode: 'direct',
      },
      {
        objective: 'Normalization plus semantic, parent-child, table-aware, timestamped chunk-quality policies',
        lessonIds: [
          'text-normalization',
          'ai-chunking-metadata',
          'ai-query-rewrite-embeddings',
          'ai-data-quality-deep-dive',
        ],
        mode: 'direct',
      },
      {
        objective: 'Context resolution, typo and abbreviation repair, multi-intent rewriting, and intent preservation',
        lessonIds: ['ai-query-rewrite-embeddings', 'ai-data-quality-deep-dive'],
        mode: 'direct',
      },
      {
        objective: 'Embedding-model quality, cross-encoder reranking, and retrieval regression evidence',
        lessonIds: [
          'ai-query-rewrite-embeddings',
          'ai-rag-evaluation',
          'ai-data-quality-deep-dive',
        ],
        mode: 'direct',
      },
      {
        objective: 'Route identifiers and numbers to exact filters, use HyDE deliberately, and avoid embedding everything',
        lessonIds: ['ai-data-quality-deep-dive', 'ai-retrieval'],
        mode: 'direct',
      },
    ],
  },
  {
    number: 16,
    id: 'evals',
    group: 'GenAI & LLM',
    title: 'Evals & regression testing',
    objectives: [
      {
        objective: 'Define, run, analyze, and iterate on a stable evaluation set',
        lessonIds: ['ai-evals', 'mid-table-driven-tests', 'ai-eval-design-judges'],
        mode: 'direct',
      },
      {
        objective: 'Retrieval, answer, grounding, citation, latency, and cost metrics',
        lessonIds: ['ai-rag-evaluation', 'api-evaluation-gate'],
        mode: 'direct',
      },
      {
        objective: 'Precision, recall, F1, thresholds, and classifier failure costs',
        lessonIds: ['ai-classifier-metrics', 'ai-threshold-confusion', 'ai-imbalance-f1'],
        mode: 'direct',
      },
      {
        objective: 'Deterministic checks, calibrated model judges, pairwise comparison, human review, and CI gates',
        lessonIds: [
          'ai-evals',
          'api-evaluation-gate',
          'api-llmops-canary',
          'ai-eval-design-judges',
        ],
        mode: 'direct',
      },
      {
        objective: 'Golden, synthetic, and human-labeled sets plus thumbs, escalations, corrections, and A/B signals',
        lessonIds: ['ai-eval-design-judges', 'api-llmops-canary'],
        mode: 'direct',
      },
      {
        objective: 'Compare embeddings, chunking, rerankers, filters, agent tools, and safety changes independently',
        lessonIds: ['ai-eval-design-judges', 'ai-rag-evaluation'],
        mode: 'direct',
      },
    ],
  },
  {
    number: 17,
    id: 'agents',
    group: 'GenAI & LLM',
    title: 'Agents, tools & structured output',
    objectives: [
      {
        objective: 'ReAct observe-think-act loops and stop conditions',
        lessonIds: ['ai-agent-react-planning'],
        mode: 'direct',
      },
      {
        objective: 'Deterministic workflows versus agents and planner/executor separation',
        lessonIds: ['ai-agent-react-planning'],
        mode: 'direct',
      },
      {
        objective: 'Single-agent versus multi-agent coordination trade-offs',
        lessonIds: ['ai-agent-react-planning'],
        mode: 'direct',
      },
      {
        objective: 'Structured schemas, tool allow-lists, permissions, approvals, and budgets',
        lessonIds: [
          'ai-json-contract',
          'ai-safe-tools',
          'ai-prompt-injection-bounded-agents',
          'ai-tool-results-repair',
        ],
        mode: 'direct',
      },
      {
        objective: 'Validate tool return payloads and repair bounded structured-output schema mismatches',
        lessonIds: ['ai-tool-results-repair', 'api-schema-validation'],
        mode: 'direct',
      },
      {
        objective: 'Choose function or tool calling versus a schema-constrained response format',
        lessonIds: ['ai-tool-results-repair', 'api-mcp-tool-contracts'],
        mode: 'direct',
      },
    ],
  },
  {
    number: 18,
    id: 'security',
    group: 'GenAI & LLM',
    title: 'LLM security & safety',
    objectives: [
      {
        objective: 'Direct jailbreaks and indirect prompt injection with retrieved content treated as data',
        lessonIds: ['ai-prompt-injection-bounded-agents', 'ai-llm-threat-scenarios'],
        mode: 'direct',
      },
      {
        objective: 'Least privilege, allow-lists, authorization, human approval, and step limits',
        lessonIds: ['ai-safe-tools', 'ai-prompt-injection-bounded-agents', 'api-authn-authorization'],
        mode: 'direct',
      },
      {
        objective: 'Input, retrieval, tool, output, and presentation guardrail layers',
        lessonIds: [
          'api-agentic-defense',
          'api-schema-validation',
          'ai-citations-abstention',
          'ai-llm-threat-scenarios',
        ],
        mode: 'direct',
      },
      {
        objective: 'OWASP-style overreliance, model theft, insecure tools, retention, and prompt-only limits',
        lessonIds: [
          'ai-prompt-injection-bounded-agents',
          'api-agentic-defense',
          'ai-llm-threat-scenarios',
        ],
        mode: 'direct',
      },
      {
        objective: 'Block secret exfiltration and poisoned indexes, isolate tenants, and escalate uncertain answers',
        lessonIds: ['ai-llm-threat-scenarios', 'api-authn-authorization'],
        mode: 'direct',
      },
      {
        objective: 'Expose evidence and citations without requesting or revealing hidden chain-of-thought',
        lessonIds: ['ai-llm-threat-scenarios', 'ai-citations-abstention'],
        mode: 'direct',
      },
    ],
  },
  {
    number: 19,
    id: 'genai-challenges',
    group: 'GenAI & LLM',
    title: 'GenAI production challenges',
    objectives: [
      {
        objective: 'Grounding, hallucination diagnosis, citations, abstention, and layered defenses',
        lessonIds: ['ai-citations-abstention', 'ai-rag-evaluation', 'api-agentic-defense'],
        mode: 'direct',
      },
      {
        objective: 'Timeouts, bounded retries, fallback routing, and provider resilience',
        lessonIds: [
          'api-retries-backoff',
          'api-provider-routing',
          'ai-genai-resilience-relevance',
        ],
        mode: 'direct',
      },
      {
        objective: 'Latency measurement, token budgets, caching, and cost control',
        lessonIds: [
          'api-tracing-observability',
          'api-token-cost-budgets',
          'api-embedding-cache',
          'ai-genai-resilience-relevance',
        ],
        mode: 'direct',
      },
      {
        objective: 'Relevance tuning through retrieval, reranking, evaluation, and feedback',
        lessonIds: [
          'ai-hybrid-rrf',
          'ai-reranking-permissions',
          'api-llmops-canary',
          'ai-genai-resilience-relevance',
        ],
        mode: 'direct',
      },
      {
        objective: 'Use retry jitter, semantic response caching, supporting spans, and self-consistency checks',
        lessonIds: ['ai-genai-resilience-relevance', 'api-retries-backoff'],
        mode: 'direct',
      },
      {
        objective: 'Trim prompts, route easy work to smaller models, and gate relevance with calibrated judges',
        lessonIds: ['ai-genai-resilience-relevance', 'api-provider-routing'],
        mode: 'direct',
      },
    ],
  },
  {
    number: 20,
    id: 'model-adaptation',
    group: 'GenAI & LLM',
    title: 'Prompt vs RAG vs fine-tune',
    objectives: [
      {
        objective: 'Choose prompting for instruction and low-data behavior changes',
        lessonIds: ['ai-prompt-template', 'ai-adaptation-choice'],
        mode: 'direct',
      },
      {
        objective: 'Choose RAG for private, changing, and citable knowledge',
        lessonIds: ['ai-adaptation-choice', 'ai-local-rag-capstone'],
        mode: 'direct',
      },
      {
        objective: 'Choose fine-tuning for stable repeated behavior with sufficient examples',
        lessonIds: ['ai-adaptation-choice', 'ai-finetuning-techniques'],
        mode: 'direct',
      },
      {
        objective: 'Recognize embedding tuning, LoRA, PEFT, QLoRA, SFT, and preference tuning',
        lessonIds: [
          'ai-adaptation-choice',
          'ai-optimization-quantization',
          'ai-finetuning-techniques',
        ],
        mode: 'adapted-simulation',
      },
      {
        objective: 'Explain when training from scratch is justified and why it is usually the wrong first move',
        lessonIds: ['ai-finetuning-techniques', 'ai-adaptation-choice'],
        mode: 'direct',
      },
      {
        objective: 'Compose a fine-tuned behavior model inside a governed, citable RAG pipeline',
        lessonIds: ['ai-finetuning-techniques', 'ai-local-rag-capstone'],
        mode: 'adapted-simulation',
      },
    ],
  },
  {
    number: 21,
    id: 'api-engineering',
    group: 'GenAI & LLM',
    title: 'Production LLM API engineering',
    objectives: [
      {
        objective: 'Typed token streaming and stable structured-output contracts',
        lessonIds: [
          'api-typed-streaming',
          'ai-json-contract',
          'api-schema-validation',
          'api-function-calling-capacity',
        ],
        mode: 'direct',
      },
      {
        objective: 'Timeouts, retries, backoff, idempotency, and fallback chains',
        lessonIds: [
          'api-retries-backoff',
          'api-idempotency',
          'api-provider-routing',
          'api-function-calling-capacity',
        ],
        mode: 'direct',
      },
      {
        objective: 'Safe logging, traceable errors, authentication, and authorization',
        lessonIds: ['api-safe-logging', 'api-error-contracts', 'api-authn-authorization'],
        mode: 'direct',
      },
      {
        objective: 'Latency, token, cost, quota, and per-tenant controls',
        lessonIds: [
          'api-tracing-observability',
          'api-token-cost-budgets',
          'api-tenant-rate-limits',
          'api-function-calling-capacity',
        ],
        mode: 'direct',
      },
      {
        objective: 'Repair malformed function calls before execution and validate returned tool contracts',
        lessonIds: ['api-function-calling-capacity', 'ai-tool-results-repair'],
        mode: 'direct',
      },
      {
        objective: 'Estimate tokens times price times volume with cache, concurrency, streaming, and batch effects',
        lessonIds: ['api-function-calling-capacity', 'api-token-cost-budgets'],
        mode: 'direct',
      },
      {
        objective: 'Compare small and large models across quality, latency, throughput, and unit cost',
        lessonIds: ['api-function-calling-capacity', 'api-provider-routing'],
        mode: 'direct',
      },
    ],
  },
  {
    number: 22,
    id: 'data-ingestion',
    group: 'System design',
    title: 'Data ingestion & processing',
    objectives: [
      {
        objective: 'Extract, validate, transform, quarantine, load, and reconcile an ETL flow',
        lessonIds: ['mid-jsonl-ingestion', 'mid-data-pipeline-capstone', 'api-ingestion-store-selection'],
        mode: 'direct',
      },
      {
        objective: 'Select relational, document, object, search, vector, or event stores by data shape',
        lessonIds: ['api-ingestion-store-selection', 'api-ingestion-crawler-policy'],
        mode: 'adapted-simulation',
      },
      {
        objective: 'Inventory, classify, redirect or repair, verify, and monitor dead links',
        lessonIds: [
          'api-ingestion-store-selection',
          'mid-corrections-gotchas',
          'api-ingestion-crawler-policy',
        ],
        mode: 'direct',
      },
      {
        objective: 'Handle deletes, retries, poison records, and dead-letter queues',
        lessonIds: [
          'api-ingestion-store-selection',
          'api-retries-backoff',
          'api-ingestion-crawler-policy',
        ],
        mode: 'direct',
      },
      {
        objective: 'Choose real-time versus batch ingestion from user-facing freshness requirements',
        lessonIds: ['api-ingestion-crawler-policy', 'api-autoscaling-serverless'],
        mode: 'direct',
      },
      {
        objective: 'Apply crawler robots, rate, auth, HTML parsing, HEAD/GET, redirect, and soft-404 policy',
        lessonIds: ['api-ingestion-crawler-policy'],
        mode: 'adapted-simulation',
      },
      {
        objective: 'Require human review for contextual LLM rewrites before publishing repaired content',
        lessonIds: ['api-ingestion-crawler-policy', 'ai-safe-tools'],
        mode: 'direct',
      },
    ],
  },
  {
    number: 23,
    id: 'cloud-infra',
    group: 'System design',
    title: 'Cloud, containers & serverless',
    objectives: [
      {
        objective: 'Vertical, horizontal, and metric-driven autoscaling decisions',
        lessonIds: [
          'api-autoscaling-serverless',
          'api-serving-architecture',
          'api-container-serverless-mechanics',
        ],
        mode: 'adapted-simulation',
      },
      {
        objective: 'Container replica, queue, load-balancer, and backpressure behavior',
        lessonIds: [
          'api-autoscaling-serverless',
          'api-dynamic-batching',
          'api-container-serverless-mechanics',
        ],
        mode: 'adapted-simulation',
      },
      {
        objective: 'Lambda and Azure Functions serverless strengths and cold-start limits',
        lessonIds: ['api-autoscaling-serverless', 'api-container-serverless-mechanics'],
        mode: 'adapted-simulation',
      },
      {
        objective: 'Choose serverless, containers, or batch jobs from workload duration and state',
        lessonIds: ['api-autoscaling-serverless', 'api-container-serverless-mechanics'],
        mode: 'direct',
      },
      {
        objective: 'Compare VM guest OS isolation with container shared-kernel density and boot time',
        lessonIds: ['api-container-serverless-mechanics'],
        mode: 'adapted-simulation',
      },
      {
        objective: 'Externalize replica state, process object-store events, and avoid function-spaghetti designs',
        lessonIds: ['api-container-serverless-mechanics'],
        mode: 'direct',
      },
    ],
  },
  {
    number: 24,
    id: 'python-performance',
    group: 'Python engineering',
    title: 'Python performance & memory',
    objectives: [
      {
        objective: 'Generator versus list memory and one-pass streaming',
        lessonIds: ['mid-generators', 'mid-iterator-batching', 'mid-performance-profiling'],
        mode: 'direct',
      },
      {
        objective: '__slots__, memoryview, weak references, arrays, copies, and cache ownership',
        lessonIds: [
          'mid-performance-profiling',
          'mid-safe-copying',
          'mid-memory-tools-deep-dive',
        ],
        mode: 'direct',
      },
      {
        objective: 'C3 method resolution order and the diamond problem',
        lessonIds: ['mid-oop-mro-data-model'],
        mode: 'direct',
      },
      {
        objective: 'Profile before optimizing and locate the measured hotspot',
        lessonIds: ['mid-performance-profiling', 'mid-memory-tools-deep-dive'],
        mode: 'direct',
      },
      {
        objective: 'Distinguish CPython reference counting from cyclic GC and use gc.collect diagnostically',
        lessonIds: ['mid-memory-tools-deep-dive', 'mid-corrections-gotchas'],
        mode: 'direct',
      },
      {
        objective: 'Use dis, cProfile, timeit, and memory_profiler for the evidence each tool can provide',
        lessonIds: ['mid-memory-tools-deep-dive'],
        mode: 'direct',
      },
    ],
  },
  {
    number: 25,
    id: 'python-concurrency',
    group: 'Python engineering',
    title: 'Python concurrency & the GIL',
    objectives: [
      {
        objective: 'GIL implications for CPU-bound Python bytecode',
        lessonIds: ['mid-concurrency-gil', 'mid-concurrency-safety-deep-dive'],
        mode: 'direct',
      },
      {
        objective: 'Choose threads, processes, or asyncio by workload shape',
        lessonIds: [
          'mid-concurrency-gil',
          'mid-async-timeouts-retries',
          'mid-concurrency-safety-deep-dive',
        ],
        mode: 'direct',
      },
      {
        objective: 'Race conditions, atomicity, locks, and lost updates',
        lessonIds: ['mid-concurrency-gil', 'mid-concurrency-safety-deep-dive'],
        mode: 'direct',
      },
      {
        objective: 'Async timeouts, bounded retries, cancellation awareness, and blocking pitfalls',
        lessonIds: [
          'mid-async-timeouts-retries',
          'mid-concurrency-gil',
          'mid-concurrency-safety-deep-dive',
        ],
        mode: 'direct',
      },
      {
        objective: 'Retain or gather task failures, clean up on cancellation, and prefer message passing',
        lessonIds: ['mid-concurrency-safety-deep-dive'],
        mode: 'direct',
      },
    ],
  },
  {
    number: 26,
    id: 'python-oop',
    group: 'Python engineering',
    title: 'Python OOP & metaprogramming',
    objectives: [
      {
        objective: 'C3 method resolution and cooperative multiple inheritance',
        lessonIds: ['mid-oop-mro-data-model'],
        mode: 'direct',
      },
      {
        objective: 'Encapsulation conventions, properties, composition, and polymorphism',
        lessonIds: ['mid-classes', 'mid-oop-mro-data-model', 'mid-oop-protocols-deep-dive'],
        mode: 'direct',
      },
      {
        objective: 'Abstract base classes, dataclasses, decorators, and metaclass recognition',
        lessonIds: [
          'mid-dataclasses',
          'mid-decorators-cache',
          'mid-oop-mro-data-model',
          'mid-oop-protocols-deep-dive',
        ],
        mode: 'direct',
      },
      {
        objective: 'Dunder methods and Python data-model protocols',
        lessonIds: [
          'mid-context-managers',
          'mid-oop-mro-data-model',
          'mid-oop-protocols-deep-dive',
        ],
        mode: 'direct',
      },
      {
        objective: 'Use constructor injection with a replaceable fake collaborator',
        lessonIds: ['mid-oop-protocols-deep-dive', 'mid-spring-service-bridge'],
        mode: 'direct',
      },
      {
        objective: 'Compare dict insertion order with OrderedDict move-to-end behavior',
        lessonIds: ['mid-oop-protocols-deep-dive', 'mid-corrections-gotchas'],
        mode: 'direct',
      },
    ],
  },
  {
    number: 27,
    id: 'python-idioms',
    group: 'Python engineering',
    title: 'Idiomatic & functional Python',
    objectives: [
      {
        objective: 'Comprehensions, generator expressions, enumerate, zip, and unpacking',
        lessonIds: ['mid-enumerate-zip', 'mid-comprehensions', 'mid-generators'],
        mode: 'direct',
      },
      {
        objective: 'defaultdict, Counter, heapq, sets, tuples, and sorting',
        lessonIds: ['mid-counter-defaultdict', 'mid-heapq', 'mid-sets', 'mid-tuples', 'mid-sorting'],
        mode: 'direct',
      },
      {
        objective: 'map, filter, reduce, wraps, itemgetter, attrgetter, decorator factories, and caching',
        lessonIds: [
          'mid-fn-defaults',
          'mid-decorators-cache',
          'mid-advanced-functional-idioms',
        ],
        mode: 'direct',
      },
      {
        objective: 'Walrus expressions, pytest yield fixtures, teardown, assertions, and behavior-named tests',
        lessonIds: [
          'mid-advanced-functional-idioms',
          'assertions-as-tests',
          'mid-table-driven-tests',
        ],
        mode: 'direct',
      },
    ],
  },
  {
    number: 28,
    id: 'java-core',
    group: 'Java & JVM',
    title: 'Core Java & OOP',
    objectives: [
      {
        objective: 'JVM garbage collection and Java object lifecycle',
        lessonIds: ['mid-java-core-bridge', 'mid-corrections-gotchas'],
        mode: 'adapted-simulation',
      },
      {
        objective: 'Encapsulation, abstraction, inheritance, and polymorphism in Java',
        lessonIds: ['mid-java-core-bridge', 'mid-classes'],
        mode: 'adapted-simulation',
      },
      {
        objective: 'Classes, interfaces, abstract classes, and key modifiers',
        lessonIds: ['mid-java-core-bridge'],
        mode: 'adapted-simulation',
      },
      {
        objective: 'Checked and unchecked exceptions, immutable strings, equality, and hashing',
        lessonIds: ['mid-java-core-bridge', 'mid-java-collections-bridge'],
        mode: 'adapted-simulation',
      },
    ],
  },
  {
    number: 29,
    id: 'java-collections',
    group: 'Java & JVM',
    title: 'Java collections & generics',
    objectives: [
      {
        objective: 'List, Set, Map, Queue, and implementation trade-offs',
        lessonIds: ['mid-java-collections-bridge', 'lists', 'mid-sets'],
        mode: 'adapted-simulation',
      },
      {
        objective: 'HashMap buckets, hashes, collisions, equality, and average complexity',
        lessonIds: ['mid-java-collections-bridge', 'mid-corrections-gotchas'],
        mode: 'adapted-simulation',
      },
      {
        objective: 'Comparable, Comparator, sorting, generics, and Optional',
        lessonIds: ['mid-java-collections-bridge', 'mid-sorting', 'missing-data-none'],
        mode: 'adapted-simulation',
      },
      {
        objective: 'Java Stream map, filter, sort, collect, and lazy-pipeline ideas',
        lessonIds: ['mid-java-collections-bridge', 'mid-generators'],
        mode: 'adapted-simulation',
      },
    ],
  },
  {
    number: 30,
    id: 'java-concurrency',
    group: 'Java & JVM',
    title: 'Java concurrency',
    objectives: [
      {
        objective: 'Thread, Runnable, Callable, and Future responsibilities',
        lessonIds: ['mid-java-concurrency-bridge'],
        mode: 'adapted-simulation',
      },
      {
        objective: 'synchronized, Lock, wait, sleep, volatile, visibility, and atomicity',
        lessonIds: ['mid-java-concurrency-bridge'],
        mode: 'adapted-simulation',
      },
      {
        objective: 'ExecutorService, bounded pools, queues, and rejection',
        lessonIds: ['mid-java-concurrency-bridge', 'api-dynamic-batching'],
        mode: 'adapted-simulation',
      },
      {
        objective: 'Deadlock awareness, concurrent collections, and safe Singleton publication',
        lessonIds: ['mid-java-concurrency-bridge', 'mid-design-patterns'],
        mode: 'adapted-simulation',
      },
    ],
  },
  {
    number: 31,
    id: 'spring',
    group: 'Java & JVM',
    title: 'Spring & Spring Boot',
    objectives: [
      {
        objective: 'HTTP filter, controller, service, repository, and response lifecycle',
        lessonIds: ['mid-spring-service-bridge', 'api-mini-app', 'api-middleware'],
        mode: 'adapted-simulation',
      },
      {
        objective: 'Inversion of control and constructor versus setter injection',
        lessonIds: ['mid-spring-service-bridge'],
        mode: 'adapted-simulation',
      },
      {
        objective: 'Boot starters, auto-configuration, and profiles',
        lessonIds: ['mid-spring-service-bridge'],
        mode: 'adapted-simulation',
      },
      {
        objective: 'Unit slices, fake repositories, and integration-test conventions',
        lessonIds: ['mid-spring-service-bridge', 'mid-table-driven-tests'],
        mode: 'adapted-simulation',
      },
    ],
  },
  {
    number: 32,
    id: 'design-patterns',
    group: 'Engineering practice',
    title: 'Design patterns',
    objectives: [
      {
        objective: 'Observer registration, notification, and event fan-out',
        lessonIds: ['mid-design-patterns'],
        mode: 'direct',
      },
      {
        objective: 'Strategy and Factory for variable policy and construction',
        lessonIds: ['mid-design-patterns', 'api-provider-routing'],
        mode: 'direct',
      },
      {
        objective: 'Builder, Proxy, and Singleton recognition and trade-offs',
        lessonIds: ['mid-design-patterns', 'mid-decorators-cache'],
        mode: 'direct',
      },
      {
        objective: 'Choose patterns from a concrete pressure and avoid needless indirection',
        lessonIds: ['mid-design-patterns'],
        mode: 'direct',
      },
    ],
  },
  {
    number: 33,
    id: 'ways-of-working',
    group: 'Engineering practice',
    title: 'Agile, TDD & interview craft',
    objectives: [
      {
        objective: 'Red, green, refactor with a palindrome worked example',
        lessonIds: ['mid-tdd-delivery', 'mid-table-driven-tests'],
        mode: 'direct',
      },
      {
        objective: 'CI/CD stages, canary deployment, monitoring, and rollback',
        lessonIds: ['mid-tdd-delivery', 'api-evaluation-gate', 'api-version-registry'],
        mode: 'direct',
      },
      {
        objective: 'Critical incident mitigation, evidence, communication, repair, and review',
        lessonIds: ['mid-tdd-delivery', 'api-tracing-observability'],
        mode: 'direct',
      },
      {
        objective: 'Narrate assumptions, trade-offs, tests, and evidence during an interview',
        lessonIds: ['mid-tdd-delivery', 'api-whiteboard-drills'],
        mode: 'direct',
      },
    ],
  },
  {
    number: 34,
    id: 'capital-markets',
    group: 'Quant & domain',
    title: 'ML in capital markets',
    objectives: [
      {
        objective: 'Order-book bids, asks, spread, depth, and imbalance features',
        lessonIds: ['ai-capital-markets-timeseries'],
        mode: 'direct',
      },
      {
        objective: 'Look-ahead, survivorship, temporal-overlap, and point-in-time leakage',
        lessonIds: ['ai-capital-markets-timeseries', 'ai-data-quality-leakage'],
        mode: 'direct',
      },
      {
        objective: 'Walk-forward, purged k-fold, and embargo validation',
        lessonIds: ['ai-capital-markets-timeseries', 'ai-cross-validation'],
        mode: 'direct',
      },
      {
        objective: 'Fraud, risk, forecasting, regulation, reason codes, and explainability',
        lessonIds: ['ai-capital-markets-timeseries', 'ai-boosting-decisions'],
        mode: 'direct',
      },
    ],
  },
  {
    number: 35,
    id: 'mcp',
    group: 'Agentic SME (S&P)',
    title: 'MCP & agent integration',
    objectives: [
      {
        objective: 'Host, client, server, discovery, invocation, and response flow',
        lessonIds: ['api-mcp-tool-contracts'],
        mode: 'adapted-simulation',
      },
      {
        objective: 'Tools, resources, prompts, sampling, elicitation, and roots control boundaries',
        lessonIds: ['api-mcp-tool-contracts'],
        mode: 'adapted-simulation',
      },
      {
        objective: 'Local and remote transports, OAuth-style delegated identity, and token boundaries',
        lessonIds: ['api-mcp-tool-contracts', 'api-authn-authorization'],
        mode: 'adapted-simulation',
      },
      {
        objective: 'Schema-first tools, least privilege, audit, poisoning defense, and safe errors',
        lessonIds: ['api-mcp-tool-contracts', 'ai-safe-tools', 'ai-prompt-injection-bounded-agents'],
        mode: 'adapted-simulation',
      },
    ],
  },
  {
    number: 36,
    id: 'semantic-layer',
    group: 'Agentic SME (S&P)',
    title: 'Semantic layer & ontologies',
    objectives: [
      {
        objective: 'Taxonomy, ontology, knowledge graph, and semantic-layer distinctions',
        lessonIds: ['ai-semantic-layer'],
        mode: 'direct',
      },
      {
        objective: 'RDF, RDFS, OWL, SPARQL, SHACL, FIBO, and Turtle roles',
        lessonIds: ['ai-semantic-layer'],
        mode: 'adapted-simulation',
      },
      {
        objective: 'Entity linking, constraints, rules, reasoners, and deterministic numeric checks',
        lessonIds: ['ai-semantic-layer', 'api-agentic-defense'],
        mode: 'direct',
      },
      {
        objective: 'Vector-first, semantic-first, and hybrid retrieval decisions',
        lessonIds: ['ai-semantic-layer', 'ai-hybrid-rrf'],
        mode: 'direct',
      },
    ],
  },
  {
    number: 37,
    id: 'graphrag',
    group: 'Agentic SME (S&P)',
    title: 'GraphRAG, memory & CAG',
    objectives: [
      {
        objective: 'Entity and relation extraction, graph construction, clustering, and summaries',
        lessonIds: ['ai-graphrag-memory'],
        mode: 'adapted-simulation',
      },
      {
        objective: 'Multi-hop graph retrieval combined with vector and keyword retrieval',
        lessonIds: ['ai-graphrag-memory', 'ai-hybrid-rrf'],
        mode: 'direct',
      },
      {
        objective: 'Neptune and Bedrock GraphRAG component responsibilities',
        lessonIds: ['ai-graphrag-memory', 'api-agentic-aws-stack'],
        mode: 'adapted-simulation',
      },
      {
        objective: 'RAG versus CAG, KV reuse, session memory, episodic memory, and context graphs',
        lessonIds: ['ai-graphrag-memory', 'ai-optimization-quantization'],
        mode: 'direct',
      },
    ],
  },
  {
    number: 38,
    id: 'agentic-aws',
    group: 'Agentic SME (S&P)',
    title: 'The AWS agentic stack',
    objectives: [
      {
        objective: 'Quick Suite agent and MCP integration flow',
        lessonIds: ['api-agentic-aws-stack', 'api-mcp-tool-contracts'],
        mode: 'adapted-simulation',
      },
      {
        objective: 'AgentCore Runtime, Gateway, Memory, Identity, Browser, and Interpreter roles',
        lessonIds: ['api-agentic-aws-stack'],
        mode: 'adapted-simulation',
      },
      {
        objective: 'Observability, Policy, Evaluations, and governed LLM gateway controls',
        lessonIds: ['api-agentic-aws-stack', 'api-llmops-canary'],
        mode: 'adapted-simulation',
      },
      {
        objective: 'Quotas, throttling, invocation profiles, queues, monitoring, and alerting',
        lessonIds: ['api-agentic-aws-stack', 'api-tenant-rate-limits', 'api-tracing-observability'],
        mode: 'adapted-simulation',
      },
    ],
  },
  {
    number: 39,
    id: 'agentic-security',
    group: 'Agentic SME (S&P)',
    title: 'Securing agentic systems',
    objectives: [
      {
        objective: 'Prompt injection, tool abuse, memory poisoning, confused deputy, and rogue-agent threats',
        lessonIds: ['api-agentic-defense', 'ai-prompt-injection-bounded-agents'],
        mode: 'direct',
      },
      {
        objective: 'Five-layer defense across identity, input, planning, execution, and output',
        lessonIds: ['api-agentic-defense', 'ai-safe-tools'],
        mode: 'direct',
      },
      {
        objective: 'Structured JSON, typed UI events, templated rendering, and numeric verification',
        lessonIds: ['api-agentic-defense', 'ai-json-contract', 'api-typed-streaming'],
        mode: 'direct',
      },
      {
        objective: 'Delegated identity, policy interception, provenance, audit, and page-versus-ticket alerts',
        lessonIds: ['api-agentic-defense', 'api-authn-authorization', 'api-safe-logging'],
        mode: 'direct',
      },
    ],
  },
  {
    number: 40,
    id: 'sa-craft',
    group: 'Agentic SME (S&P)',
    title: 'The SME playbook & interview map',
    objectives: [
      {
        objective: 'Stakeholder discovery, constraints, design, review, delivery, and learning loop',
        lessonIds: ['api-solution-architecture-craft'],
        mode: 'direct',
      },
      {
        objective: 'C4 context and container, sequence, and ER design artifacts',
        lessonIds: ['api-solution-architecture-craft'],
        mode: 'adapted-simulation',
      },
      {
        objective: 'API and MCP contracts, NFR tables, and architecture decision records',
        lessonIds: ['api-solution-architecture-craft', 'api-mcp-tool-contracts'],
        mode: 'direct',
      },
      {
        objective: 'Rules-versus-agent decision, shadow-mode rollout, approval feedback, and interview map',
        lessonIds: ['api-solution-architecture-craft', 'api-whiteboard-drills'],
        mode: 'direct',
      },
    ],
  },
  {
    number: 41,
    id: 'corrections',
    group: 'Interview prep',
    title: 'Corrections & gotchas',
    objectives: [
      {
        objective: 'CPython reference counting, cyclic GC, and deterministic resource cleanup',
        lessonIds: ['mid-corrections-gotchas', 'mid-context-managers'],
        mode: 'direct',
      },
      {
        objective: 'Modern dict order, OrderedDict special behavior, and HashSet complexity caveats',
        lessonIds: ['mid-corrections-gotchas', 'mid-java-collections-bridge'],
        mode: 'direct',
      },
      {
        objective: 'Java finalization correction and explicit resource management',
        lessonIds: ['mid-corrections-gotchas', 'mid-java-core-bridge'],
        mode: 'adapted-simulation',
      },
      {
        objective: 'Dead-link workflow, precise LLM wording, and study-priority discipline',
        lessonIds: ['mid-corrections-gotchas', 'api-ingestion-store-selection'],
        mode: 'direct',
      },
    ],
  },
  {
    number: 42,
    id: 'drills',
    group: 'Interview prep',
    title: 'Whiteboard drills',
    objectives: [
      {
        objective: 'Support RAG, document ingestion, and hallucination-debugging designs',
        lessonIds: ['api-whiteboard-drills', 'ai-local-rag-capstone', 'api-ingestion-store-selection'],
        mode: 'adapted-simulation',
      },
      {
        objective: 'Safe agent and cost-and-latency estimation designs',
        lessonIds: ['api-whiteboard-drills', 'api-agentic-defense', 'api-token-cost-budgets'],
        mode: 'adapted-simulation',
      },
      {
        objective: 'RAG versus tuning and evaluation-feature designs',
        lessonIds: ['api-whiteboard-drills', 'ai-adaptation-choice', 'api-evaluation-gate'],
        mode: 'adapted-simulation',
      },
      {
        objective: 'Fraud ML, model productionization, and time-series validation designs',
        lessonIds: ['api-whiteboard-drills', 'ai-capital-markets-timeseries', 'api-mlops-retraining-loop'],
        mode: 'adapted-simulation',
      },
    ],
  },
  {
    number: 43,
    id: 'capstone',
    group: 'Interview prep',
    title: 'Capstone project',
    objectives: [
      {
        objective: 'Upload and parse records, quarantine failures, chunk, and index with traceable metadata',
        lessonIds: ['api-document-rag-capstone', 'mid-data-pipeline-capstone', 'ai-chunking-metadata'],
        mode: 'adapted-simulation',
      },
      {
        objective: 'Hybrid retrieve, permission filter, rerank, generate, cite, and abstain',
        lessonIds: ['api-document-rag-capstone', 'ai-local-rag-capstone'],
        mode: 'adapted-simulation',
      },
      {
        objective: 'Evaluate retrieval, answers, citations, safety, latency, and cost',
        lessonIds: ['api-document-rag-capstone', 'ai-rag-evaluation', 'api-evaluation-gate'],
        mode: 'direct',
      },
      {
        objective: 'Harden identity, injection boundaries, logging, tracing, versions, and release policy',
        lessonIds: ['api-document-rag-capstone', 'api-production-capstone', 'api-agentic-defense'],
        mode: 'adapted-simulation',
      },
    ],
  },
] as const satisfies readonly StudyBookChapterCoverage[]
