import { Navigate, Route, Routes } from 'react-router-dom'
import { isConfigured } from './lib/supabase'
import Admin from './screens/Admin'
import Approvals from './screens/Approvals'
import Layout from './screens/Layout'
import Scores from './screens/Scores'
import Start from './screens/Start'
import TaskDetail from './screens/TaskDetail'
import Tasks from './screens/Tasks'

function SetupNotice() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-6">
      <div className="text-5xl">🔧</div>
      <h1 className="text-2xl font-bold text-blue-900">Prawie gotowe!</h1>
      <p className="text-slate-600">
        Aplikacja nie ma jeszcze skonfigurowanego backendu. Zajmie to kilka minut:
      </p>
      <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-700">
        <li>
          Utwórz darmowy projekt na <span className="font-semibold">supabase.com</span>.
        </li>
        <li>
          Włącz logowanie anonimowe: <span className="font-semibold">Authentication → Sign In / Providers → Anonymous</span>.
        </li>
        <li>
          W <span className="font-semibold">SQL Editor</span> uruchom zawartość pliku{' '}
          <code className="rounded bg-blue-50 px-1">supabase/schema.sql</code>.
        </li>
        <li>
          Skopiuj <code className="rounded bg-blue-50 px-1">.env.example</code> do{' '}
          <code className="rounded bg-blue-50 px-1">.env</code> i wpisz URL projektu oraz klucz anon
          (na Vercelu: zmienne środowiskowe projektu).
        </li>
        <li>Uruchom aplikację ponownie.</li>
      </ol>
      <p className="text-sm text-slate-500">Szczegółowa instrukcja jest w README.md.</p>
    </div>
  )
}

export default function App() {
  if (!isConfigured) return <SetupNotice />
  return (
    <Routes>
      <Route path="/" element={<Start />} />
      <Route path="/app" element={<Layout />}>
        <Route index element={<Navigate to="/app/zadania" replace />} />
        <Route path="zadania" element={<Tasks />} />
        <Route path="zadanie/:taskId" element={<TaskDetail />} />
        <Route path="potwierdzenia" element={<Approvals />} />
        <Route path="wyniki" element={<Scores />} />
        <Route path="admin" element={<Admin />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
