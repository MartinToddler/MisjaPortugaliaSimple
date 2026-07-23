import { createContext, useContext, useEffect, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getSession, listCompletions, listMembers, listTasks } from '../lib/api'
import { supabase } from '../lib/supabase'
import type { Member, Session } from '../lib/types'

// --- sesja (profil + wyprawa) -----------------------------------------------

export const SessionContext = createContext<Session | null>(null)

/** Bieżący profil i wyprawa — dostępne wewnątrz Layoutu. */
export function useSession(): Session {
  const session = useContext(SessionContext)
  if (!session) throw new Error('useSession użyte poza Layoutem')
  return session
}

export function useSessionQuery() {
  return useQuery({
    queryKey: ['session'],
    queryFn: getSession,
    staleTime: 5 * 60_000,
    retry: 1,
  })
}

// --- dane wyprawy -----------------------------------------------------------

export function useMembers(familyId: string) {
  return useQuery({
    queryKey: ['members', familyId],
    queryFn: () => listMembers(familyId),
    refetchInterval: 60_000,
  })
}

export function useTasks(familyId: string) {
  return useQuery({
    queryKey: ['tasks', familyId],
    queryFn: () => listTasks(familyId),
    refetchInterval: 60_000,
  })
}

export function useCompletions(familyId: string) {
  return useQuery({
    queryKey: ['completions', familyId],
    queryFn: () => listCompletions(familyId),
    // fallback dla realtime — na słabym zasięgu i tak dociągniemy zmiany
    refetchInterval: 20_000,
  })
}

export interface ScoreRow {
  member: Member
  points: number
}

/** Punktacja liczona z zatwierdzonych zgłoszeń (zadania rodzinne punktują każdego). */
export function useScores(familyId: string): { rows: ScoreRow[]; familyTotal: number } | undefined {
  const { data: members } = useMembers(familyId)
  const { data: tasks } = useTasks(familyId)
  const { data: completions } = useCompletions(familyId)

  return useMemo(() => {
    if (!members || !tasks || !completions) return undefined
    const taskById = new Map(tasks.map((t) => [t.id, t]))
    const points = new Map<string, number>(members.map((m) => [m.id, 0]))

    for (const completion of completions) {
      if (completion.status !== 'approved') continue
      const task = taskById.get(completion.task_id)
      if (!task) continue
      if (task.type === 'individual') {
        points.set(completion.member_id, (points.get(completion.member_id) ?? 0) + task.points)
      } else {
        for (const m of members) points.set(m.id, (points.get(m.id) ?? 0) + task.points)
      }
    }

    const rows = members
      .map((member) => ({ member, points: points.get(member.id) ?? 0 }))
      .sort((a, b) => b.points - a.points || a.member.name.localeCompare(b.member.name, 'pl'))
    const familyTotal = rows.reduce((sum, row) => sum + row.points, 0)
    return { rows, familyTotal }
  }, [members, tasks, completions])
}

// --- realtime ----------------------------------------------------------------

/** Subskrybuje zmiany w wyprawie i odświeża odpowiednie zapytania. */
export function useRealtimeInvalidation(familyId: string) {
  const queryClient = useQueryClient()
  useEffect(() => {
    const sb = supabase()
    const invalidate = (key: string) => () => {
      void queryClient.invalidateQueries({ queryKey: [key, familyId] })
    }
    const channel = sb
      .channel(`family-${familyId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'completions', filter: `family_id=eq.${familyId}` },
        invalidate('completions'),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks', filter: `family_id=eq.${familyId}` },
        invalidate('tasks'),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'members', filter: `family_id=eq.${familyId}` },
        invalidate('members'),
      )
      .subscribe()
    return () => {
      void sb.removeChannel(channel)
    }
  }, [familyId, queryClient])
}
