'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'

interface TopbarTitleValue {
  title: string
  subtitle?: string
}

interface TopbarCtx {
  action: ReactNode
  setAction: (node: ReactNode) => void
  titleOverride: TopbarTitleValue | null
  setTitleOverride: (value: TopbarTitleValue | null) => void
}

const TopbarActionContext = createContext<TopbarCtx>({
  action: null,
  setAction: () => {},
  titleOverride: null,
  setTitleOverride: () => {},
})

export function TopbarActionProvider({ children }: { children: ReactNode }) {
  const [action, setActionState] = useState<ReactNode>(null)
  const setAction = useCallback((node: ReactNode) => setActionState(node), [])
  const [titleOverride, setTitleOverrideState] = useState<TopbarTitleValue | null>(null)
  const setTitleOverride = useCallback((value: TopbarTitleValue | null) => setTitleOverrideState(value), [])
  return (
    <TopbarActionContext.Provider value={{ action, setAction, titleOverride, setTitleOverride }}>
      {children}
    </TopbarActionContext.Provider>
  )
}

export function useTopbarAction() {
  return useContext(TopbarActionContext)
}

/** Drop this inside any page (server or client) to override the topbar title/subtitle. */
export function TopbarTitle({ title, subtitle }: TopbarTitleValue) {
  const { setTitleOverride } = useTopbarAction()
  useEffect(() => {
    setTitleOverride({ title, subtitle })
    return () => setTitleOverride(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setTitleOverride, title, subtitle])
  return null
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
