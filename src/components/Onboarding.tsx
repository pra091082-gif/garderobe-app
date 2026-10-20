import { useState } from 'react'
import { createProfile, saveMeasurements, type Profile } from '../db'
import { setActiveProfile } from '../profile'
import { saveSettings, useSettings } from '../settings'
import { Icon, type IconName } from './icons'
import { MeasurementsForm } from './MeasurementsForm'
import { ProfileForm } from './ProfileForm'
import { StyleQuiz } from './StyleQuiz'

const USPS: [IconName, string, string][] = [
  ['closet', 'Je hele kast digitaal', 'Voor dames, heren en kinderen, elk met een eigen kast.'],
  ['bag', 'Online aankopen automatisch', 'Bestellingen van Zalando, BestSecret en Otrium uit je Gmail.'],
  ['briefcase', 'Outfits voor werk en vrije tijd', 'Afgestemd op je functie, je bedrijf en de dresscode.'],
  ['sparkle', 'Een stylist die je leert kennen', 'Begint met een stijltest en leert van elke keuze.'],
  ['ruler', 'Altijd de juiste maat', 'Maatadvies per merk op basis van je eigen afmetingen.'],
]

/**
 * First run (and "add profile"): welcome → who + work → measurements → style test.
 * With `skipWelcome` it is used to add another person.
 */
export function Onboarding({
  skipWelcome,
  onCreating,
  onDone,
}: {
  skipWelcome?: boolean
  /** Called just before the profile is stored, so the app keeps showing onboarding for the style test. */
  onCreating?: () => void
  onDone: () => void
}) {
  const [step, setStep] = useState<'welcome' | 'profile' | 'sizes' | 'quiz'>(skipWelcome ? 'profile' : 'welcome')
  const [profile, setProfile] = useState<Profile>()
  const settings = useSettings()

  return (
    <div className="onboarding">
      {!skipWelcome && <span className="wordmark">GARDEROBE</span>}

      {step === 'welcome' && (
        <>
          <section className="hero">
            <span className="eyebrow">Je persoonlijke stylist</span>
            <h1>Alles wat je hebt. Elke dag een outfit.</h1>
            <p>
              Leg je kleding vast, haal je online aankopen binnen en laat de AI-stylist outfits samenstellen die echt bij
              je passen: voor je werk en je vrije tijd.
            </p>
          </section>
          <ul className="usp">
            {USPS.map(([icon, title, text]) => (
              <li key={title}>
                <Icon name={icon} />
                <div>
                  <strong>{title}</strong>
                  <span>{text}</span>
                </div>
              </li>
            ))}
          </ul>
          <label className="field">
            <span>Claude API-sleutel (optioneel, voor de AI-stijltest en stylist)</span>
            <input
              type="password"
              autoComplete="off"
              placeholder="sk-ant-…"
              value={settings.anthropicKey}
              onChange={(e) => saveSettings({ anthropicKey: e.target.value.trim() })}
            />
            <small className="muted">
              Zonder sleutel krijg je een standaard stijltest; je kunt hem later toevoegen onder Profiel.
            </small>
          </label>
          <button className="btn btn-primary btn-block" onClick={() => setStep('profile')}>
            Beginnen <Icon name="arrowRight" size={18} />
          </button>
        </>
      )}

      {step === 'profile' && (
        <>
          <div className="page-head">
            <div>
              <span className="eyebrow">Stap 1 van 3</span>
              <h1>Over {skipWelcome ? 'deze persoon' : 'jou'}</h1>
              <p>Zo weet de stylist voor wie de outfits zijn, en wat er op het werk gedragen wordt.</p>
            </div>
          </div>
          <ProfileForm
            submitLabel="Verder"
            onCancel={skipWelcome ? onDone : undefined}
            onSubmit={async (input) => {
              onCreating?.()
              const p = await createProfile(input)
              setActiveProfile(p.id)
              setProfile(p)
              setStep('sizes')
            }}
          />
        </>
      )}

      {step === 'sizes' && profile && (
        <>
          <div className="page-head">
            <div>
              <span className="eyebrow">Stap 2 van 3</span>
              <h1>Maten en afmetingen</h1>
              <p>
                Elk merk valt anders: een M bij het ene merk is een S bij het andere. Met je echte afmetingen adviseert de
                app per merk en per webwinkel de juiste maat.
              </p>
            </div>
          </div>
          <MeasurementsForm
            department={profile.department}
            submitLabel="Verder naar de stijltest"
            onSkip={() => setStep('quiz')}
            onSubmit={async (m) => {
              await saveMeasurements(profile.id, m)
              setStep('quiz')
            }}
          />
        </>
      )}

      {step === 'quiz' && profile && <StyleQuiz profile={profile} onDone={onDone} />}
    </div>
  )
}
