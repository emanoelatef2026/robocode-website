import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { AppLayout } from '@/components/shared/layout/AppLayout'
import SessionWorkspace from '@/app/portal/instructor/groups/[id]/sessions/[sid]/SessionWorkspace'
import type { SessionDetail } from '@/modules/instructor-portal/types'
import '@/app/globals.css'
import { makeSession } from './fixture'
import { controls, PREVIEW_EVENT, type PreviewAction } from './actions'

// QA fixture only. This must never become a production route or auth bypass.
function Preview() {
  const [session, setSession] = useState<SessionDetail>(makeSession)
  const [version, setVersion] = useState(0)
  const [failOnce, setFailOnce] = useState(false)
  const [lastAction, setLastAction] = useState('No mock calls yet')
  useEffect(() => {
    function saved(event: Event) {
      const action = (event as CustomEvent<PreviewAction>).detail
      setFailOnce(controls.failOnce)
      setLastAction(`${controls.calls}: ${action.name} — ${action.failed ? 'failed' : 'saved'}`)
      if (action.failed) return
      const fields = new Map(action.fields)
      setSession(previous => ({
        ...previous,
        topic: fields.get('topic') ?? previous.topic,
        status: action.completed ? 'completed' : previous.status,
        ended_at: action.completed ? '2026-10-18T13:30:00Z' : previous.ended_at,
        attendance: previous.attendance.map(row => ({ ...row,
          status: fields.get(`status_${row.student_id}`) ?? row.status,
          notes: fields.get(`notes_${row.student_id}`) ?? row.notes,
        })),
        progress: previous.progress.map(item => action.completed && item.id === previous.id ? { ...item, status: 'completed' } : item),
      }))
    }
    const navigated = (event: Event) => setLastAction(`Mock navigation: ${(event as CustomEvent<string>).detail}`)
    window.addEventListener(PREVIEW_EVENT, saved)
    window.addEventListener('synthetic-navigation', navigated)
    return () => { window.removeEventListener(PREVIEW_EVENT, saved); window.removeEventListener('synthetic-navigation', navigated) }
  }, [])
  return <AppLayout
    renderSidebar={() => <aside aria-label="Synthetic instructor sidebar" className="hidden h-full w-[240px] border-r border-(--border) bg-white p-5 md:block">
      <strong className="block text-lg">Test instructor portal</strong>
      <nav aria-label="Synthetic desktop navigation" className="mt-6 space-y-4 text-sm">
        <p>Test dashboard</p><p aria-current="page" className="font-semibold text-(--cyan-strong)">Test session workspace</p><p>Test groups</p>
      </nav>
    </aside>}
    renderHeader={() => <header aria-label="Synthetic QA controls" className="flex flex-wrap items-center gap-3 border-b border-(--border) bg-white p-3 text-sm">
      <strong>Synthetic QA only · 8 test students</strong>
      <label className="flex items-center gap-2"><input type="checkbox" checked={failOnce} onChange={event => { controls.failOnce = event.target.checked; setFailOnce(event.target.checked) }} />Fail next action once</label>
      <label>Save delay (ms) <input aria-label="Save delay (ms)" type="number" min="0" max="10000" defaultValue={900} onChange={event => { controls.delay = Math.min(10000, Math.max(0, Number(event.target.value))) }} className="w-24 rounded border px-2 py-1" /></label>
      <button type="button" className="rounded border px-3 py-2" onClick={() => { controls.failOnce = false; controls.calls = 0; setFailOnce(false); setLastAction('No mock calls yet'); setSession(makeSession()); setVersion(value => value + 1) }}>Reset synthetic session</button>
      <output aria-label="Last mock action">{lastAction}</output>
    </header>}
    bottomNav={<nav aria-label="Synthetic mobile navigation" className="bottom-nav-safe fixed inset-x-0 bottom-0 z-(--z-bottom-nav) flex h-[64px] items-center justify-around border-t border-(--border) bg-white text-xs md:hidden">
      <span>Test home</span><span aria-current="page" className="font-semibold text-(--cyan-strong)">Test sessions</span><span>Test groups</span>
    </nav>}
  >
    <div className="mx-auto w-full max-w-7xl"><SessionWorkspace key={version} session={session} groupId={session.group_id} /></div>
  </AppLayout>
}

// Preview-only fallback for the font variable normally supplied by next/font.
document.documentElement.style.setProperty('--font-poppins', 'Arial')
createRoot(document.getElementById('root')!).render(<Preview />)
