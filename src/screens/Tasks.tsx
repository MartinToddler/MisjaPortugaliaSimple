import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Avatar, PointsChip, Spinner, cardCls } from '../components/ui'
import { useCompletions, useScores, useSession, useTasks } from '../hooks/useData'
import { categoryEmoji } from '../lib/seed'
import type { Completion, Task, TaskType } from '../lib/types'

/** Aktywne (nieodrzucone) zgłoszenie danego zadania z perspektywy członka. */
export function activeCompletionFor(
  task: Task,
  completions: Completion[],
  memberId: string,
): Completion | undefined {
  return completions.find(
    (c) =>
      c.task_id === task.id &&
      c.status !== 'rejected' &&
      (task.type === 'family' || c.member_id === memberId),
  )
}

function StatusBadge({ completion }: { completion: Completion | undefined }) {
  if (!completion) return null
  if (completion.status === 'approved') {
    return <span className="text-xs font-semibold text-green-600">✅ Zaliczone</span>
  }
  return <span className="text-xs font-semibold text-amber-600">⏳ Czeka na potwierdzenie</span>
}

export default function Tasks() {
  const { family, member } = useSession()
  const { data: tasks } = useTasks(family.id)
  const { data: completions } = useCompletions(family.id)
  const scores = useScores(family.id)
  const [tab, setTab] = useState<TaskType>('individual')
  const [hideDone, setHideDone] = useState(false)

  if (!tasks || !completions) return <Spinner label="Wczytywanie misji…" />

  const myPoints = scores?.rows.find((row) => row.member.id === member.id)?.points ?? 0
  const activeTasks = tasks.filter((t) => t.is_active)
  const withStatus = activeTasks.map((task) => ({
    task,
    completion: activeCompletionFor(task, completions, member.id),
  }))

  const tabCounts = (type: TaskType) => {
    const ofType = withStatus.filter(({ task }) => task.type === type)
    const done = ofType.filter(({ completion }) => completion?.status === 'approved').length
    return `${done}/${ofType.length}`
  }

  const visible = withStatus
    .filter(({ task }) => task.type === tab)
    .filter(({ completion }) => !hideDone || completion?.status !== 'approved')

  return (
    <div className="space-y-4">
      <div className={`${cardCls} flex items-center gap-3`}>
        <Avatar emoji={member.avatar} size="lg" />
        <div>
          <div className="font-bold text-blue-900">Cześć, {member.name}!</div>
          <div className="text-sm text-slate-500">
            Masz <span className="font-bold text-amber-600">{myPoints} pkt</span> — tak trzymaj! 💪
          </div>
        </div>
      </div>

      <div className="flex rounded-2xl bg-blue-100 p-1">
        {(
          [
            { type: 'individual' as const, label: '🧍 Indywidualne' },
            { type: 'family' as const, label: '👨‍👩‍👧‍👦 Rodzinne' },
          ]
        ).map(({ type, label }) => (
          <button
            key={type}
            onClick={() => setTab(type)}
            className={`flex-1 rounded-xl py-2 text-sm font-bold transition ${
              tab === type ? 'bg-white text-blue-800 shadow-sm' : 'text-blue-500'
            }`}
          >
            {label} · {tabCounts(type)}
          </button>
        ))}
      </div>

      <label className="flex items-center gap-2 px-1 text-sm text-slate-500">
        <input
          type="checkbox"
          checked={hideDone}
          onChange={(e) => setHideDone(e.target.checked)}
          className="h-4 w-4 accent-blue-700"
        />
        Ukryj zaliczone
      </label>

      {visible.length === 0 && (
        <div className={`${cardCls} text-center text-slate-500`}>
          {activeTasks.length === 0
            ? member.role === 'admin'
              ? 'Nie ma jeszcze misji — dodaj je w zakładce Admin (jest tam gotowy zestaw startowy!).'
              : 'Nie ma jeszcze misji — poproś admina wyprawy, żeby je dodał.'
            : 'Nic tu nie ma. Wszystko zaliczone? 🎉'}
        </div>
      )}

      <div className="space-y-2">
        {visible.map(({ task, completion }) => (
          <Link
            key={task.id}
            to={`/app/zadanie/${task.id}`}
            className={`${cardCls} flex items-center gap-3 transition active:scale-[0.99] ${
              completion?.status === 'approved' ? 'opacity-70' : ''
            }`}
          >
            <span className="text-2xl">{categoryEmoji(task.category)}</span>
            <div className="min-w-0 flex-1">
              <div className="font-semibold leading-snug text-slate-800">{task.title}</div>
              <StatusBadge completion={completion} />
            </div>
            <PointsChip points={task.points} />
          </Link>
        ))}
      </div>
    </div>
  )
}
