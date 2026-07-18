import { useState } from 'react'
import type { LessonPredict } from '../examples'

type PredictPromptProps = {
  predict: LessonPredict
  onResolved: (correct: boolean) => void
}

/**
 * Quiet “predict then run” moment — one question before first run of a lesson.
 */
export function PredictPrompt({ predict, onResolved }: PredictPromptProps) {
  const [picked, setPicked] = useState<number | null>(null)
  const answered = picked != null
  const correct = answered && picked === predict.correctIndex

  return (
    <div className="predict-prompt" role="region" aria-label="Predict the output">
      <p className="predict-prompt-q">
        <strong className="lesson-goal-kicker">Predict</strong> {predict.prompt}
      </p>
      <div className="predict-choices">
        {predict.choices.map((choice, i) => {
          let cls = 'predict-choice'
          if (answered) {
            if (i === predict.correctIndex) cls += ' is-correct'
            else if (i === picked) cls += ' is-wrong'
          }
          return (
            <button
              key={choice}
              type="button"
              className={cls}
              disabled={answered}
              onClick={() => {
                setPicked(i)
                onResolved(i === predict.correctIndex)
              }}
            >
              {choice}
            </button>
          )
        })}
      </div>
      {answered && (
        <p className="predict-feedback">
          {correct
            ? 'Nice — now run the code and match it on the right.'
            : 'Not quite — run the code and compare with the results.'}
        </p>
      )}
    </div>
  )
}
