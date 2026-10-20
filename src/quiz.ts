import type { Department, Profile, StyleProfile } from './db'

export interface QuizOption {
  title: string
  description: string
  /** 3-5 hex colours that capture the look. */
  palette: string[]
  pieces: string[]
}

export interface QuizRound {
  question: string
  options: QuizOption[]
}

export interface QuizAnswer {
  question: string
  /** undefined when nothing appealed */
  choice?: QuizOption
}

const o = (title: string, description: string, palette: string[], pieces: string[]): QuizOption => ({
  title,
  description,
  palette,
  pieces,
})

const LOOKS: Record<Department, QuizOption[]> = {
  Dames: [
    o('Tijdloos klassiek', 'Verzorgd, rustig en kwalitatief.', ['#1f2f55', '#f4efe6', '#b08d57', '#2b2b2b'], ['Trenchcoat', 'Zijden blouse', 'Pantalon met plooi', 'Loafers']),
    o('Minimalistisch', 'Strakke lijnen, weinig kleur, mooie stoffen.', ['#111111', '#e9e7e2', '#8c8c8c', '#ffffff'], ['Oversized blazer', 'Fijngebreide top', 'Rechte broek', 'Leren sneakers']),
    o('Romantisch', 'Zacht, vrouwelijk, met details.', ['#ecc5c0', '#f7ede2', '#a8738a', '#ffffff'], ['Midi-jurk met print', 'Vest met parelknopen', 'Ballerina’s']),
    o('Streetwear', 'Stoer, comfortabel en trendy.', ['#2b2b2b', '#d6d1c4', '#5c6b3a', '#e2e2e2'], ['Hoodie', 'Cargobroek', 'Chunky sneakers', 'Cap']),
    o('Bohemien', 'Losse silhouetten, natuurlijke tinten.', ['#b5653b', '#e8d8b9', '#6f7d4c', '#f3ebe0'], ['Maxirok', 'Kanten blouse', 'Suède laarzen']),
  ],
  Heren: [
    o('Tijdloos klassiek', 'Verzorgd, kwaliteit, nooit uit de mode.', ['#1f2f55', '#f2f0eb', '#7a5236', '#3a3a3a'], ['Navy colbert', 'Oxford-overhemd', 'Chino', 'Suède loafers']),
    o('Minimalistisch', 'Strak, monochroom, weinig poespas.', ['#111111', '#e7e7e7', '#7d7d7d', '#ffffff'], ['Merino trui', 'Rechte zwarte broek', 'Witte leren sneakers']),
    o('Rugged / outdoor', 'Robuust en praktisch.', ['#5c6b3a', '#8a6a46', '#2e3b4e', '#d8cfbf'], ['Overshirt', 'Raw denim', 'Veterboots']),
    o('Streetwear', 'Comfortabel, stoer, met statement-stukken.', ['#2b2b2b', '#d6d1c4', '#c8323b', '#e2e2e2'], ['Oversized hoodie', 'Cargobroek', 'Hoge sneakers']),
    o('Sportief casual', 'Functioneel en relaxed.', ['#1f1f1f', '#3466b4', '#e5e5e5', '#9a9a9a'], ['Polo', 'Joggers', 'Runningschoenen', 'Bodywarmer']),
  ],
  Kinderen: [
    o('Speels & kleurrijk', 'Vrolijke kleuren en prints.', ['#f1cf3b', '#3466b4', '#c8323b', '#4f8a4b'], ['Print-T-shirt', 'Gekleurde broek', 'Sneakers met klittenband']),
    o('Sportief', 'Klaar om te rennen en te spelen.', ['#1f1f1f', '#3466b4', '#e5e5e5', '#ec8a33'], ['Trainingspak', 'Sportsneakers', 'Softshell jas']),
    o('Stoer', 'Donkere tinten en robuuste stukken.', ['#2b2b2b', '#5c6b3a', '#7a5236', '#9a9a9a'], ['Spijkerjas', 'Cargobroek', 'Boots']),
    o('Lief & romantisch', 'Zachte kleuren, ruches en details.', ['#ecc5c0', '#f7ede2', '#c9b6e4', '#ffffff'], ['Jurk met ruches', 'Gebreid vest', 'Ballerina’s']),
    o('Basics', 'Eenvoudig, makkelijk combineerbaar.', ['#1f2f55', '#f4efe6', '#9a9a9a', '#ffffff'], ['Effen sweater', 'Jeans', 'Witte sneakers']),
  ],
}

const PALETTES: QuizOption[] = [
  o('Neutraal', 'Wit, beige, grijs en zwart.', ['#ffffff', '#d9c7a7', '#9a9a9a', '#1f1f1f'], []),
  o('Aardetinten', 'Camel, olijf, roest en bruin.', ['#b08d57', '#6f7d4c', '#b5653b', '#7a5236'], []),
  o('Pastel', 'Zacht roze, mint, lila en lichtblauw.', ['#ecc5c0', '#bfe3d0', '#c9b6e4', '#bcd4f0'], []),
  o('Krachtig', 'Felle, uitgesproken kleuren.', ['#c8323b', '#3466b4', '#f1cf3b', '#4f8a4b'], []),
  o('Donker & diep', 'Navy, bordeaux, flessengroen en antraciet.', ['#1f2f55', '#6b1f2f', '#1f4d3a', '#333333'], []),
]

const FITS: QuizOption[] = [
  o('Getailleerd', 'Nauwsluitend, laat de vorm zien.', ['#1f1f1f', '#e9e7e2', '#8c8c8c'], ['Slim-fit', 'Getailleerde jas']),
  o('Relaxed / oversized', 'Ruim en comfortabel.', ['#d6d1c4', '#5c6b3a', '#e2e2e2'], ['Oversized trui', 'Wijde broek']),
  o('Recht & klassiek', 'Niet te strak, niet te wijd.', ['#1f2f55', '#f4efe6', '#7a5236'], ['Regular fit', 'Rechte pijp']),
]

const WORK: Record<string, QuizOption[]> = {
  formal: [
    o('Pak of mantelpak', 'Volledig formeel, donker en strak.', ['#1f2f55', '#ffffff', '#333333'], ['Pak', 'Wit overhemd/blouse', 'Leren schoenen']),
    o('Colbert met pantalon', 'Formeel maar met variatie.', ['#3a3a3a', '#bcd4f0', '#7a5236'], ['Los colbert', 'Pantalon', 'Loafers']),
    o('Strak monochroom', 'Eén kleurfamilie, modern zakelijk.', ['#111111', '#8c8c8c', '#e9e7e2'], ['Coltrui', 'Pantalon', 'Minimalistische schoenen']),
  ],
  smart: [
    o('Blazer + jeans', 'Zakelijk boven, relaxed onder.', ['#1f2f55', '#3466b4', '#ffffff'], ['Blazer', 'Donkere jeans', 'Leren sneakers']),
    o('Knitwear & chino', 'Zacht en verzorgd.', ['#b08d57', '#f4efe6', '#6f7d4c'], ['Fijngebreide trui', 'Chino', 'Loafers']),
    o('Overhemd/blouse zonder jasje', 'Eenvoudig en fris.', ['#bcd4f0', '#1f1f1f', '#ffffff'], ['Overhemd of blouse', 'Pantalon', 'Nette sneakers']),
  ],
}

/** Built-in style test, used when no Claude API key is set. */
export function defaultQuiz(p: Profile): QuizRound[] {
  const rounds: QuizRound[] = [
    { question: 'Welke look spreekt je het meest aan?', options: LOOKS[p.department] },
    { question: 'Welk kleurpalet draag je het liefst?', options: PALETTES },
    { question: 'Welke pasvorm voelt het best?', options: FITS },
    { question: 'En als tweede favoriet?', options: [...LOOKS[p.department]].reverse() },
  ]
  if (p.job) {
    const formal = ['Business', 'Formeel'].includes(p.job.dresscode)
    rounds.push({ question: `Wat draag je het liefst naar je werk als ${p.job.title}?`, options: WORK[formal ? 'formal' : 'smart'] })
  }
  return rounds
}

/** Rough style profile from quiz answers alone (no AI). */
export function localStyleProfile(answers: QuizAnswer[], feedbackCount: number): StyleProfile {
  const chosen = answers.map((a) => a.choice).filter((c): c is QuizOption => !!c)
  const styles = [...new Set(chosen.filter((c) => c.pieces.length > 0 && !FITS.includes(c)).map((c) => c.title))]
  return {
    summary: styles.length
      ? `Je voelt je het meest thuis bij ${styles.join(' en ').toLowerCase()}.`
      : 'Je stijl is nog niet duidelijk; de stylist leert van je keuzes.',
    styles,
    colors: chosen.filter((c) => PALETTES.includes(c)).map((c) => c.title),
    avoid: [],
    fit: chosen.find((c) => FITS.includes(c))?.title ?? '',
    updatedAt: Date.now(),
    feedbackCount,
  }
}
