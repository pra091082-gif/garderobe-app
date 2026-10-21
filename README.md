# Garderobe

Een web-app (PWA) voor je persoonlijke kledingkast: kleding en schoenen vastleggen met foto, online aankopen automatisch binnenhalen uit Gmail, outfits samenstellen met een AI-stylist en inspiratie van internet zoeken voor stukken die je al hebt.

Je kast staat lokaal op je apparaat (IndexedDB). Er is geen eigen server: de app praat rechtstreeks met Gmail (alleen-lezen) en met Claude, met jouw eigen sleutels.

## Functies

- **Vandaag**: het openingsscherm. Haalt het weer van vandaag op voor je locatie (of een plaats die je kiest) via [Open-Meteo](https://open-meteo.com), gratis en zonder sleutel. Je krijgt tot drie outfits uit de eigen kast die passen bij temperatuur, regen, wind, seizoen en de dag (doordeweeks werk, in het weekend vrije tijd). Werkt zonder AI. Ontbreekt er iets voor dit weer, zoals een regenjas, dan krijg je zoeklinks naar Zalando, bol.com en Google Shopping. De stylist houdt ook rekening met het weer.
- **Echte kledingstukken bij AI-advies**: met een Claude-sleutel zoekt de app echte stukken op die nu te koop zijn (foto, merk, prijs en link naar de winkel). Dat gebeurt bij de stijltest (elke look met echte voorbeelden), bij de tip van de stylist en, op verzoek, bij wat er op Vandaag ontbreekt.
- **Profielen per persoon**: Dames, Heren en Kinderen, elk met een eigen kast, eigen outfits en een eigen stijlprofiel. Wisselen doe je bovenin, zoals tussen afdelingen in een webwinkel.
- **Stijltest bij de start**: de AI stelt een visuele test samen die past bij de persoon (afdeling, leeftijd, functie, bedrijf en dresscode). Zonder API-sleutel krijg je een standaardtest. Uit de antwoorden komt een stijlprofiel.
- **Een stylist die leert**: elke keuze telt mee. Duim omhoog of omlaag, opgeslagen en zelf samengestelde outfits, en wat je echt draagt. Dat gaat mee in elk advies, en het stijlprofiel kun je bijwerken met wat de stylist geleerd heeft.
- **Maten en maatadvies**: bij de start (en later onder Profiel) vul je je afmetingen in, met uitleg hoe je meet. Bij elk kledingstuk leg je vast of de maat klein, goed of groot valt. Vóór je bestelt kies je merk en soort, of plak je de productlink: de AI zoekt de maattabel van het merk op en vergelijkt die met je afmetingen en met wat al goed past. Je krijgt een maat met uitleg, zekerheid en alternatief. Bij kinderen vraagt de app na een half jaar om opnieuw te meten.
- **Stijltest per seizoen**: één keer per seizoen, dus maximaal vier keer per jaar, met vragen voor dat seizoen.
- **Werk en vrije tijd**: de stylist kleedt je voor je werk volgens functie, branche en dresscode, of voor vrije tijd, een avond uit, sport, een feest of school.
- **Kast**: kleding en schoenen met foto, merk, maat, kleur en seizoen. Zoeken, filteren en sorteren op meest of minst gedragen.
- **Aankopen**: haalt bestellingen van **Zalando, BestSecret en Otrium** uit Gmail. Een bestelling gaat automatisch naar de juiste persoon als de mail Dames, Heren of Kinderen noemt.
- **Inspiratie van internet** bij elk stuk, met bronlink en passende stukken uit de eigen kast.
- **Outfits**: zelf samenstellen per gelegenheid, of "Verras me" (werkt zonder AI).
- **Profiel**: stijlprofiel, wat de stylist geleerd heeft, statistieken, koppelingen en backup.

## Eenmalig instellen

### 1. App online zetten (GitHub Pages)

1. Ga in GitHub naar **Settings → Pages** en kies bij *Source* voor **GitHub Actions**.
2. Elke push naar `main` publiceert de app op `https://<gebruikersnaam>.github.io/garderobe-app/`.
3. Open die link op je telefoon en kies **Zet op beginscherm**.

### 2. Claude API-sleutel (stylist, inspiratie, mails lezen)

1. Maak een sleutel aan op [platform.claude.com](https://platform.claude.com/settings/keys) en zet er wat tegoed op.
2. Plak hem bij de start in de app, of later onder **Profiel → Koppelingen**.

De sleutel wordt alleen op je apparaat bewaard en alleen naar Claude gestuurd. Gebruik wordt per verzoek afgerekend: het lezen van een bestelmail kost een paar cent, een stylistadvies met foto's iets meer. Zet een maandlimiet in de Claude Console als je zeker wilt zijn.

### 3. Google Client-ID (Gmail-koppeling)

Google vraagt een eigen "app-registratie". Dat is eenmalig en gratis:

1. Ga naar [console.cloud.google.com](https://console.cloud.google.com) en maak een nieuw project aan, bijvoorbeeld "Garderobe".
2. Kies **APIs & Services → Library**, zoek **Gmail API** en klik **Enable**.
3. Kies **APIs & Services → OAuth consent screen** (of *Google Auth Platform*):
   - User type: **External**, app-naam "Garderobe", je eigen e-mailadres als contact.
   - Bij **Data access / Scopes**: voeg `https://www.googleapis.com/auth/gmail.readonly` toe.
   - Bij **Audience / Test users**: voeg je eigen Gmail-adres toe. De app blijft in *Testing*, dus alleen jij kunt inloggen.
4. Kies **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type: **Web application**.
   - Authorized JavaScript origins: `https://<gebruikersnaam>.github.io`, en voor ontwikkelen ook `http://localhost:5173`.
5. Kopieer de **Client ID** (eindigt op `.apps.googleusercontent.com`) en plak hem in de app onder **Profiel → Koppelingen**.
   Je kunt hem ook als repository-variabele `GOOGLE_CLIENT_ID` instellen (Settings → Secrets and variables → Actions → Variables). Dan staat hij standaard ingevuld.

Bij de eerste keer koppelen meldt Google dat de app niet geverifieerd is. Dat klopt, want het is je eigen app. Kies *Doorgaan*. De toegang geldt ongeveer een uur per keer; daarna log je opnieuw in via "Gmail koppelen".

### Waarom geen directe koppeling met Zalando, BestSecret of Otrium?

Die winkels bieden geen koppeling (API) voor klanten. Inloggen met je wachtwoord en hun site uitlezen is tegen hun voorwaarden en gaat bij elke wijziging stuk. De bestelbevestigingen in je mail bevatten dezelfde informatie, dus die gebruikt de app.

## Ontwikkelen

```bash
npm install
npm run dev      # ontwikkelserver op http://localhost:5173
npm run build    # typecheck + productiebuild in dist/
npm run lint
```

## Techniek

React 19 + TypeScript + Vite, [Dexie](https://dexie.org) voor IndexedDB, `vite-plugin-pwa` voor offline gebruik, de Anthropic TypeScript SDK (gestructureerde output, websearch) en Google Identity Services voor Gmail.

| Bestand | Inhoud |
| --- | --- |
| `src/db.ts` | Datamodel (profiel, kledingstuk, outfit, feedback, verwerkte mails) en database |
| `src/quiz.ts` | Standaard-stijltest |
| `src/sizes.ts` | Afmetingen per afdeling, maten per merk |
| `src/learn.ts` | Wat de stylist geleerd heeft, als context voor elk advies |
| `src/profile.ts` | Actief profiel en hooks per profiel |
| `src/ai.ts` | Claude: stijltest, stijlprofiel, stylist, aankopen uit mails, inspiratie |
| `src/gmail.ts` | Gmail-login, bestelmails zoeken en uitlezen |
| `src/settings.ts` | Sleutels en instellingen per apparaat |
| `src/util.ts` | Hulpfuncties, o.a. "Verras me" |
| `src/backup.ts` | Export en import van backups |
| `src/media.ts` | Foto's verkleinen, downloaden en tonen |
| `src/components/` | Schermen: start en stijltest, Kast, Outfits, Stylist, Aankopen, Profiel |
