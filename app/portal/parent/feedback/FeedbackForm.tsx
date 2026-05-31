'use client'

import { useState, useTransition } from 'react'
import { useRouter }               from 'next/navigation'
import { submitParentFeedback }    from '@/modules/parent-feedback/actions'

interface Props {
  studentId:        string
  studentName:      string
  sessionMilestone: number
  childParam:       string
}

const QUESTIONS = [
  {
    key:     'q1',
    en:      'Have you noticed improvement in your child\'s skills during the last 6 sessions?',
    ar:      'هل لاحظت تطورًا في مهارات ابنك خلال آخر 6 حصص؟',
  },
  {
    key:     'q2',
    en:      'Is your child excited to attend classes?',
    ar:      'هل ابنك متحمس لحضور الحصص؟',
  },
  {
    key:     'q3',
    en:      'Are you satisfied with the communication and follow-up?',
    ar:      'هل أنت راضٍ عن مستوى التواصل والمتابعة؟',
  },
  {
    key:     'q4',
    en:      'Would you recommend Robocode School to other parents?',
    ar:      'هل ترشح Robocode School لأولياء أمور آخرين؟',
  },
] as const

type QKey = 'q1' | 'q2' | 'q3' | 'q4'

export default function FeedbackForm({ studentId, studentName, sessionMilestone, childParam }: Props) {
  const router        = useRouter()
  const [pending, startTransition] = useTransition()

  const [answers, setAnswers]   = useState<Record<QKey, boolean | null>>({ q1: null, q2: null, q3: null, q4: null })
  const [rating,  setRating]    = useState<number>(0)
  const [notes,   setNotes]     = useState('')
  const [error,   setError]     = useState<string | null>(null)
  const [done,    setDone]      = useState(false)

  const allAnswered = Object.values(answers).every(v => v !== null)
  const canSubmit   = allAnswered && rating >= 1 && !pending

  function handleAnswer(q: QKey, yes: boolean) {
    setAnswers(prev => ({ ...prev, [q]: yes }))
  }

  function handleSubmit() {
    if (!canSubmit) return
    setError(null)

    startTransition(async () => {
      const result = await submitParentFeedback({
        student_id:        studentId,
        session_milestone: sessionMilestone,
        q1_yes:            answers.q1!,
        q2_yes:            answers.q2!,
        q3_yes:            answers.q3!,
        q4_yes:            answers.q4!,
        rating,
        notes: notes.trim() || undefined,
      })

      if (result.success) {
        setDone(true)
        setTimeout(() => router.push(`/portal/parent${childParam}`), 1800)
      } else {
        setError(result.error ?? 'Submission failed.')
      }
    })
  }

  if (done) {
    return (
      <div className="flex min-h-60 flex-col items-center justify-center gap-3 rounded-xl border border-green-200 bg-green-50 px-6 py-10 text-center">
        <span className="text-3xl">✓</span>
        <p className="text-lg font-semibold text-green-700">Thank you for your feedback!</p>
        <p className="text-sm text-green-600">Redirecting to dashboard…</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Yes/No questions */}
      {QUESTIONS.map(({ key, en, ar }) => {
        const ans = answers[key as QKey]
        return (
          <div key={key} className="rounded-xl border border-[#E2E8F0] bg-white p-5">
            <p className="mb-0.5 text-sm font-semibold text-[#0B1F3A]">{en}</p>
            <p className="mb-4 text-[13px] text-[#94A3B8]" dir="rtl">{ar}</p>
            <div className="flex gap-3">
              <button
                onClick={() => handleAnswer(key as QKey, true)}
                className={[
                  'flex-1 rounded-lg border py-2 text-sm font-medium transition-all',
                  ans === true
                    ? 'border-green-400 bg-green-50 text-green-700'
                    : 'border-[#E2E8F0] bg-white text-[#64748B] hover:border-green-300',
                ].join(' ')}
              >
                Yes / نعم
              </button>
              <button
                onClick={() => handleAnswer(key as QKey, false)}
                className={[
                  'flex-1 rounded-lg border py-2 text-sm font-medium transition-all',
                  ans === false
                    ? 'border-red-400 bg-red-50 text-red-700'
                    : 'border-[#E2E8F0] bg-white text-[#64748B] hover:border-red-300',
                ].join(' ')}
              >
                No / لا
              </button>
            </div>
          </div>
        )
      })}

      {/* Star rating */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-5">
        <p className="mb-1 text-sm font-semibold text-[#0B1F3A]">Overall Rating</p>
        <p className="mb-4 text-[13px] text-[#94A3B8]">1 star = poor, 5 stars = excellent</p>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map(s => (
            <button
              key={s}
              onClick={() => setRating(s)}
              className="text-3xl transition-transform hover:scale-110 focus:outline-none"
              aria-label={`Rate ${s} star${s !== 1 ? 's' : ''}`}
            >
              {s <= rating ? '★' : '☆'}
            </button>
          ))}
        </div>
        {rating > 0 && (
          <p className="mt-2 text-[12px] text-[#94A3B8]">{rating} / 5</p>
        )}
      </div>

      {/* Notes */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-5">
        <p className="mb-1 text-sm font-semibold text-[#0B1F3A]">
          Notes or Suggestions <span className="text-[12px] font-normal text-[#94A3B8]">(optional)</span>
        </p>
        <p className="mb-3 text-[13px] text-[#94A3B8]" dir="rtl">ملاحظات أو اقتراحات</p>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={3}
          placeholder="Your notes here…"
          className="w-full resize-none rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm text-[#0B1F3A] placeholder:text-[#CBD5E1] focus:border-[#FF8A1F] focus:outline-none focus:ring-1 focus:ring-[#FF8A1F]/30"
        />
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</p>
      )}

      <button
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="w-full rounded-xl bg-[#FF8A1F] py-3 text-sm font-semibold text-white transition hover:bg-[#e87c18] disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {pending ? 'Submitting…' : 'Submit Feedback'}
      </button>
    </div>
  )
}
