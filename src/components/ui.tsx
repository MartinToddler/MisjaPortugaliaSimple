import { useQuery } from '@tanstack/react-query'
import { friendlyError, photoUrl } from '../lib/api'

// wspólne klasy, żeby wszystkie ekrany wyglądały tak samo
export const btnPrimary =
  'w-full rounded-2xl bg-blue-700 py-3.5 font-bold text-white transition active:scale-[0.98] disabled:opacity-50'
export const btnSecondary =
  'w-full rounded-2xl border-2 border-blue-200 bg-white py-3.5 font-bold text-blue-700 transition active:scale-[0.98] disabled:opacity-50'
export const btnDanger =
  'w-full rounded-2xl border-2 border-red-200 bg-white py-3 font-bold text-red-600 transition active:scale-[0.98] disabled:opacity-50'
export const inputCls =
  'w-full rounded-xl border border-blue-200 bg-white px-4 py-3 outline-none focus:border-blue-500'
export const cardCls = 'rounded-2xl bg-white p-4 shadow-sm'
export const labelCls = 'mb-1 block text-sm font-medium text-slate-600'

const AVATAR_SIZES = {
  sm: 'h-8 w-8 text-lg',
  md: 'h-10 w-10 text-xl',
  lg: 'h-14 w-14 text-3xl',
} as const

export function Avatar({ emoji, size = 'md' }: { emoji: string; size?: keyof typeof AVATAR_SIZES }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-blue-100 ${AVATAR_SIZES[size]}`}
      aria-hidden
    >
      {emoji}
    </span>
  )
}

export function PointsChip({ points, plus = false }: { points: number; plus?: boolean }) {
  return (
    <span className="inline-flex shrink-0 items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-sm font-bold text-amber-800">
      {plus ? '+' : ''}
      {points} pkt
    </span>
  )
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-8 text-slate-500">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      {label && <span>{label}</span>}
    </div>
  )
}

export function ErrorBox({ error }: { error: unknown }) {
  if (!error) return null
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {friendlyError(error)}
    </div>
  )
}

export function ProgressBar({ value, max }: { value: number; max: number }) {
  const percent = Math.min(100, Math.round((value / Math.max(max, 1)) * 100))
  return (
    <div className="h-3 w-full overflow-hidden rounded-full bg-blue-100">
      <div
        className="h-full rounded-full bg-gradient-to-r from-blue-600 to-amber-400 transition-all duration-700"
        style={{ width: `${percent}%` }}
      />
    </div>
  )
}

/** Zdjęcie z prywatnego bucketa — pobiera podpisany URL i pokazuje szkielet w trakcie. */
export function PhotoImg({ path, className = '' }: { path: string; className?: string }) {
  const { data: src } = useQuery({
    queryKey: ['photo', path],
    queryFn: () => photoUrl(path),
    staleTime: 50 * 60_000,
  })
  if (!src) return <div className={`animate-pulse bg-blue-100 ${className}`} />
  return <img src={src} className={`object-cover ${className}`} loading="lazy" alt="Zdjęcie z misji" />
}

/** „5 min temu" po polsku, bez bibliotek. */
export function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (seconds < 60) return 'przed chwilą'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} min temu`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} godz. temu`
  const days = Math.floor(hours / 24)
  return days === 1 ? 'wczoraj' : `${days} dni temu`
}
