import type { NewTask } from './types'

/** Kategorie misji z emoji używanymi na kartach zadań. */
export const CATEGORIES: Record<string, string> = {
  jedzenie: '🍽️',
  język: '🗣️',
  odkrywanie: '🔎',
  przygoda: '🌊',
  odwaga: '💪',
  razem: '👨‍👩‍👧‍👦',
  inne: '⭐',
}

export function categoryEmoji(category: string | null): string {
  return (category && CATEGORIES[category]) || CATEGORIES.inne
}

/** Startowy zestaw misji — admin wczytuje go jednym przyciskiem i edytuje po swojemu. */
export const SEED_TASKS: NewTask[] = [
  // indywidualne
  { title: 'Spróbuj pastel de nata i oceń go miną', points: 20, type: 'individual', category: 'jedzenie', description: 'Kup i zjedz słynne ciastko pastel de nata. Zdjęcie z miną-oceną mile widziane!' },
  { title: 'Powiedz „obrigado/obrigada" przy zakupie', points: 15, type: 'individual', category: 'język', description: 'Podziękuj po portugalsku w sklepie, kawiarni albo na targu.' },
  { title: 'Znajdź ścianę z azulejos', points: 15, type: 'individual', category: 'odkrywanie', description: 'Wypatrz ścianę z niebieskimi kafelkami azulejos i zrób jej zdjęcie.' },
  { title: 'Naucz się liczyć po portugalsku do 10', points: 25, type: 'individual', category: 'język', description: 'Um, dois, três… Pokaż rodzinie, że umiesz policzyć do dziesięciu.' },
  { title: 'Wypatrz żółty tramwaj', points: 20, type: 'individual', category: 'odkrywanie', description: 'Znajdź słynny żółty tramwaj (w Lizbonie najlepiej nr 28) i uwiecznij go.' },
  { title: 'Wejdź do oceanu (choćby po kostki)', points: 20, type: 'individual', category: 'przygoda', description: 'Atlantyk bywa zimny — liczy się odwaga!' },
  { title: 'Kup samodzielnie owoc na targu', points: 30, type: 'individual', category: 'odwaga', description: 'Wybierz, zapytaj o cenę i zapłać — całkiem sam/sama.' },
  // rodzinne
  { title: 'Wspólne zdjęcie z widokiem na ocean', points: 30, type: 'family', category: 'razem', description: 'Cała rodzina w kadrze, ocean w tle.' },
  { title: 'Zbudujcie razem zamek z piasku', points: 40, type: 'family', category: 'razem', description: 'Wieże, fosa i brama — każdy dokłada swoją część.' },
  { title: 'Rodzinny spacer o zachodzie słońca', points: 25, type: 'family', category: 'razem', description: 'Wyjdźcie razem na spacer, gdy słońce chowa się w oceanie.' },
  { title: 'Kolacja z daniem, którego nikt nie jadł', points: 40, type: 'family', category: 'jedzenie', description: 'Zamówcie wspólnie lokalne danie, którego nikt z Was wcześniej nie próbował.' },
  { title: 'Turniej w grę planszową lub karcianą', points: 25, type: 'family', category: 'razem', description: 'Wieczorny turniej — zwycięzca ma prawo do fanfar.' },
  { title: 'Znajdźcie razem punkt widokowy (miradouro)', points: 30, type: 'family', category: 'odkrywanie', description: 'Dotrzyjcie do miradouro i policzcie z góry mosty albo czerwone dachy.' },
]
