import 'server-only'
import type { createServiceClient } from '@/lib/supabase/service'

type Db = ReturnType<typeof createServiceClient>
// Preserve fluent Supabase queries while making every awaited DB error fatal.
// Canonical services can use this injected client without changing their rules.
export function checkedEffectsClient(db: Db): Db {
  function wrap<T>(value: T): T {
    if (!value || (typeof value !== 'object' && typeof value !== 'function')) return value
    return new Proxy(value as object, {
      get(target, key) {
        const member = Reflect.get(target, key, target)
        if (key === 'then' && typeof member === 'function') {
          return (resolve: (result: unknown) => unknown, reject: (error: unknown) => unknown) =>
            member.call(target, (result: { error?: { message: string } | null }) => {
              if (result?.error) throw new Error(result.error.message)
              return result
            }).then(resolve, reject)
        }
        return typeof member === 'function'
          ? (...args: unknown[]) => wrap(member.apply(target, args))
          : member
      },
    }) as T
  }
  return wrap(db)
}
