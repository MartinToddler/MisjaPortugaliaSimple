import { useRef, type ChangeEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import {
  Avatar,
  ErrorBox,
  PhotoImg,
  PointsChip,
  Spinner,
  btnPrimary,
  btnSecondary,
  cardCls,
  timeAgo,
} from '../components/ui'
import { useCompletions, useMembers, useSession, useTasks } from '../hooks/useData'
import { cancelCompletion, submitCompletion } from '../lib/api'
import { categoryEmoji } from '../lib/seed'
import { activeCompletionFor } from './Tasks'

const STATUS_LABEL = {
  pending: '⏳ czeka na potwierdzenie',
  approved: '✅ zaliczone',
  rejected: '❌ odrzucone',
} as const

export default function TaskDetail() {
  const { taskId } = useParams()
  const { family, member } = useSession()
  const queryClient = useQueryClient()
  const { data: tasks } = useTasks(family.id)
  const { data: completions } = useCompletions(family.id)
  const { data: members } = useMembers(family.id)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const task = tasks?.find((t) => t.id === taskId)

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['completions', family.id] })

  const submitMutation = useMutation({
    mutationFn: async (photo?: File) => {
      if (!task) throw new Error('Nie znaleziono zadania')
      return submitCompletion(task, member, photo)
    },
    onSuccess: invalidate,
  })
  const cancelMutation = useMutation({
    mutationFn: cancelCompletion,
    onSuccess: invalidate,
  })

  if (!tasks || !completions) return <Spinner label="Wczytywanie…" />
  if (!task) {
    return (
      <div className={`${cardCls} space-y-3 text-center`}>
        <p>Nie znaleziono tego zadania.</p>
        <Link to="/app/zadania" className="font-bold text-blue-700 underline">
          Wróć do misji
        </Link>
      </div>
    )
  }

  const taskCompletions = completions.filter((c) => c.task_id === task.id)
  const activeCompletion = activeCompletionFor(task, completions, member.id)
  const memberById = new Map((members ?? []).map((m) => [m.id, m]))
  const isBusy = submitMutation.isPending || cancelMutation.isPending

  const onPickPhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) submitMutation.mutate(file)
    event.target.value = ''
  }

  return (
    <div className="space-y-4">
      <Link to="/app/zadania" className="inline-block text-sm font-medium text-blue-700">
        ← Wszystkie misje
      </Link>

      <div className={`${cardCls} space-y-3`}>
        <div className="flex items-start gap-3">
          <span className="text-3xl">{categoryEmoji(task.category)}</span>
          <div className="flex-1">
            <h1 className="text-lg font-bold leading-snug text-blue-900">{task.title}</h1>
            <div className="mt-1 flex items-center gap-2">
              <PointsChip points={task.points} />
              <span className="text-xs font-medium text-slate-500">
                {task.type === 'family' ? '👨‍👩‍👧‍👦 misja rodzinna' : '🧍 misja indywidualna'}
              </span>
            </div>
          </div>
        </div>
        {task.description && <p className="text-sm text-slate-600">{task.description}</p>}
        {task.type === 'family' && (
          <p className="rounded-xl bg-blue-50 px-3 py-2 text-xs text-blue-700">
            Misję rodzinną zgłasza jedna osoba w imieniu wszystkich — punkty dostaje cała rodzina.
          </p>
        )}
      </div>

      {/* akcje */}
      {!activeCompletion && (
        <div className="space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={onPickPhoto}
          />
          <button className={btnPrimary} disabled={isBusy} onClick={() => fileInputRef.current?.click()}>
            📸 Wykonane! Dodaj zdjęcie
          </button>
          <p className="text-center text-xs text-slate-500">Zdjęcie to dowód — misja zaliczy się od razu.</p>
          <button className={btnSecondary} disabled={isBusy} onClick={() => submitMutation.mutate(undefined)}>
            🙋 Zgłoś bez zdjęcia
          </button>
          <p className="text-center text-xs text-slate-500">
            Ktoś z rodziny będzie musiał potwierdzić, że misja wykonana.
          </p>
          {submitMutation.isPending && <Spinner label="Wysyłam zgłoszenie…" />}
          <ErrorBox error={submitMutation.error} />
        </div>
      )}

      {activeCompletion?.status === 'approved' && (
        <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-center">
          <div className="text-2xl">🎉</div>
          <div className="font-bold text-green-700">Misja zaliczona!</div>
          {task.type === 'family' && (
            <div className="mt-1 text-sm text-green-700">Punkty powędrowały do całej rodziny.</div>
          )}
        </div>
      )}

      {activeCompletion?.status === 'pending' && (
        <div className="space-y-2">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-center">
            <div className="text-2xl">⏳</div>
            <div className="font-bold text-amber-700">
              Zgłoszenie czeka na potwierdzenie
              {activeCompletion.member_id !== member.id &&
                ` (zgłosił(a) ${memberById.get(activeCompletion.member_id)?.name ?? 'ktoś z rodziny'})`}
            </div>
          </div>
          {activeCompletion.member_id === member.id ? (
            <button
              className={btnSecondary}
              disabled={isBusy}
              onClick={() => cancelMutation.mutate(activeCompletion.id)}
            >
              Anuluj zgłoszenie
            </button>
          ) : (
            <Link to="/app/potwierdzenia" className={`${btnSecondary} block text-center`}>
              Możesz je potwierdzić →
            </Link>
          )}
          <ErrorBox error={cancelMutation.error} />
        </div>
      )}

      {/* historia zgłoszeń tego zadania */}
      {taskCompletions.length > 0 && (
        <div className="space-y-2">
          <h2 className="px-1 text-sm font-semibold text-slate-500">Zgłoszenia</h2>
          {taskCompletions.map((completion) => {
            const author = memberById.get(completion.member_id)
            return (
              <div key={completion.id} className={`${cardCls} space-y-2`}>
                <div className="flex items-center gap-2 text-sm">
                  <Avatar emoji={author?.avatar ?? '🙂'} size="sm" />
                  <span className="font-semibold">{author?.name ?? '?'}</span>
                  <span className="text-slate-400">· {timeAgo(completion.created_at)}</span>
                  <span className="ml-auto">{STATUS_LABEL[completion.status]}</span>
                </div>
                {completion.photo_path && (
                  <PhotoImg path={completion.photo_path} className="h-48 w-full rounded-xl" />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
