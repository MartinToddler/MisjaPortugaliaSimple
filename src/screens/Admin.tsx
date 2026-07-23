import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Navigate, useNavigate } from 'react-router-dom'
import {
  ErrorBox,
  PointsChip,
  Spinner,
  btnDanger,
  btnPrimary,
  btnSecondary,
  cardCls,
  inputCls,
  labelCls,
} from '../components/ui'
import { useSession, useTasks } from '../hooks/useData'
import {
  createTask,
  deleteFamily,
  seedTasks,
  updateFamilyGoal,
  updateTask,
} from '../lib/api'
import { CATEGORIES, SEED_TASKS, categoryEmoji } from '../lib/seed'
import type { Task, TaskType } from '../lib/types'

function EditTaskForm({ task, onSave, saving }: {
  task: Task
  onSave: (patch: Partial<Pick<Task, 'title' | 'description' | 'points' | 'category'>>) => void
  saving: boolean
}) {
  const [title, setTitle] = useState(task.title)
  const [points, setPoints] = useState(String(task.points))
  const [category, setCategory] = useState(task.category ?? 'inne')
  const [description, setDescription] = useState(task.description ?? '')

  return (
    <form
      className="mt-3 space-y-2 border-t border-blue-50 pt-3"
      onSubmit={(e) => {
        e.preventDefault()
        onSave({
          title: title.trim(),
          points: Number(points) || task.points,
          category,
          description: description.trim() || null,
        })
      }}
    >
      <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
      <div className="grid grid-cols-2 gap-2">
        <input
          className={inputCls}
          value={points}
          onChange={(e) => setPoints(e.target.value.replace(/\D/g, ''))}
          inputMode="numeric"
          placeholder="punkty"
        />
        <select className={inputCls} value={category} onChange={(e) => setCategory(e.target.value)}>
          {Object.keys(CATEGORIES).map((c) => (
            <option key={c} value={c}>
              {CATEGORIES[c]} {c}
            </option>
          ))}
        </select>
      </div>
      <textarea
        className={inputCls}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="opis (opcjonalny)"
        rows={2}
      />
      <button className={btnPrimary} disabled={saving || !title.trim()}>
        Zapisz zmiany
      </button>
    </form>
  )
}

export default function Admin() {
  const { family, member } = useSession()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: tasks } = useTasks(family.id)

  const [copied, setCopied] = useState<'code' | 'link' | null>(null)
  const [goalPoints, setGoalPoints] = useState(family.goal_points ? String(family.goal_points) : '')
  const [goalReward, setGoalReward] = useState(family.goal_reward ?? '')
  const [goalSaved, setGoalSaved] = useState(false)

  const [newTitle, setNewTitle] = useState('')
  const [newPoints, setNewPoints] = useState('20')
  const [newType, setNewType] = useState<TaskType>('individual')
  const [newCategory, setNewCategory] = useState('inne')
  const [newDescription, setNewDescription] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)

  const invalidateTasks = () => queryClient.invalidateQueries({ queryKey: ['tasks', family.id] })

  const goalMutation = useMutation({
    mutationFn: () =>
      updateFamilyGoal(family.id, goalPoints ? Number(goalPoints) : null, goalReward.trim() || null),
    onSuccess: () => {
      setGoalSaved(true)
      setTimeout(() => setGoalSaved(false), 2500)
      void queryClient.invalidateQueries({ queryKey: ['session'] })
    },
  })
  const createMutation = useMutation({
    mutationFn: () =>
      createTask(family.id, {
        title: newTitle.trim(),
        points: Number(newPoints) || 10,
        type: newType,
        category: newCategory,
        description: newDescription.trim() || null,
      }),
    onSuccess: () => {
      setNewTitle('')
      setNewDescription('')
      invalidateTasks()
    },
  })
  const seedMutation = useMutation({
    mutationFn: () => seedTasks(family.id, (tasks ?? []).map((t) => t.title)),
    onSuccess: invalidateTasks,
  })
  const updateMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof updateTask>[1] }) =>
      updateTask(id, patch),
    onSuccess: () => {
      setEditingId(null)
      invalidateTasks()
    },
  })
  const deleteFamilyMutation = useMutation({
    mutationFn: () => deleteFamily(family.id),
    onSuccess: () => {
      queryClient.clear()
      navigate('/')
    },
  })

  if (member.role !== 'admin') return <Navigate to="/app/zadania" replace />

  const inviteLink = `${window.location.origin}/?kod=${family.join_code}`
  const copy = async (what: 'code' | 'link') => {
    const text =
      what === 'code' ? family.join_code : `Dołącz do wyprawy „${family.name}": ${inviteLink}`
    try {
      if (what === 'link' && navigator.share) {
        await navigator.share({ title: 'Misja Portugalia', text })
        return
      }
      await navigator.clipboard.writeText(text)
      setCopied(what)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      /* użytkownik anulował share — nic nie robimy */
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="px-1 text-lg font-bold text-blue-900">Panel admina ⚙️</h1>

      {/* kod dołączenia */}
      <div className={`${cardCls} space-y-3 text-center`}>
        <div className="text-sm text-slate-500">Kod dołączenia do wyprawy</div>
        <div className="text-4xl font-extrabold tracking-[0.3em] text-blue-800">{family.join_code}</div>
        <div className="flex gap-2">
          <button className={btnSecondary} onClick={() => void copy('code')}>
            {copied === 'code' ? 'Skopiowano ✅' : 'Kopiuj kod'}
          </button>
          <button className={btnSecondary} onClick={() => void copy('link')}>
            {copied === 'link' ? 'Skopiowano ✅' : 'Wyślij link 📤'}
          </button>
        </div>
      </div>

      {/* cel wyprawy */}
      <form
        className={`${cardCls} space-y-3`}
        onSubmit={(e) => {
          e.preventDefault()
          goalMutation.mutate()
        }}
      >
        <h2 className="font-bold text-blue-900">Cel wspólny 🎯</h2>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={labelCls}>Próg punktów</label>
            <input
              className={inputCls}
              value={goalPoints}
              onChange={(e) => setGoalPoints(e.target.value.replace(/\D/g, ''))}
              inputMode="numeric"
              placeholder="np. 500"
            />
          </div>
          <div>
            <label className={labelCls}>Nagroda</label>
            <input
              className={inputCls}
              value={goalReward}
              onChange={(e) => setGoalReward(e.target.value)}
              placeholder="np. wieczór z lodami"
            />
          </div>
        </div>
        <p className="text-xs text-slate-500">
          Do celu liczy się suma punktów wszystkich członków (misje rodzinne punktują każdemu).
        </p>
        <ErrorBox error={goalMutation.error} />
        <button className={btnPrimary} disabled={goalMutation.isPending}>
          {goalSaved ? 'Zapisano ✅' : 'Zapisz cel'}
        </button>
      </form>

      {/* nowe zadanie */}
      <form
        className={`${cardCls} space-y-3`}
        onSubmit={(e) => {
          e.preventDefault()
          createMutation.mutate()
        }}
      >
        <h2 className="font-bold text-blue-900">Nowa misja ➕</h2>
        <input
          className={inputCls}
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="np. Zjedz sardynkę z grilla"
          maxLength={120}
        />
        <div className="grid grid-cols-2 gap-2">
          <select
            className={inputCls}
            value={newType}
            onChange={(e) => setNewType(e.target.value as TaskType)}
          >
            <option value="individual">🧍 indywidualna</option>
            <option value="family">👨‍👩‍👧‍👦 rodzinna</option>
          </select>
          <input
            className={inputCls}
            value={newPoints}
            onChange={(e) => setNewPoints(e.target.value.replace(/\D/g, ''))}
            inputMode="numeric"
            placeholder="punkty"
          />
        </div>
        <select
          className={inputCls}
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value)}
        >
          {Object.keys(CATEGORIES).map((c) => (
            <option key={c} value={c}>
              {CATEGORIES[c]} {c}
            </option>
          ))}
        </select>
        <textarea
          className={inputCls}
          value={newDescription}
          onChange={(e) => setNewDescription(e.target.value)}
          placeholder="opis (opcjonalny)"
          rows={2}
        />
        <ErrorBox error={createMutation.error} />
        <button className={btnPrimary} disabled={!newTitle.trim() || createMutation.isPending}>
          Dodaj misję
        </button>
      </form>

      {/* startowy zestaw */}
      <div className={`${cardCls} space-y-2`}>
        <h2 className="font-bold text-blue-900">Startowy zestaw misji 🇵🇹</h2>
        <p className="text-sm text-slate-600">
          {SEED_TASKS.length} gotowych misji portugalskich (pastel de nata, azulejos, zamek z piasku…).
          Dodane misje możesz potem edytować lub wyłączyć.
        </p>
        <ErrorBox error={seedMutation.error} />
        <button className={btnSecondary} disabled={seedMutation.isPending} onClick={() => seedMutation.mutate()}>
          {seedMutation.isPending
            ? 'Dodaję…'
            : seedMutation.data !== undefined
              ? seedMutation.data > 0
                ? `Dodano ${seedMutation.data} misji ✅`
                : 'Wszystkie już dodane ✅'
              : 'Wczytaj zestaw startowy'}
        </button>
      </div>

      {/* lista zadań */}
      <div className="space-y-2">
        <h2 className="px-1 font-bold text-blue-900">Wszystkie misje ({tasks?.length ?? 0})</h2>
        {!tasks && <Spinner />}
        {tasks?.map((task) => (
          <div key={task.id} className={`${cardCls} ${task.is_active ? '' : 'opacity-60'}`}>
            <div className="flex items-center gap-2">
              <span className="text-xl">{categoryEmoji(task.category)}</span>
              <div className="min-w-0 flex-1">
                <div className="font-semibold leading-snug">{task.title}</div>
                <div className="text-xs text-slate-400">
                  {task.type === 'family' ? '👨‍👩‍👧‍👦 rodzinna' : '🧍 indywidualna'}
                  {!task.is_active && ' · wyłączona'}
                </div>
              </div>
              <PointsChip points={task.points} />
            </div>
            <div className="mt-2 flex gap-4 text-sm font-semibold">
              <button
                className="text-blue-700"
                onClick={() => setEditingId(editingId === task.id ? null : task.id)}
              >
                {editingId === task.id ? 'Zwiń' : 'Edytuj'}
              </button>
              <button
                className={task.is_active ? 'text-slate-500' : 'text-green-600'}
                disabled={updateMutation.isPending}
                onClick={() =>
                  updateMutation.mutate({ id: task.id, patch: { is_active: !task.is_active } })
                }
              >
                {task.is_active ? 'Wyłącz' : 'Włącz'}
              </button>
            </div>
            {editingId === task.id && (
              <EditTaskForm
                task={task}
                saving={updateMutation.isPending}
                onSave={(patch) => updateMutation.mutate({ id: task.id, patch })}
              />
            )}
          </div>
        ))}
        <ErrorBox error={updateMutation.error} />
      </div>

      {/* strefa niebezpieczna */}
      <div className={`${cardCls} space-y-2`}>
        <h2 className="font-bold text-red-700">Strefa niebezpieczna</h2>
        <p className="text-sm text-slate-600">
          Usunięcie wyprawy kasuje wszystkie misje, punkty i profile. Nie da się tego cofnąć.
        </p>
        <ErrorBox error={deleteFamilyMutation.error} />
        <button
          className={btnDanger}
          disabled={deleteFamilyMutation.isPending}
          onClick={() => {
            if (
              window.confirm('Na pewno usunąć całą wyprawę?') &&
              window.confirm('Ostatnie ostrzeżenie: znikną wszystkie punkty i zgłoszenia. Usunąć?')
            ) {
              deleteFamilyMutation.mutate()
            }
          }}
        >
          Usuń wyprawę
        </button>
      </div>
    </div>
  )
}
