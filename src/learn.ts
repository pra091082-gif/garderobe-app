import type { Feedback, Item, Profile } from './db'

const RECENT = 15

function top<T>(values: T[], n: number): [T, number][] {
  const counts = new Map<T, number>()
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1)
  return [...counts].sort((a, b) => b[1] - a[1]).slice(0, n)
}

/** Who the stylist is dressing: department, age, work. */
export function personContext(p: Profile): string {
  const who =
    p.department === 'Kinderen' ? `een kind${p.age ? ` van ${p.age} jaar` : ''}` : p.department === 'Dames' ? 'een vrouw' : 'een man'
  const lines = [`Voor: ${p.name}, ${who} (afdeling ${p.department}).`]
  if (p.job) {
    lines.push(
      `Werk: ${p.job.title}${p.job.company ? ` bij ${p.job.company}` : ''}${p.job.industry ? ` (branche: ${p.job.industry})` : ''}; dresscode ${p.job.dresscode}.`,
    )
  }
  return lines.join('\n')
}

/**
 * Everything the stylist has learned: the style profile plus what was recently liked,
 * rejected and actually worn. This is how suggestions improve over time.
 */
export function preferenceContext(p: Profile, feedback: Feedback[], items: Item[]): string {
  const lines: string[] = []
  if (p.style) {
    lines.push(
      `Stijlprofiel: ${p.style.summary}`,
      `Stijlen: ${p.style.styles.join(', ') || '-'}; kleuren: ${p.style.colors.join(', ') || '-'}; pasvorm: ${p.style.fit || '-'}; liever niet: ${p.style.avoid.join(', ') || '-'}.`,
    )
  }
  const of = (kind: Feedback['kind']) => feedback.filter((f) => f.kind === kind).slice(-RECENT)
  const section = (title: string, list: Feedback[]) => {
    if (list.length) lines.push(`${title}:`, ...list.map((f) => `- ${f.occasion ? `[${f.occasion}] ` : ''}${f.text}`))
  }
  section('Gekozen in de stijltest', of('quiz'))
  section('Vond dit goed', [...of('like'), ...of('saved')])
  section('Vond dit niet goed (vermijden)', of('dislike'))
  section('Echt gedragen', of('worn'))

  const worn = items.filter((i) => i.wornCount > 0)
  if (worn.length) {
    const byWear = [...worn].sort((a, b) => b.wornCount - a.wornCount).slice(0, 8)
    lines.push(`Meest gedragen stukken: ${byWear.map((i) => `${i.name} (${i.wornCount}×)`).join(', ')}.`)
    const colors = top(
      worn.flatMap((i) => i.colors.flatMap((c) => Array(i.wornCount).fill(c) as string[])),
      4,
    )
    lines.push(`Meest gedragen kleuren: ${colors.map(([c]) => c).join(', ')}.`)
  }
  return lines.join('\n') || 'Nog geen voorkeuren bekend.'
}

/** Number of learning signals gathered since the style profile was last updated. */
export function newSignals(p: Profile, feedback: Feedback[]): number {
  return feedback.length - (p.style?.feedbackCount ?? 0)
}
