import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  Avatar,
  ErrorBox,
  PhotoImg,
  PointsChip,
  ProgressBar,
  Spinner,
  cardCls,
  timeAgo,
} from '../components/ui'
import { useCompletions, useMembers, useScores, useSession, useTasks } from '../hooks/useData'
import { reviewCompletion, signOutOnDevice } from '../lib/api'

const MEDALS = ['🥇', '🥈', '🥉']

export default function Scores() {
  const { family, member } = useSession()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const scores = useScores(family.id)
  const { data: completions } = useCompletions(family.id)
  const { data: tasks } = useTasks(family.id)
  const { data: members } = useMembers(family.id)

  const revokeMutation = useMutation({
    mutationFn: (id: string) => reviewCompletion(id, false),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['completions', family.id] }),
  })

  if (!scores || !completions || !tasks || !members) return <Spinner label="Liczenie punktów…" />

  const taskById = new Map(tasks.map((t) => [t.id, t]))
  const memberById = new Map(members.map((m) => [m.id, m]))
  const feed = completions
    .filter((c) => c.status === 'approved')
    .sort(
      (a, b) =>
        new Date(b.resolved_at ?? b.created_at).getTime() -
        new Date(a.resolved_at ?? a.created_at).getTime(),
    )
    .slice(0, 30)
  const goalReached = family.goal_points !== null && scores.familyTotal >= family.goal_points

  return (
    <div className="space-y-4">
      {family.goal_points && (
        <div className={`${cardCls} space-y-2`}>
          <div className="flex items-baseline justify-between">
            <h2 className="font-bold text-blue-900">Cel wyprawy 🎯</h2>
            <span className="text-sm font-bold text-blue-800">
              {scores.familyTotal} / {family.goal_points} pkt
            </span>
          </div>
          <ProgressBar value={scores.familyTotal} max={family.goal_points} />
          {family.goal_reward && (
            <div className="text-sm text-slate-600">
              Nagroda: <span className="font-semibold">{family.goal_reward}</span>
            </div>
          )}
          {goalReached && (
            <div className="rounded-xl bg-green-50 px-3 py-2 text-center font-bold text-green-700">
              🎉 Cel osiągnięty! Czas na nagrodę!
            </div>
          )}
        </div>
      )}

      <div className={`${cardCls} space-y-1`}>
        <h2 className="mb-2 font-bold text-blue-900">Ranking 🏆</h2>
        {scores.rows.map((row, index) => (
          <div
            key={row.member.id}
            className={`flex items-center gap-3 rounded-xl px-2 py-1.5 ${
              row.member.id === member.id ? 'bg-blue-50' : ''
            }`}
          >
            <span className="w-7 text-center text-lg">{MEDALS[index] ?? `${index + 1}.`}</span>
            <Avatar emoji={row.member.avatar} size="sm" />
            <span className="flex-1 font-semibold">
              {row.member.name}
              {row.member.id === member.id && <span className="text-slate-400"> (Ty)</span>}
            </span>
            <span className="font-extrabold text-amber-600">{row.points} pkt</span>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <h2 className="px-1 font-bold text-blue-900">Ostatnie dokonania 📸</h2>
        {feed.length === 0 && (
          <div className={`${cardCls} text-center text-slate-500`}>
            Jeszcze nic tu nie ma — czas na pierwszą misję!
          </div>
        )}
        {feed.map((completion) => {
          const task = taskById.get(completion.task_id)
          const author = memberById.get(completion.member_id)
          return (
            <div key={completion.id} className={`${cardCls} space-y-2`}>
              <div className="flex items-center gap-2 text-sm">
                <Avatar emoji={author?.avatar ?? '🙂'} size="sm" />
                <div className="min-w-0 flex-1">
                  <span className="font-semibold">{author?.name ?? '?'}</span>
                  {completion.task_type === 'family' && (
                    <span className="text-slate-400"> (misja rodzinna)</span>
                  )}
                  <div className="truncate text-slate-600">{task?.title ?? 'Usunięte zadanie'}</div>
                </div>
                {task && <PointsChip points={task.points} plus />}
              </div>
              {completion.photo_path && (
                <PhotoImg path={completion.photo_path} className="h-48 w-full rounded-xl" />
              )}
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>{timeAgo(completion.resolved_at ?? completion.created_at)}</span>
                {member.role === 'admin' && (
                  <button
                    className="font-semibold text-red-400 disabled:opacity-50"
                    disabled={revokeMutation.isPending}
                    onClick={() => {
                      if (window.confirm('Cofnąć zaliczenie tej misji? Punkty zostaną odjęte.')) {
                        revokeMutation.mutate(completion.id)
                      }
                    }}
                  >
                    Cofnij zaliczenie
                  </button>
                )}
              </div>
            </div>
          )
        })}
        <ErrorBox error={revokeMutation.error} />
      </div>

      <button
        className="w-full py-2 text-center text-sm text-slate-400 underline"
        onClick={() => {
          signOutOnDevice()
          queryClient.clear()
          navigate('/')
        }}
      >
        Zmień profil na tym urządzeniu
      </button>
    </div>
  )
}
