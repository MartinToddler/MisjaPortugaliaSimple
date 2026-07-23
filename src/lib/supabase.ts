import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/** Czy aplikacja ma skonfigurowane połączenie z Supabase (zmienne VITE_*). */
export const isConfigured = Boolean(url?.startsWith('http') && anonKey)

let client: SupabaseClient | null = null

export function supabase(): SupabaseClient {
  if (!client) {
    if (!isConfigured) {
      throw new Error('Brak konfiguracji Supabase — uzupełnij VITE_SUPABASE_URL i VITE_SUPABASE_ANON_KEY')
    }
    client = createClient(url!, anonKey!)
  }
  return client
}
