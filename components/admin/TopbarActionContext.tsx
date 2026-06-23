'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'

interface TopbarCtx {
  action: ReactNode
  setAction: (node: ReactNode) => void
}

const TopbarActionContext = createContext<TopbarCtx>({ action: null, setAction: () => {} })

export function TopbarActionProvider({ children }: { children: ReactNode }) {
  const [action, setActionState] = useState<ReactNode>(null)
  const setAction = useCallback((node: ReactNode) => setActionState(node), [])
  return (
    <TopbarActionContext.Provider value={{ action, setAction }}>
      {children}
    </TopbarActionContext.Provider>
  )
}

export function useTopbarAction() {
  return useContext(TopbarActionContext)
}

/** Drop this inside any page (server or client) to inject a button into the topbar right slot. */
export function TopbarAction({ children }: { children: ReactNode }) {
  const { setAction } = useTopbarAction()
  useEffect(() => {
    setAction(children)
    return () => setAction(null)
    // children is intentionally omitted — static RSC payloads never change identity
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setAction])
  return null
}
