import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Avatar,
  ErrorBox,
  Spinner,
  btnPrimary,
  btnSecondary,
  cardCls,
  inputCls,
  labelCls,
} from '../components/ui'
import { useSessionQuery } from '../hooks/useData'
import { claimMember, createFamily, joinFamily, previewFamily } from '../lib/api'
import type { FamilyPreview, Session } from '../lib/types'

const AVATARS = ['😀', '😎', '🦁', '🐬', '🌞', '🌊', '🍀', '🚀', '🧭', '🏄', '🐙', '🦜', '🍦', '⚽', '🎨', '👑']

function AvatarPicker({ value, onChange }: { value: string; onChange: (avatar: string) => void }) {
  return (
    <div className="grid grid-cols-8 gap-1.5">
      {AVATARS.map((avatar) => (
        <button
          key={avatar}
          type="button"
          onClick={() => onChange(avatar)}
          className={`flex h-9 items-center justify-center rounded-xl text-xl transition ${
            value === avatar ? 'bg-blue-600 ring-2 ring-blue-300' : 'bg-blue-50'
          }`}
          aria-label={`Awatar ${avatar}`}
        >
          {avatar}
        </button>
      ))}
    </div>
  )
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

type View = 'landing' | 'code' | 'profiles' | 'create' | 'created'

export default function Start() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const { data: existingSession, isPending: sessionLoading } = useSessionQuery()

  const [view, setView] = useState<View>('landing')
  const [code, setCode] = useState('')
  const [preview, setPreview] = useState<FamilyPreview | null>(null)
  const [copied, setCopied] = useState(false)

  // formularze
  const [name, setName] = useState('')
  const [avatar, setAvatar] = useState(AVATARS[0])
  const [familyName, setFamilyName] = useState('')
  const [goalPoints, setGoalPoints] = useState('')
  const [goalReward, setGoalReward] = useState('')

  const enterApp = (session: Session) => {
    queryClient.setQueryData(['session'], session)
    navigate('/app')
  }

  const previewMutation = useMutation({
    mutationFn: previewFamily,
    onSuccess: (data) => {
      setPreview(data)
      setView('profiles')
    },
  })
  const joinMutation = useMutation({
    mutationFn: () => joinFamily(code, name.trim(), avatar),
    onSuccess: enterApp,
  })
  const claimMutation = useMutation({
    mutationFn: (memberId: string) => claimMember(code, memberId),
    onSuccess: enterApp,
  })
  const createMutation = useMutation({
    mutationFn: () =>
      createFamily({
        familyName: familyName.trim(),
        memberName: name.trim(),
        avatar,
        goalPoints: goalPoints ? Number(goalPoints) : null,
        goalReward: goalReward.trim() || null,
      }),
    onSuccess: (session) => {
      queryClient.setQueryData(['session'], session)
      setView('created')
    },
  })

  // wejście z linku zaproszenia: /?kod=ABC123
  useEffect(() => {
    const codeFromLink = searchParams.get('kod')
    if (codeFromLink && view === 'landing' && !previewMutation.isPending) {
      setCode(codeFromLink.toUpperCase())
      setView('code')
      previewMutation.mutate(codeFromLink)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const header = (
    <div className="text-center">
      <div className="text-6xl">🇵🇹</div>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-blue-900">Misja Portugalia</h1>
      <p className="mt-1 text-slate-500">Rodzinna gra wakacyjna — misje, punkty i wspólny cel!</p>
    </div>
  )

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 p-6">
      {header}

      {view === 'landing' && (
        <div className="space-y-3">
          {sessionLoading && <Spinner />}
          {existingSession && (
            <button className={btnPrimary} onClick={() => navigate('/app')}>
              Kontynuuj jako {existingSession.member.name} {existingSession.member.avatar}
            </button>
          )}
          <button
            className={existingSession ? btnSecondary : btnPrimary}
            onClick={() => setView('code')}
          >
            🔑 Dołącz do wyprawy
          </button>
          <button className={btnSecondary} onClick={() => setView('create')}>
            ✨ Załóż nową wyprawę
          </button>
        </div>
      )}

      {view === 'code' && (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            previewMutation.mutate(code)
          }}
        >
          <label className={labelCls} htmlFor="join-code">
            Kod wyprawy (dostaniesz go od osoby, która ją założyła)
          </label>
          <input
            id="join-code"
            className={`${inputCls} text-center text-2xl font-bold uppercase tracking-[0.3em]`}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ABC123"
            maxLength={6}
            autoFocus
          />
          <ErrorBox error={previewMutation.error} />
          <button className={btnPrimary} disabled={code.trim().length < 6 || previewMutation.isPending}>
            {previewMutation.isPending ? 'Szukam wyprawy…' : 'Dalej'}
          </button>
          <button type="button" className={btnSecondary} onClick={() => setView('landing')}>
            Wróć
          </button>
        </form>
      )}

      {view === 'profiles' && preview && (
        <div className="space-y-4">
          <div className={cardCls}>
            <div className="text-sm text-slate-500">Wyprawa</div>
            <div className="text-xl font-bold text-blue-900">{preview.family.name}</div>
          </div>

          {preview.members.length > 0 && (
            <div className="space-y-2">
              <div className={labelCls}>Wybierz swój profil:</div>
              {preview.members.map((profileMember) => (
                <button
                  key={profileMember.id}
                  className="flex w-full items-center gap-3 rounded-2xl bg-white p-3 shadow-sm transition active:scale-[0.98]"
                  onClick={() => claimMutation.mutate(profileMember.id)}
                  disabled={claimMutation.isPending}
                >
                  <Avatar emoji={profileMember.avatar} />
                  <span className="font-semibold">{profileMember.name}</span>
                  {profileMember.claimed && (
                    <span className="ml-auto text-xs text-slate-400">używany — przejmiesz go</span>
                  )}
                </button>
              ))}
            </div>
          )}

          <form
            className={`${cardCls} space-y-3`}
            onSubmit={(e) => {
              e.preventDefault()
              joinMutation.mutate()
            }}
          >
            <div className="font-semibold text-blue-900">…albo utwórz nowy profil</div>
            <input
              className={inputCls}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Twoje imię"
              maxLength={40}
            />
            <AvatarPicker value={avatar} onChange={setAvatar} />
            <ErrorBox error={joinMutation.error ?? claimMutation.error} />
            <button className={btnPrimary} disabled={!name.trim() || joinMutation.isPending}>
              {joinMutation.isPending ? 'Dołączam…' : 'Dołącz do wyprawy 🚀'}
            </button>
          </form>
          <button type="button" className={btnSecondary} onClick={() => setView('code')}>
            Wróć
          </button>
        </div>
      )}

      {view === 'create' && (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            createMutation.mutate()
          }}
        >
          <div>
            <label className={labelCls}>Nazwa wyprawy</label>
            <input
              className={inputCls}
              value={familyName}
              onChange={(e) => setFamilyName(e.target.value)}
              placeholder="np. Kowalscy w Portugalii"
              maxLength={60}
            />
          </div>
          <div>
            <label className={labelCls}>Twoje imię (będziesz adminem)</label>
            <input
              className={inputCls}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="np. Tata"
              maxLength={40}
            />
          </div>
          <div>
            <label className={labelCls}>Twój awatar</label>
            <AvatarPicker value={avatar} onChange={setAvatar} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Cel wspólny (pkt)</label>
              <input
                className={inputCls}
                value={goalPoints}
                onChange={(e) => setGoalPoints(e.target.value.replace(/\D/g, ''))}
                placeholder="np. 500"
                inputMode="numeric"
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
          <p className="text-xs text-slate-500">Cel i nagrodę możesz ustawić albo zmienić później w panelu admina.</p>
          <ErrorBox error={createMutation.error} />
          <button
            className={btnPrimary}
            disabled={!familyName.trim() || !name.trim() || createMutation.isPending}
          >
            {createMutation.isPending ? 'Zakładam wyprawę…' : 'Załóż wyprawę ✨'}
          </button>
          <button type="button" className={btnSecondary} onClick={() => setView('landing')}>
            Wróć
          </button>
        </form>
      )}

      {view === 'created' && createMutation.data && (
        <div className="space-y-4 text-center">
          <div className={cardCls}>
            <div className="text-sm text-slate-500">Kod Twojej wyprawy</div>
            <div className="my-2 text-4xl font-extrabold tracking-[0.3em] text-blue-800">
              {createMutation.data.family.join_code}
            </div>
            <p className="text-sm text-slate-500">
              Podaj go rodzinie — każdy wpisuje kod na swoim telefonie i wybiera profil.
            </p>
          </div>
          <button
            className={btnSecondary}
            onClick={async () => {
              const session = createMutation.data
              const link = `${window.location.origin}/?kod=${session.family.join_code}`
              setCopied(await copyText(`Dołącz do wyprawy „${session.family.name}": ${link}`))
            }}
          >
            {copied ? 'Skopiowano! ✅' : '📋 Skopiuj link z zaproszeniem'}
          </button>
          <button className={btnPrimary} onClick={() => navigate('/app')}>
            Zaczynamy! 🚀
          </button>
        </div>
      )}
    </div>
  )
}
