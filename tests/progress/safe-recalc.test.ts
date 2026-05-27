import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/modules/progress/actions', () => ({
  calculateStudentProgress: vi.fn(),
}))

import { calculateStudentProgress } from '@/modules/progress/actions'
import {
  safeRecalcProgress,
  safeRecalcProgressBatch,
  buildBatchTuples,
} from '@/modules/progress/safe-recalc'
import type { ProgressTuple, GroupProgressContext } from '@/modules/progress/types'

const mockCalc = calculateStudentProgress as ReturnType<typeof vi.fn>

const tuple: ProgressTuple = {
  studentId:  'student-1',
  courseId:   'course-1',
  semesterId: 'semester-1',
  groupId:    'group-1',
}

describe('safeRecalcProgress', () => {
  beforeEach(() => mockCalc.mockReset())

  it('skips when tuple is null and does not call calculateStudentProgress', async () => {
    await safeRecalcProgress(null, 'test-ctx')
    expect(mockCalc).not.toHaveBeenCalled()
  })

  it('calls calculateStudentProgress with the correct four arguments', async () => {
    mockCalc.mockResolvedValue({ success: true, data: undefined })
    await safeRecalcProgress(tuple, 'test-ctx')
    expect(mockCalc).toHaveBeenCalledOnce()
    expect(mockCalc).toHaveBeenCalledWith('student-1', 'course-1', 'semester-1', 'group-1')
  })

  it('swallows a failed ActionResult without throwing', async () => {
    mockCalc.mockResolvedValue({ success: false, error: { code: 'DB_ERROR', message: 'oops' } })
    await expect(safeRecalcProgress(tuple, 'test-ctx')).resolves.toBeUndefined()
  })

  it('swallows a thrown exception without rethrowing', async () => {
    // mockRejectedValueOnce is safe because the One-shot version does not leave
    // a persistent rejected-promise template that Vitest's unhandledRejection
    // detector can observe before the try-catch in safeRecalcProgress fires.
    mockCalc.mockRejectedValueOnce(new Error('network failure'))
    await expect(safeRecalcProgress(tuple, 'test-ctx')).resolves.toBeUndefined()
  })
})

describe('safeRecalcProgressBatch', () => {
  beforeEach(() => mockCalc.mockReset())

  it('skips an empty batch without calling calculateStudentProgress', async () => {
    await safeRecalcProgressBatch([], 'test-ctx')
    expect(mockCalc).not.toHaveBeenCalled()
  })

  it('calls calculateStudentProgress once per tuple', async () => {
    mockCalc.mockResolvedValue({ success: true, data: undefined })
    const tuples: ProgressTuple[] = [
      { studentId: 's1', courseId: 'c1', semesterId: 'sem1', groupId: 'g1' },
      { studentId: 's2', courseId: 'c1', semesterId: 'sem1', groupId: 'g1' },
    ]
    await safeRecalcProgressBatch(tuples, 'test-ctx')
    expect(mockCalc).toHaveBeenCalledTimes(2)
  })

  it('isolates individual failures — one failure does not abort the rest', async () => {
    mockCalc
      .mockRejectedValueOnce(new Error('first student fails'))
      .mockResolvedValueOnce({ success: true, data: undefined })
    const tuples: ProgressTuple[] = [
      { studentId: 's1', courseId: 'c1', semesterId: 'sem1', groupId: 'g1' },
      { studentId: 's2', courseId: 'c1', semesterId: 'sem1', groupId: 'g1' },
    ]
    await expect(safeRecalcProgressBatch(tuples, 'test-ctx')).resolves.toBeUndefined()
    expect(mockCalc).toHaveBeenCalledTimes(2)
  })
})

describe('buildBatchTuples', () => {
  it('produces the cross-product of studentIds × contexts', () => {
    const studentIds = ['s1', 's2']
    const contexts: GroupProgressContext[] = [
      { courseId: 'c1', semesterId: 'sem1', groupId: 'g1' },
      { courseId: 'c2', semesterId: 'sem1', groupId: 'g1' },
    ]
    const result = buildBatchTuples(studentIds, contexts)
    expect(result).toHaveLength(4)
    expect(result).toContainEqual({ studentId: 's1', courseId: 'c1', semesterId: 'sem1', groupId: 'g1' })
    expect(result).toContainEqual({ studentId: 's1', courseId: 'c2', semesterId: 'sem1', groupId: 'g1' })
    expect(result).toContainEqual({ studentId: 's2', courseId: 'c1', semesterId: 'sem1', groupId: 'g1' })
    expect(result).toContainEqual({ studentId: 's2', courseId: 'c2', semesterId: 'sem1', groupId: 'g1' })
  })

  it('returns an empty array when studentIds is empty', () => {
    const contexts: GroupProgressContext[] = [{ courseId: 'c1', semesterId: 'sem1', groupId: 'g1' }]
    expect(buildBatchTuples([], contexts)).toHaveLength(0)
  })

  it('returns an empty array when contexts is empty', () => {
    expect(buildBatchTuples(['s1', 's2'], [])).toHaveLength(0)
  })
})
