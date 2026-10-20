import { useEffect, useRef, useState } from 'react'
import { addFeedback, db, type Profile, type StyleProfile } from '../db'
import { defaultQuiz, localStyleProfile, type QuizAnswer, type QuizOption, type QuizRound } from '../quiz'
import { getSettings } from '../settings'
import { Icon } from './icons'
import { Loading } from './ui'

/**
 * The style test: AI-generated rounds when a Claude key is set, otherwise the built-in set.
 * Each pick is stored as feedback and the result becomes the profile's style profile.
 */
export function StyleQuiz({ profile, onDone }: { profile: Profile; onDone: () => void }) {
  const [rounds, setRounds] = useState<QuizRound[]>()
  const [aiMade, setAiMade] = useState(false)
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<QuizAnswer[]>([])
  const [phase, setPhase] = useState<'quiz' | 'analyzing' | 'done'>('quiz')
  const [error, setError] = useState<string>()
  // The profile object changes when the quiz saves its result; only a different person should restart the test.
  const profileRef = useRef(profile)

  useEffect(() => {
    let cancelled = false
    const profile = profileRef.current
    async function load() {
      if (getSettings().anthropicKey) {
        try {
          const { generateQuiz } = await import('../ai')
          const r = await generateQuiz(profile)
          if (!cancelled && r.length >= 3) {
            setRounds(r)
            setAiMade(true)
            return
          }
        } catch (e) {
          if (!cancelled) setError(`${e instanceof Error ? e.message : e} We gebruiken de standaardtest.`)
        }
      }
      if (!cancelled) setRounds(defaultQuiz(profile))
    }
    load()
    return () => {
      cancelled = true
    }
  }, [profile.id])

  async function finish(all: QuizAnswer[]) {
    setPhase('analyzing')
    for (const a of all) {
      if (a.choice) {
        await addFeedback({
          profileId: profile.id,
          kind: 'quiz',
          text: `${a.question} → ${a.choice.title} (${[a.choice.description, ...a.choice.pieces].join(', ')})`,
          itemIds: [],
        })
      }
    }
    const feedback = await db.feedback.where('profileId').equals(profile.id).toArray()
    let style: StyleProfile | undefined
    if (getSettings().anthropicKey) {
      try {
        const { analyzeStyle } = await import('../ai')
        const items = await db.items.where('profileId').equals(profile.id).toArray()
        style = await analyzeStyle(profile, feedback, items, all)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    }
    style ??= localStyleProfile(all, feedback.length)
    await db.profiles.update(profile.id, { style })
    setPhase('done')
  }

  function choose(choice?: QuizOption) {
    const next = [...answers, { question: rounds![step].question, choice }]
    setAnswers(next)
    if (step + 1 < rounds!.length) setStep(step + 1)
    else finish(next)
  }

  if (!rounds) return <Loading>Je persoonlijke stijltest wordt samengesteld…</Loading>
  if (phase === 'analyzing') return <Loading>Je stijlprofiel wordt gemaakt…</Loading>
  if (phase === 'done') return <StyleResult profileId={profile.id} onDone={onDone} />

  const round = rounds[step]
  return (
    <div className="page">
      <div className="progress" aria-hidden>
        <div style={{ width: `${(step / rounds.length) * 100}%` }} />
      </div>
      <div className="page-head">
        <div>
          <span className="eyebrow">
            Stijltest · vraag {step + 1} van {rounds.length}
            {aiMade && ' · samengesteld door AI'}
          </span>
          <h1>{round.question}</h1>
        </div>
      </div>
      {error && <p className="muted small">{error}</p>}
      <div className="quiz-options">
        {round.options.map((o, i) => (
          <MoodCard key={`${step}-${i}`} option={o} onClick={() => choose(o)} />
        ))}
      </div>
      <div className="form-actions start">
        <button className="link-btn" onClick={() => choose(undefined)}>
          Geen van deze
        </button>
      </div>
    </div>
  )
}

export function MoodCard({ option, onClick, active }: { option: QuizOption; onClick?: () => void; active?: boolean }) {
  const palette = option.palette.length ? option.palette : ['#e6e6e6']
  return (
    <button type="button" className={`mood ${active ? 'active' : ''}`} onClick={onClick}>
      <span className="mood-swatch" aria-hidden>
        {palette.map((c, i) => (
          <span key={i} style={{ background: c }} />
        ))}
      </span>
      <span className="mood-body">
        <strong>{option.title}</strong>
        <p>{option.description}</p>
        {option.pieces.length > 0 && (
          <ul>
            {option.pieces.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}
      </span>
    </button>
  )
}

function StyleResult({ profileId, onDone }: { profileId: string; onDone: () => void }) {
  const [profile, setProfile] = useState<Profile>()
  useEffect(() => {
    db.profiles.get(profileId).then(setProfile)
  }, [profileId])
  if (!profile?.style) return null
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <span className="eyebrow">Klaar</span>
          <h1>Dit is jouw stijl, {profile.name}</h1>
        </div>
      </div>
      <StyleCard profile={profile} />
      <p className="muted">
        De stylist houdt rekening met dit profiel en leert van wat je kiest, afwijst en draagt. Je kunt de test altijd
        opnieuw doen onder Profiel.
      </p>
      <button className="btn btn-primary" onClick={onDone}>
        Naar mijn kast <Icon name="arrowRight" size={18} />
      </button>
    </div>
  )
}

export function StyleCard({ profile }: { profile: Profile }) {
  const s = profile.style
  if (!s) return null
  return (
    <div className="style-card">
      <span className="eyebrow">Stijlprofiel</span>
      <p>{s.summary}</p>
      {s.styles.length > 0 && (
        <div className="tags">
          {s.styles.map((t) => (
            <span key={t} className="tag-pill">
              {t}
            </span>
          ))}
        </div>
      )}
      <div className="small">
        {s.colors.length > 0 && <div>Kleuren: {s.colors.join(', ')}</div>}
        {s.fit && <div>Pasvorm: {s.fit}</div>}
        {s.avoid.length > 0 && <div>Liever niet: {s.avoid.join(', ')}</div>}
      </div>
    </div>
  )
}
