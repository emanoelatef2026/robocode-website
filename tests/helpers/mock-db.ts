import { vi } from 'vitest'

export type MockResult<T = unknown> = {
  data: T | null
  error: { message: string; code?: string } | null
}

function makeChain(result: MockResult): any {
  const chain: any = {}
  const methods = [
    'select', 'insert', 'update', 'upsert', 'delete',
    'eq', 'neq', 'gt', 'lt', 'gte', 'lte',
    'in', 'is', 'not', 'or', 'and',
    'order', 'limit', 'range', 'match', 'filter',
  ]
  for (const m of methods) {
    chain[m] = (..._args: any[]) => chain
  }
  chain.single      = () => Promise.resolve(result)
  chain.maybeSingle = () => Promise.resolve(result)
  chain.then = (resolve: (v: any) => any, reject?: (e: any) => any) =>
    Promise.resolve(result).then(resolve, reject)
  chain.catch = (onReject: (e: any) => any) =>
    Promise.resolve(result).catch(onReject)
  return chain
}

// Create a mock DB where each table has an ordered queue of responses.
// Each call to `from(table)` dequeues the next result for that table.
export function createMockDb(tableQueues: Record<string, MockResult[]>) {
  const cursors: Record<string, number> = {}

  const from = vi.fn((table: string) => {
    cursors[table] = cursors[table] ?? 0
    const result = tableQueues[table]?.[cursors[table]++] ?? { data: null, error: null }
    return makeChain(result)
  })

  const rpc = vi.fn().mockResolvedValue({ data: null, error: null })

  return { from, rpc }
}

// A mock DB where every query succeeds with an empty-object payload.
// Enough for wiring tests that only care whether progress hooks are called.
export function createSuccessMockDb() {
  return {
    from: vi.fn(() => makeChain({ data: {}, error: null })),
    rpc:  vi.fn().mockResolvedValue({ data: null, error: null }),
  }
}
