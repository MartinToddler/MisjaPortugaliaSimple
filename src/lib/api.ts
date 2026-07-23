import imageCompression from 'browser-image-compression'
import { supabase } from './supabase'
import { SEED_TASKS } from './seed'
import type { Completion, Family, FamilyPreview, Member, NewTask, Session, Task } from './types'

const MEMBER_KEY = 'mp.memberId'

/** Tłumaczy błędy bazy/sieci na komunikaty zrozumiałe dla rodziny. */
export function friendlyError(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e)
  if (raw.includes('completions_one_per')) return 'To zadanie ma już aktywne zgłoszenie.'
  if (raw.includes('members_family_id_name_key')) return 'W tej wyprawie jest już profil o tym imieniu.'
  if (raw.includes('Failed to fetch') || raw.includes('NetworkError')) {
    return 'Brak połączenia z internetem — spróbuj ponownie.'
  }
  return raw
}

async function ensureSignedIn(): Promise<string> {
  const sb = supabase()
  const { data } = await sb.auth.getSession()
  if (data.session) return data.session.user.id
  const { data: signed, error } = await sb.auth.signInAnonymously()
  if (error || !signed.session) {
    throw error ?? new Error('Nie udało się utworzyć sesji')
  }
  return signed.session.user.id
}

// --- sesja / profile --------------------------------------------------------

export async function getSession(): Promise<Session | null> {
  const memberId = localStorage.getItem(MEMBER_KEY)
  if (!memberId) return null
  const uid = await ensureSignedIn()
  const sb = supabase()
  const { data: member, error } = await sb.from('members').select('*').eq('id', memberId).maybeSingle()
  if (error) throw error
  // profil mógł zostać przejęty na innym urządzeniu — wtedy wracamy na start
  if (!member || member.auth_user_id !== uid) {
    localStorage.removeItem(MEMBER_KEY)
    return null
  }
  const { data: family, error: familyError } = await sb
    .from('families')
    .select('*')
    .eq('id', member.family_id)
    .single()
  if (familyError) throw familyError
  return { member: member as Member, family: family as Family }
}

function storeSession(session: Session): Session {
  localStorage.setItem(MEMBER_KEY, session.member.id)
  return session
}

export function signOutOnDevice(): void {
  localStorage.removeItem(MEMBER_KEY)
}

export async function createFamily(input: {
  familyName: string
  memberName: string
  avatar: string
  goalPoints?: number | null
  goalReward?: string | null
}): Promise<Session> {
  await ensureSignedIn()
  const { data, error } = await supabase().rpc('create_family', {
    p_family_name: input.familyName,
    p_member_name: input.memberName,
    p_avatar: input.avatar,
    p_goal_points: input.goalPoints ?? null,
    p_goal_reward: input.goalReward ?? null,
  })
  if (error) throw error
  return storeSession(data as Session)
}

export async function previewFamily(code: string): Promise<FamilyPreview> {
  await ensureSignedIn()
  const { data, error } = await supabase().rpc('family_preview', { p_code: code })
  if (error) throw error
  return data as FamilyPreview
}

export async function joinFamily(code: string, name: string, avatar: string): Promise<Session> {
  await ensureSignedIn()
  const { data, error } = await supabase().rpc('join_family', {
    p_code: code,
    p_name: name,
    p_avatar: avatar,
  })
  if (error) throw error
  return storeSession(data as Session)
}

export async function claimMember(code: string, memberId: string): Promise<Session> {
  await ensureSignedIn()
  const { data, error } = await supabase().rpc('claim_member', {
    p_code: code,
    p_member_id: memberId,
  })
  if (error) throw error
  return storeSession(data as Session)
}

// --- odczyty ----------------------------------------------------------------

export async function listMembers(familyId: string): Promise<Member[]> {
  const { data, error } = await supabase()
    .from('members')
    .select('*')
    .eq('family_id', familyId)
    .order('created_at')
  if (error) throw error
  return data as Member[]
}

export async function listTasks(familyId: string): Promise<Task[]> {
  const { data, error } = await supabase()
    .from('tasks')
    .select('*')
    .eq('family_id', familyId)
    .order('created_at')
  if (error) throw error
  return data as Task[]
}

export async function listCompletions(familyId: string): Promise<Completion[]> {
  const { data, error } = await supabase()
    .from('completions')
    .select('*')
    .eq('family_id', familyId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as Completion[]
}

// --- zadania (admin) --------------------------------------------------------

export async function createTask(familyId: string, task: NewTask): Promise<Task> {
  const { data, error } = await supabase()
    .from('tasks')
    .insert({ family_id: familyId, ...task })
    .select()
    .single()
  if (error) throw error
  return data as Task
}

export async function updateTask(
  taskId: string,
  patch: Partial<Pick<Task, 'title' | 'description' | 'points' | 'category' | 'is_active'>>,
): Promise<Task> {
  const { data, error } = await supabase().from('tasks').update(patch).eq('id', taskId).select().single()
  if (error) throw error
  return data as Task
}

/** Dodaje misje ze startowego zestawu, pomijając te o już istniejących tytułach. */
export async function seedTasks(familyId: string, existingTitles: string[]): Promise<number> {
  const existing = new Set(existingTitles.map((t) => t.toLowerCase()))
  const fresh = SEED_TASKS.filter((t) => !existing.has(t.title.toLowerCase()))
  if (fresh.length === 0) return 0
  const { error } = await supabase()
    .from('tasks')
    .insert(fresh.map((t) => ({ family_id: familyId, ...t })))
  if (error) throw error
  return fresh.length
}

export async function updateFamilyGoal(
  familyId: string,
  goalPoints: number | null,
  goalReward: string | null,
): Promise<void> {
  const { error } = await supabase()
    .from('families')
    .update({ goal_points: goalPoints, goal_reward: goalReward })
    .eq('id', familyId)
  if (error) throw error
}

export async function deleteFamily(familyId: string): Promise<void> {
  const { error } = await supabase().from('families').delete().eq('id', familyId)
  if (error) throw error
  signOutOnDevice()
}

// --- zgłoszenia wykonania ---------------------------------------------------

export async function submitCompletion(task: Task, member: Member, photo?: File): Promise<Completion> {
  const sb = supabase()
  let photoPath: string | null = null

  if (photo) {
    // zdjęcia z telefonu mają po kilka MB — kompresja oszczędza roaming
    const compressed = await imageCompression(photo, {
      maxSizeMB: 0.4,
      maxWidthOrHeight: 1600,
      useWebWorker: true,
      initialQuality: 0.8,
      fileType: 'image/jpeg',
    })
    photoPath = `${member.family_id}/${crypto.randomUUID()}.jpg`
    const { error } = await sb.storage.from('photos').upload(photoPath, compressed, {
      contentType: 'image/jpeg',
    })
    if (error) throw error
  }

  const { data, error } = await sb
    .from('completions')
    .insert({
      task_id: task.id,
      member_id: member.id,
      family_id: member.family_id,
      task_type: task.type,
      photo_path: photoPath,
    })
    .select()
    .single()
  if (error) throw error
  return data as Completion
}

export async function cancelCompletion(completionId: string): Promise<void> {
  const { error } = await supabase().from('completions').delete().eq('id', completionId)
  if (error) throw error
}

export async function reviewCompletion(completionId: string, approve: boolean): Promise<Completion> {
  const { data, error } = await supabase().rpc('review_completion', {
    p_completion_id: completionId,
    p_approve: approve,
  })
  if (error) throw error
  return data as Completion
}

// --- zdjęcia ----------------------------------------------------------------

const photoUrlCache = new Map<string, { url: string; expiresAt: number }>()

/** Krótkotrwały podpisany URL do zdjęcia z prywatnego bucketa (z cache). */
export async function photoUrl(path: string): Promise<string> {
  const cached = photoUrlCache.get(path)
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.url
  const { data, error } = await supabase().storage.from('photos').createSignedUrl(path, 3600)
  if (error) throw error
  photoUrlCache.set(path, { url: data.signedUrl, expiresAt: Date.now() + 3600_000 })
  return data.signedUrl
}
