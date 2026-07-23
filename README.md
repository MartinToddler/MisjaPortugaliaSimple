# 🇵🇹 Misja Portugalia

Rodzinna gra wakacyjna: wspólna lista misji na wyjazd, punkty za ich wykonanie,
potwierdzanie zdjęciem lub przez innego członka wyprawy, ranking i wspólny cel
(np. „500 pkt = wieczór z lodami"). Aplikacja webowa **PWA** — każdy instaluje ją
na swoim telefonie prosto z przeglądarki, bez sklepów z aplikacjami.

Pełny plan produktu i roadmapa: [PLAN.md](PLAN.md).

## Jak to działa (zasady gry)

1. **Rodzic (admin) zakłada wyprawę** i dostaje 6-znakowy kod dołączenia.
2. **Rodzina dołącza kodem** — każdy wybiera imię i awatar. Bez kont, haseł i e-maili.
3. **Misje**: indywidualne (każdy zalicza raz) i rodzinne (raz na wyprawę,
   punkty dostaje każdy). Admin dodaje własne albo jednym przyciskiem wczytuje
   startowy zestaw portugalskich misji.
4. **Zaliczanie**: zgłoszenie **ze zdjęciem** zalicza misję od razu (zdjęcie widzą
   wszyscy). Zgłoszenie **bez zdjęcia** czeka, aż potwierdzi je ktoś inny z rodziny.
   Nikt nie potwierdza sam sobie; admin może cofnąć każde zaliczenie.
5. **Wyniki**: ranking na żywo, feed dokonań ze zdjęciami i pasek wspólnego celu.

## Szybki start

Wymagania: Node.js 20+ oraz darmowe konto na [supabase.com](https://supabase.com).

### 1. Backend (Supabase, ~5 minut)

1. Utwórz nowy projekt na supabase.com (region EU, np. Frankfurt).
2. Włącz logowanie anonimowe: **Authentication → Sign In / Providers → Anonymous sign-ins → ON**.
3. Otwórz **SQL Editor → New query**, wklej całą zawartość pliku
   [`supabase/schema.sql`](supabase/schema.sql) i kliknij **Run**
   (skrypt można bezpiecznie uruchamiać wielokrotnie).
4. Zanotuj z ustawień projektu: **Project URL** oraz klucz **anon/publishable**.

### 2. Aplikacja lokalnie

```bash
npm install
cp .env.example .env   # wpisz swój Project URL i klucz anon
npm run dev
```

### 3. Deploy na Vercel (darmowy)

1. Wypchnij repozytorium na GitHuba i zaimportuj je na [vercel.com](https://vercel.com)
   (preset: **Vite** — wykrywany automatycznie).
2. W ustawieniach projektu dodaj zmienne środowiskowe
   `VITE_SUPABASE_URL` i `VITE_SUPABASE_ANON_KEY`.
3. Deploy. Link (np. `https://misja.vercel.app`) wysyłasz rodzinie.

### 4. Instalacja na telefonach

- **iPhone (Safari):** otwórz link → Udostępnij → **Do ekranu początkowego**.
- **Android (Chrome):** otwórz link → menu ⋮ → **Zainstaluj aplikację**.

Od tej pory aplikacja odpala się jak natywna, na pełnym ekranie.

## Prywatność

- Zdjęcia trafiają do **prywatnego** bucketa; dostęp mają wyłącznie członkowie
  wyprawy (podpisane, krótkotrwałe URL-e + polityki RLS na poziomie bazy).
- Każda wyprawa jest odizolowana od innych na poziomie wierszy bazy (RLS).
- Admin może w każdej chwili usunąć całą wyprawę z danymi (panel Admin →
  Strefa niebezpieczna). Pliki zdjęć można potem wyczyścić w panelu Supabase
  (Storage → bucket `photos`).
- Logowanie anonimowe tworzy technicznych użytkowników w Supabase — po wyjeździe
  można ich usunąć w **Authentication → Users**.

## Stack

| Warstwa | Technologia |
|---------|-------------|
| Frontend | React 19 + Vite + TypeScript, PWA (`vite-plugin-pwa`) |
| Style | Tailwind CSS 4 |
| Dane | TanStack Query + Supabase Realtime (fallback: polling) |
| Backend | Supabase: Postgres + RLS, RPC, Auth (anonimowe sesje), Storage |
| Zdjęcia | kompresja w przeglądarce (`browser-image-compression`, ~0,4 MB) |
| Hosting | Vercel (SPA rewrite w `vercel.json`) |

## Struktura

```
supabase/schema.sql    # cały backend: tabele, RLS, RPC, storage, realtime
src/
  lib/                 # klient Supabase, typy, API, zestaw startowych misji
  hooks/useData.ts     # sesja, zapytania, punktacja, subskrypcja realtime
  components/ui.tsx    # wspólne klocki UI
  screens/             # Start, Layout, Zadania, Zadanie, Potwierdzenia, Wyniki, Admin
scripts/generate-icons.mjs  # regeneracja ikon PWA (npm run icons)
```

## Rozwój po MVP

Kolejność wg wartości opisana w [PLAN.md](PLAN.md#10-roadmapa-po-mvp-kolejność-wg-wartości):
album-pamiątka ze zdjęciami, zadanie dnia, odznaki, misje powtarzalne,
wydanie w sklepach przez Capacitor, tryb offline.
