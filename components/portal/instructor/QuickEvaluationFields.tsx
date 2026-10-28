'use client'

import { startTransition, useActionState, useEffect, useId, useRef, useState } from 'react'
import { createInstructorEvaluationBatch } from '@/modules/instructor-portal/actions'
import type { EvaluationCriterion } from '@/modules/student-evaluations/types'
import styles from './QuickEvaluation.module.css'

// A short, subject-neutral rubric; keep existing criterion keys for historical compatibility.
const QUICK_CRITERIA: readonly { criterion: EvaluationCriterion; title: string }[] = [
  { criterion: 'ACADEMIC_SKILLS', title: 'Understanding & application' },
  { criterion: 'PROBLEM_SOLVING', title: 'Problem Solving' },
  { criterion: 'PARTICIPATION', title: 'Participation' },
  { criterion: 'CLASSROOM_BEHAVIOR', title: 'Focus & behavior' },
]

export function StarIcon({ filled = false }: { filled?: boolean }) {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true"><path d="m12 3 2.8 5.7 6.3.9-4.5 4.4 1 6.2-5.6-3-5.6 3 1-6.2L2.9 9.6l6.3-.9L12 3Z" /></svg>
}

export default function QuickEvaluationFields({ studentId, groupId, onSaved, scheduleId, reviewMode = false }: { studentId: string; groupId: string; onSaved?: () => void; scheduleId?: string; reviewMode?: boolean }) {
  const [state, action, pending] = useActionState(createInstructorEvaluationBatch, null)
  const [ratings, setRatings] = useState<Partial<Record<EvaluationCriterion, number>>>({})
  const id = useId()
  const savedCallback = useRef(onSaved)
  useEffect(() => { savedCallback.current = onSaved }, [onSaved])
  useEffect(() => { if (state?.success) savedCallback.current?.() }, [state])
  const selected = QUICK_CRITERIA.map(item => item.criterion).filter(criterion => ratings[criterion] !== undefined)
  const average = selected.length ? selected.reduce((sum, criterion) => sum + ratings[criterion]!, 0) / selected.length : null

  return <form onSubmit={event => {
    event.preventDefault()
    if (pending || !selected.length) return
    const data = new FormData(event.currentTarget)
    // Keep the draft intact on errors; native React form actions reset radio inputs.
    startTransition(() => action(data))
  }} className={styles.form}>
    <input type="hidden" name="student_id" value={studentId} />
    <input type="hidden" name="group_id" value={groupId} />
    {scheduleId && <input type="hidden" name="schedule_id" value={scheduleId} />}
    <input type="hidden" name="ratings" value={JSON.stringify(selected.map(criterion => ({ criterion, rating: ratings[criterion] })))} />
    {state && !state.success && <p role="alert" className={styles.error}>{state.error.message}</p>}
    {state?.success && !onSaved && <p role="status" className={styles.success}>Evaluation saved.</p>}
    <p className={styles.hint}>{reviewMode ? 'Ratings will be submitted to the lead instructor for review before publishing.' : 'Four quick ratings for any class. Unrated items are excluded from the average.'}</p>
    <fieldset disabled={pending} className={styles.criteria}>
      <legend className="sr-only">Evaluation criteria</legend>
      {QUICK_CRITERIA.map(({ criterion, title }) => {
        const rating = ratings[criterion] ?? 0
        return <div key={criterion} className={styles.row}>
          <div className={styles.criterion}>
            <span id={`${id}-${criterion}-label`}>{title}</span>
          </div>
          <div className={styles.ratingControls}>
            <div className={styles.stars} role="radiogroup" aria-labelledby={`${id}-${criterion}-label`}>
              {[1, 2, 3, 4, 5].map(value => <label key={value} className={`${styles.star} ${value <= rating ? styles.filled : ''}`} title={`${value} / 5`}>
                <input type="radio" name={`${id}-rating-${criterion}`} value={value} checked={rating === value} aria-label={`${title}: ${value} ${value === 1 ? 'star' : 'stars'}`} onChange={() => setRatings(previous => ({ ...previous, [criterion]: value }))} />
                <StarIcon filled={value <= rating} />
              </label>)}
            </div>
            <button type="button" className={styles.clear} disabled={!rating} aria-label={`Clear ${title} rating`} title="Clear rating" onClick={() => setRatings(previous => { const next = { ...previous }; delete next[criterion]; return next })}>×</button>
          </div>
        </div>
      })}
    </fieldset>
    <div className={styles.average} aria-live="polite" aria-atomic="true">
      <div><p className={styles.averageTitle}>Overall average</p><p className={styles.averageHint}>{selected.length ? `${selected.length} rated ${selected.length === 1 ? 'criterion' : 'criteria'} · Equal weight` : 'Choose stars to calculate the average'}</p></div>
      <div className={styles.averageValue}><StarIcon filled /><output aria-label="Overall average">{average === null ? '—' : average.toFixed(1)}</output><span>/ 5</span></div>
    </div>
    <label className={styles.feedback}>Feedback <span>(optional)</span><textarea name="feedback" maxLength={5000} rows={2} disabled={pending} placeholder="Encourage the student with a short note…" className="ds-input mt-2 w-full" /></label>
    <div className={styles.footer}>
      <fieldset disabled={pending} className={styles.visibility}><legend className="sr-only">Visible to</legend><label><input type="checkbox" name="visible_to_student" value="true" defaultChecked /> Student</label><label><input type="checkbox" name="visible_to_parent" value="true" defaultChecked /> Parent</label></fieldset>
      <button type="submit" disabled={pending || !selected.length} className={styles.save}>{pending ? 'Saving…' : reviewMode ? 'Submit evaluation for review' : 'Save evaluation'}</button>
    </div>
  </form>
}
