export type Role = 'admin' | 'member'
export type TaskType = 'individual' | 'family'
export type CompletionStatus = 'pending' | 'approved' | 'rejected'

export interface Family {
  id: string
  name: string
  join_code: string
  goal_points: number | null
  goal_reward: string | null
  created_at: string
}

export interface Member {
  id: string
  family_id: string
  name: string
  avatar: string
  role: Role
  auth_user_id: string | null
  created_at: string
}

export interface Task {
  id: string
  family_id: string
  title: string
  description: string | null
  points: number
  type: TaskType
  category: string | null
  is_active: boolean
  created_at: string
}

export interface Completion {
  id: string
  family_id: string
  task_id: string
  member_id: string
  task_type: TaskType
  photo_path: string | null
  status: CompletionStatus
  approved_by: string | null
  created_at: string
  resolved_at: string | null
}

/** Zalogowany profil + jego wyprawa. */
export interface Session {
  family: Family
  member: Member
}

/** Podgląd wyprawy po kodzie, zanim się do niej dołączy. */
export interface FamilyPreview {
  family: { id: string; name: string }
  members: { id: string; name: string; avatar: string; claimed: boolean }[]
}

export interface NewTask {
  title: string
  description?: string | null
  points: number
  type: TaskType
  category?: string | null
}
