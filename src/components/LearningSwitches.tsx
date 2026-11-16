import type { Section } from '../curriculum/sections'
import { SECTIONS } from '../curriculum/sections'

type LearningSwitchesProps = {
  enabled: ReadonlySet<Section>
  onToggle: (section: Section, on: boolean) => void
}

/** One switch per learning section. Changes apply at once; with every switch off the app is a plain editor. */
export function LearningSwitches({ enabled, onToggle }: LearningSwitchesProps) {
  return (
    <section className="settings-section" aria-labelledby="learning-switches-title">
      <h3 className="settings-section-title" id="learning-switches-title">Learning</h3>
      <p className="settings-note learning-switches-note">
        Turn on the sections you want in the track menu. With all of them off, the app is a plain Python editor.
      </p>
      <ul className="learning-switches">
        {SECTIONS.map((section) => {
          const on = enabled.has(section.id)
          return (
            <li key={section.id}>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                className="learning-switch"
                onClick={() => onToggle(section.id, !on)}
              >
                <span className="learning-switch-label">{section.label}</span>
                <span className="learning-switch-track" aria-hidden="true"><span className="learning-switch-thumb" /></span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
