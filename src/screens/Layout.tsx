import { Navigate, NavLink, Outlet } from 'react-router-dom'
import { Avatar, ErrorBox, Spinner } from '../components/ui'
import {
  SessionContext,
  useCompletions,
  useRealtimeInvalidation,
  useSessionQuery,
} from '../hooks/useData'
import type { Session } from '../lib/types'

function Realtime({ familyId }: { familyId: string }) {
  useRealtimeInvalidation(familyId)
  return null
}

function TabBar({ session }: { session: Session }) {
  const { data: completions } = useCompletions(session.family.id)
  const pendingCount =
    completions?.filter((c) => c.status === 'pending' && c.member_id !== session.member.id).length ?? 0

  const tabs: { to: string; label: string; emoji: string; badge?: number }[] = [
    { to: '/app/zadania', label: 'Zadania', emoji: '🧭' },
    { to: '/app/potwierdzenia', label: 'Potwierdź', emoji: '✅', badge: pendingCount },
    { to: '/app/wyniki', label: 'Wyniki', emoji: '🏆' },
  ]
  if (session.member.role === 'admin') {
    tabs.push({ to: '/app/admin', label: 'Admin', emoji: '⚙️' })
  }

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-blue-100 bg-white/95 backdrop-blur pb-safe">
      <div className="mx-auto flex max-w-md">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              `relative flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium ${
                isActive ? 'text-blue-700' : 'text-slate-400'
              }`
            }
          >
            <span className="text-xl leading-none">{tab.emoji}</span>
            {tab.label}
            {tab.badge ? (
              <span className="absolute right-1/2 top-0.5 min-w-4 -translate-x-3 rounded-full bg-red-500 px-1 text-center text-[10px] font-bold leading-4 text-white">
                {tab.badge}
              </span>
            ) : null}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

export default function Layout() {
  const { data: session, isPending, error } = useSessionQuery()

  if (isPending) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <div className="text-center">
          <div className="mb-2 text-5xl">🇵🇹</div>
          <Spinner label="Wczytywanie wyprawy…" />
        </div>
      </div>
    )
  }
  if (error) {
    return (
      <div className="mx-auto max-w-md space-y-4 p-6">
        <ErrorBox error={error} />
        <a href="/" className="block text-center font-medium text-blue-700 underline">
          Wróć na start
        </a>
      </div>
    )
  }
  if (!session) return <Navigate to="/" replace />

  return (
    <SessionContext.Provider value={session}>
      <Realtime familyId={session.family.id} />
      <header className="bg-blue-700 text-white">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
          <div>
            <div className="text-[11px] uppercase tracking-widest text-blue-200">Misja Portugalia</div>
            <div className="font-bold leading-tight">{session.family.name}</div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{session.member.name}</span>
            <Avatar emoji={session.member.avatar} size="sm" />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-md px-4 pb-28 pt-4">
        <Outlet />
      </main>
      <TabBar session={session} />
    </SessionContext.Provider>
  )
}
