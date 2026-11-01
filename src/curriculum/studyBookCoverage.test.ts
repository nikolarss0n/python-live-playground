import { describe, expect, it } from 'vitest'
import { LESSONS } from '../examples'
import {
  STUDY_BOOK_COVERAGE,
  STUDY_BOOK_SOURCE,
} from './studyBookCoverage'
import { STUDY_BOOK_AI_LESSON_DRAFTS } from './studyBookAiLessons'
import { STUDY_BOOK_DEEP_DIVE_AI_LESSON_DRAFTS } from './studyBookDeepDiveAiLessons'
import { STUDY_BOOK_DEEP_DIVE_PRODUCTION_LESSON_DRAFTS } from './studyBookDeepDiveProductionLessons'
import { STUDY_BOOK_DEEP_DIVE_PYTHON_LESSON_DRAFTS } from './studyBookDeepDivePythonLessons'
import { STUDY_BOOK_PRODUCTION_LESSON_DRAFTS } from './studyBookProductionLessons'
import { STUDY_BOOK_PYTHON_LESSON_DRAFTS } from './studyBookPythonLessons'

const EXPECTED_CHAPTER_IDS = [
  'ml-fundamentals',
  'llm-internals',
  'transformers',
  'markov-chains',
  'data-science-stack',
  'feature-engineering',
  'gradient-boosting',
  'deep-learning-frameworks',
  'model-serving',
  'mlops-tooling',
  'pyspark-data',
  'optimization',
  'llmops',
  'rag',
  'data-quality',
  'evals',
  'agents',
  'security',
  'genai-challenges',
  'model-adaptation',
  'api-engineering',
  'data-ingestion',
  'cloud-infra',
  'python-performance',
  'python-concurrency',
  'python-oop',
  'python-idioms',
  'java-core',
  'java-collections',
  'java-concurrency',
  'spring',
  'design-patterns',
  'ways-of-working',
  'capital-markets',
  'mcp',
  'semantic-layer',
  'graphrag',
  'agentic-aws',
  'agentic-security',
  'sa-craft',
  'corrections',
  'drills',
  'capstone',
] as const

const CHAPTER_EVIDENCE_TERMS: Record<
  (typeof EXPECTED_CHAPTER_IDS)[number],
  readonly RegExp[]
> = {
  'ml-fundamentals': [
    /supervised/i,
    /reinforcement/i,
    /backprop|autograd/i,
    /PyTorch/i,
    /overfit/i,
  ],
  'llm-internals': [/autoregressive/i, /top-p/i, /context window/i, /Markov/i],
  transformers: [
    /multi-head/i,
    /LayerNorm|layer norm/i,
    /residual/i,
    /feed-forward|FFN/i,
    /positional/i,
  ],
  'markov-chains': [/memoryless/i, /PageRank/i, /MCMC/i, /Pushkin/i],
  'data-science-stack': [
    /NumPy/i,
    /pandas/i,
    /scikit-learn/i,
    /\bEDA\b/i,
    /vectoriz/i,
  ],
  'feature-engineering': [
    /interaction|ratio/i,
    /time.series|TimeSeriesSplit/i,
    /class weight|SMOTE|resampl/i,
    /PR-AUC|ROC-AUC|F1/i,
  ],
  'gradient-boosting': [
    /XGBoost/i,
    /LightGBM/i,
    /CatBoost/i,
    /bagging/i,
    /SHAP/i,
  ],
  'deep-learning-frameworks': [
    /TensorFlow/i,
    /Keras/i,
    /PyTorch/i,
    /underfit/i,
    /Dropout|BatchNorm/i,
  ],
  'model-serving': [/ONNX/i, /TensorRT/i, /TF Serving/i, /TorchServe/i, /autoscal/i],
  'mlops-tooling': [/MLflow/i, /Kubeflow/i, /Azure ML/i, /SageMaker/i, /retrain/i],
  'pyspark-data': [/shuffle/i, /\bRDD\b/i, /driver/i, /executor/i, /streaming/i],
  optimization: [/quantization/i, /KV cache/i, /distill/i, /self-host/i],
  llmops: [/canary/i, /refusal/i, /golden/i, /drift/i, /trace/i],
  rag: [/chunk/i, /hybrid/i, /rerank/i, /permission/i, /abstain/i],
  'data-quality': [
    /MinHash|Jaccard/i,
    /\bHyDE\b/i,
    /parent.child/i,
    /table.aware|table boundary|table-preserving/i,
    /intent/i,
  ],
  evals: [/golden/i, /synthetic/i, /human.label/i, /pairwise/i, /A\/B|A-B/i],
  agents: [/ReAct/i, /planner/i, /multi-agent/i, /tool result/i, /schema.*repair|repair.*schema/i],
  security: [
    /jailbreak/i,
    /exfiltrat/i,
    /poisoned index|index poisoning|poisoned_sources/i,
    /OWASP/i,
    /chain.of.thought/i,
  ],
  'genai-challenges': [
    /jitter/i,
    /semantic.*cache|cache.*semantic/i,
    /supporting span|supporting passage/i,
    /self-consistency/i,
    /small.*model|smaller model/i,
  ],
  'model-adaptation': [
    /LoRA/i,
    /PEFT/i,
    /\bSFT\b/i,
    /preference (tuning|optimization|learning)/i,
    /from scratch/i,
  ],
  'api-engineering': [
    /function call/i,
    /malformed/i,
    /cache[_ -]hit/i,
    /concurren/i,
    /small.*large|large.*small/i,
  ],
  'data-ingestion': [
    /Kafka/i,
    /Mongo/i,
    /ClickHouse/i,
    /robots/i,
    /soft.404/i,
    /human review/i,
  ],
  'cloud-infra': [
    /guest (OS|kernel)/i,
    /shared.*kernel/i,
    /cold[_ -]start/i,
    /load balancer/i,
    /object[- ]stor|Blob|S3/i,
  ],
  'python-performance': [
    /reference count/i,
    /cyclic GC|cyclic garbage/i,
    /memoryview/i,
    /__slots__/i,
    /weakref/i,
    /cProfile/i,
  ],
  'python-concurrency': [
    /ThreadPoolExecutor/i,
    /ProcessPoolExecutor/i,
    /\bGIL\b/i,
    /\block\b/i,
    /cancell/i,
  ],
  'python-oop': [
    /name mangl/i,
    /propert/i,
    /metaclass/i,
    /__len__/i,
    /fake/i,
    /OrderedDict/i,
  ],
  'python-idioms': [
    /attrgetter/i,
    /set comprehension/i,
    /pytest\.fixture/i,
    /Dijkstra/i,
    /functools\.wraps|wraps\(/i,
    /walrus/i,
  ],
  'java-core': [/JVM/i, /garbage collect/i, /interface/i, /checked exception/i, /immutable/i],
  'java-collections': [/HashMap/i, /collision/i, /generic/i, /Stream/i],
  'java-concurrency': [/synchronized/i, /volatile/i, /Executor/i, /\bwait\b/i, /\bLock\b/i],
  spring: [
    /dependency injection/i,
    /auto-configuration/i,
    /profiles/i,
    /controller/i,
    /repository/i,
  ],
  'design-patterns': [/Observer/i, /Strategy/i, /Factory/i, /Proxy/i, /Builder/i, /Singleton/i],
  'ways-of-working': [/red.*green.*refactor/i, /CI\/CD/i, /incident/i, /palindrome/i],
  'capital-markets': [/order book/i, /walk-forward/i, /purg/i, /embargo/i, /SHAP/i],
  mcp: [/\bhost\b/i, /\bclient\b/i, /\bserver\b/i, /\btools\b/i, /\bresources\b/i, /\bprompts\b/i, /OAuth/i],
  'semantic-layer': [/\bRDF\b/i, /\bOWL\b/i, /\bSHACL\b/i, /\bFIBO\b/i, /vector.*semantic|semantic.*vector/i],
  graphrag: [
    /GraphRAG/i,
    /\bCAG\b/i,
    /Neptune/i,
    /durable memory/i,
    /multi-hop|two-hop/i,
  ],
  'agentic-aws': [/Quick Suite/i, /AgentCore/i, /Runtime/i, /Gateway/i, /Identity/i],
  'agentic-security': [
    /memory poison/i,
    /numeric/i,
    /provenance/i,
    /delegated identity/i,
    /AG-UI|typed UI/i,
  ],
  'sa-craft': [
    /\bC4\b/i,
    /sequence( diagram)?|agent_sequence/i,
    /\bER\b/i,
    /\bADR\b/i,
    /\bNFR\b/i,
    /shadow/i,
  ],
  corrections: [
    /reference counting/i,
    /OrderedDict/i,
    /finalize/i,
    /HashSet/i,
    /dead.link/i,
  ],
  drills: [
    /support RAG|customer.support/i,
    /ingestion/i,
    /hallucination/i,
    /safe (tool )?agent/i,
    /fraud/i,
    /time.series/i,
  ],
  capstone: [/ingest/i, /retrieve/i, /generate/i, /evaluate/i, /harden/i, /citation/i],
}

describe('companion study-book coverage', () => {
  it('tracks the complete ordered 43-chapter working-tree edition', () => {
    expect(STUDY_BOOK_SOURCE.chapterCount).toBe(43)
    expect(STUDY_BOOK_SOURCE.contentBlockCount).toBe(523)
    expect(STUDY_BOOK_SOURCE.includesWorkingTreeAgenticSmeChapters).toBe(true)
    expect(STUDY_BOOK_COVERAGE.map((chapter) => chapter.number)).toEqual(
      Array.from({ length: 43 }, (_, index) => index + 1),
    )
    expect(STUDY_BOOK_COVERAGE.map((chapter) => chapter.id)).toEqual(
      EXPECTED_CHAPTER_IDS,
    )
    expect(new Set(STUDY_BOOK_COVERAGE.map((chapter) => chapter.id)).size).toBe(
      43,
    )
  })

  it('maps every named chapter objective to real playground lessons', () => {
    const lessonIds = new Set(LESSONS.map((lesson) => lesson.id))

    for (const chapter of STUDY_BOOK_COVERAGE) {
      expect(chapter.title.length, chapter.id).toBeGreaterThan(5)
      expect(chapter.group.length, chapter.id).toBeGreaterThan(2)
      expect(chapter.objectives.length, chapter.id).toBeGreaterThanOrEqual(3)

      for (const objective of chapter.objectives) {
        expect(objective.objective.length, `${chapter.id}: objective`).toBeGreaterThan(
          30,
        )
        expect(['direct', 'adapted-simulation']).toContain(objective.mode)
        expect(objective.lessonIds.length, objective.objective).toBeGreaterThan(0)
        for (const lessonId of objective.lessonIds) {
          expect(
            lessonIds.has(lessonId),
            `${chapter.id} maps “${objective.objective}” to missing lesson ${lessonId}`,
          ).toBe(true)
        }
      }
    }
  })

  it('keeps every parity lesson connected to at least one book objective', () => {
    const referencedIds = new Set(
      STUDY_BOOK_COVERAGE.flatMap((chapter) =>
        chapter.objectives.flatMap((objective) => objective.lessonIds),
      ),
    )
    const parityDrafts = [
      ...STUDY_BOOK_PYTHON_LESSON_DRAFTS,
      ...STUDY_BOOK_AI_LESSON_DRAFTS,
      ...STUDY_BOOK_PRODUCTION_LESSON_DRAFTS,
      ...STUDY_BOOK_DEEP_DIVE_PYTHON_LESSON_DRAFTS,
      ...STUDY_BOOK_DEEP_DIVE_AI_LESSON_DRAFTS,
      ...STUDY_BOOK_DEEP_DIVE_PRODUCTION_LESSON_DRAFTS,
    ]

    for (const lesson of parityDrafts) {
      expect(referencedIds.has(lesson.id), lesson.id).toBe(true)
    }
  })

  it('keeps source-specific semantic evidence behind every chapter mapping', () => {
    const lessonsById = new Map(LESSONS.map((lesson) => [lesson.id, lesson]))
    const missingEvidence: string[] = []

    for (const chapter of STUDY_BOOK_COVERAGE) {
      const mappedIds = new Set(
        chapter.objectives.flatMap((objective) => objective.lessonIds),
      )
      const evidence = [...mappedIds]
        .map((lessonId) => lessonsById.get(lessonId))
        .filter((lesson) => lesson !== undefined)
        .map((lesson) => JSON.stringify(lesson))
        .join('\n')

      for (const term of CHAPTER_EVIDENCE_TERMS[chapter.id]) {
        if (!term.test(evidence)) {
          missingEvidence.push(`${chapter.id}: ${term}`)
        }
      }
    }

    expect(missingEvidence).toEqual([])
  })

  it('preserves the authoritative chapter counts in every book group', () => {
    const counts = Object.fromEntries(
      [...new Set(STUDY_BOOK_COVERAGE.map((chapter) => chapter.group))].map(
        (group) => [
          group,
          STUDY_BOOK_COVERAGE.filter((chapter) => chapter.group === group).length,
        ],
      ),
    )

    expect(counts).toEqual({
      Foundations: 4,
      'Classical ML': 4,
      'ML in production': 5,
      'GenAI & LLM': 8,
      'System design': 2,
      'Python engineering': 4,
      'Java & JVM': 4,
      'Engineering practice': 2,
      'Quant & domain': 1,
      'Agentic SME (S&P)': 6,
      'Interview prep': 3,
    })
  })
})
