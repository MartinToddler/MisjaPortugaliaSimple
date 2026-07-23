import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Avatar, ErrorBox, PointsChip, Spinner, cardCls, timeAgo } from '../components/ui'
import { useCompletions, useMembers, useSession, useTasks } from '../hooks/useData'
import { cancelCompletion, reviewCompletion } from '../lib/api'
import { categoryEmoji } from '../lib/seed'

export default function Approvals() {
  const { family, member } = useSession()
  const queryClient = useQueryClient()
  const { data: completions } = useCompletions(family.id)
  const { data: tasks } = useTasks(family.id)
  const { data: members } = useMembers(family.id)

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['completions', family.id] })

  const reviewMutation = useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) => reviewCompletion(id, approve),
    onSuccess: invalidate,
  })
  const cancelMutation = useMutation({
    mutationFn: cancelCompletion,
    onSuccess: invalidate,
  })

  if (!completions || !tasks || !members) return <Spinner label="Wczytywanie…" />

  const taskById = new Map(tasks.map((t) => [t.id, t]))
  const memberById = new Map(members.map((m) => [m.id, m]))
  const toReview = completions.filter((c) => c.status === 'pending' && c.member_id !== member.id)
  const myPending = completions.filter((c) => c.status === 'pending' && c.member_id === member.id)

  return (
    <div className="space-y-4">
      <h1 className="px-1 text-lg font-bold text-blue-900">Do potwierdzenia</h1>

      {toReview.length === 0 && (
        <div className={`${cardCls} text-center text-slate-500`}>
          Nic do potwierdzenia. 🎉
          <div className="mt-1 text-xs">
            Trafią tu zgłoszenia bez zdjęcia od reszty rodziny.
          </div>
        </div>
      )}

      {toReview.map((completion) => {
        const task = taskById.get(completion.task_id)
        const author = memberById.get(completion.member_id)
        const busy = reviewMutation.isPending && reviewMutation.variables?.id === completion.id
        return (
          <div key={completion.id} className={`${cardCls} space-y-3`}>
            <div className="flex items-center gap-2 text-sm">
              <Avatar emoji={author?.avatar ?? '🙂'} size="sm" />
              <span>
                <span className="font-semibold">{author?.name ?? '?'}</span> zgłasza wykonanie:
              </span>
              <span className="ml-auto text-xs text-slate-400">{timeAgo(completion.created_at)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">{categoryEmoji(task?.category ?? null)}</span>
              <span className="flex-1 font-semibold leading-snug">{task?.title ?? 'Usunięte zadanie'}</span>
              {task && <PointsChip points={task.points} />}
            </div>
            {completion.task_type === 'family' && (
              <div className="text-xs text-slate-500">👨‍👩‍👧‍👦 Misja rodzinna — punkty dostanie każdy.</div>
            )}
            <div className="flex gap-2">
              <button
                className="flex-1 rounded-2xl bg-green-600 py-3 font-bold text-white transition active:scale-[0.98] disabled:opacity-50"
                disabled={busy}
                onClick={() => reviewMutation.mutate({ id: completion.id, approve: true })}
              >
                ✅ Potwierdzam
              </button>
              <button
                className="flex-1 rounded-2xl border-2 border-red-200 bg-white py-3 font-bold text-red-600 transition active:scale-[0.98] disabled:opacity-50"
                disabled={busy}
                onClick={() => reviewMutation.mutate({ id: completion.id, approve: false })}
              >
                ❌ Odrzucam
              </button>
            </div>
          </div>
        )
      })}
      <ErrorBox error={reviewMutation.error} />

      {myPending.length > 0 && (
        <div className="space-y-2">
          <h2 className="px-1 text-sm font-semibold text-slate-500">Twoje zgłoszenia czekają na innych</h2>
          {myPending.map((completion) => {
            const task = taskById.get(completion.task_id)
            return (
              <div key={completion.id} className={`${cardCls} flex items-center gap-2`}>
                <span className="text-xl">⏳</span>
                <span className="flex-1 text-sm font-medium">{task?.title ?? 'Usunięte zadanie'}</span>
                <button
                  className="text-sm font-semibold text-red-500 disabled:opacity-50"
                  disabled={cancelMutation.isPending}
                  onClick={() => cancelMutation.mutate(completion.id)}
                >
                  Anuluj
                </button>
              </div>
            )
          })}
          <ErrorBox error={cancelMutation.error} />
        </div>
      )}
    </div>
  )
}
