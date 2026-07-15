import { describe, it, expect, vi } from 'vitest'
import { resolvePrimaryActiveGroupId, resolveActiveGroupIds } from '@/modules/academic/enrollment-integrity'

// Sprint 1 — resolveActiveGroupIds is the multi-course-correct counterpart to
// resolvePrimaryActiveGroupId. Both must share the same FIFO ordering so that
// resolveActiveGroupIds(...)[0] === resolvePrimaryActiveGroupId(...) for any
// given student — this is the invariant every multi-course fix in this sprint
// relies on (the "primary" group used for page headers must always be the
// first entry in the "all active groups" list used for stat aggregation).

function makeGroupStudentsChain(rows: { group_id: string }[]) {
  const c: any = {}
  const methods = ['select', 'eq', 'order', 'limit']
  for (const m of methods) c[m] = (..._: any[]) => c
  // maybeSingle() is only called by resolvePrimaryActiveGroupId (single-row path)
  c.maybeSingle = () => Promise.resolve({ data: rows[0] ?? null, error: null })
  // resolveActiveGroupIds awaits the chain directly (no .limit(1).maybeSingle())
  c.then = (r: any) => Promise.resolve({ data: rows, error: null }).then(r)
  return c
}

describe('resolveActiveGroupIds', () => {
  it('returns every active group id in FIFO order, matching resolvePrimaryActiveGroupId', async () => {
    const rows = [{ group_id: 'group-python' }, { group_id: 'group-robotics' }]
    const db: any = { from: vi.fn(() => makeGroupStudentsChain(rows)) }

    const ids = await resolveActiveGroupIds(db, 'student-1')
    expect(ids).toEqual(['group-python', 'group-robotics'])

    const primary = await resolvePrimaryActiveGroupId(db, 'student-1')
    expect(primary).toBe(ids[0])
  })

  it('returns an empty array for a student with no active groups', async () => {
    const db: any = { from: vi.fn(() => makeGroupStudentsChain([])) }
    const ids = await resolveActiveGroupIds(db, 'student-1')
    expect(ids).toEqual([])
  })

  it('returns a single-element array for a single-course student (no regression)', async () => {
    const db: any = { from: vi.fn(() => makeGroupStudentsChain([{ group_id: 'group-a' }])) }
    const ids = await resolveActiveGroupIds(db, 'student-1')
    expect(ids).toEqual(['group-a'])
  })
})
