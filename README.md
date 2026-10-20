# Garderobe

Een web-app (PWA) voor je persoonlijke kledingkast: kleding en schoenen vastleggen met foto, online aankopen automatisch binnenhalen uit Gmail, outfits samenstellen met een AI-stylist en inspiratie van internet zoeken voor stukken die je al hebt.

Je kast staat lokaal op je apparaat (IndexedDB). Er is geen eigen server: de app praat rechtstreeks met Gmail (alleen-lezen) en met Claude, met jouw eigen sleutels.

## Functies

- **Kast**: kledingstukken met foto, categorie (ook schoenen en accessoires), kleur, seizoen, merk en notities. Zoeken en filteren.
- **Aankopen**: zoekt in Gmail naar bestelbevestigingen van **Zalando, BestSecret en Otrium**. Claude haalt per mail de gekochte stukken eruit (naam, merk, categorie, kleur, maat, prijs, productfoto) en jij kiest wat in je kast komt. Mails die al bekeken zijn, worden overgeslagen.
- **Stylist**: Claude bekijkt de foto's in je kast en stelt 3 outfits voor per seizoen en gelegenheid, eventueel vooral met je online aankopen. Een outfit sla je met één tik op.
- **Inspiratie van internet** (bij elk kledingstuk): Claude zoekt online naar looks met dat stuk, met een link naar de bron, en wijst aan welke stukken uit je eigen kast erbij passen.
- **Outfits**: zelf samenstellen of laten voorstellen ("Verras me", werkt zonder AI).
- **Draaggedrag**: "Vandaag gedragen" telt per stuk hoe vaak en wanneer je het droeg.
- **Meer**: statistieken, koppelingen, backup downloaden en terugzetten (inclusief foto's).

## Eenmalig instellen

### 1. App online zetten (GitHub Pages)

1. Ga in GitHub naar **Settings → Pages** en kies bij *Source* voor **GitHub Actions**.
2. Elke push naar `main` publiceert de app op `https://<gebruikersnaam>.github.io/garderobe-app/`.
3. Open die link op je telefoon en kies **Zet op beginscherm**.

### 2. Claude API-sleutel (stylist, inspiratie, mails lezen)

1. Maak een sleutel aan op [platform.claude.com](https://platform.claude.com/settings/keys) en zet er wat tegoed op.
2. Plak hem in de app onder **Meer → Koppelingen**.

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
5. Kopieer de **Client ID** (eindigt op `.apps.googleusercontent.com`) en plak hem in de app onder **Meer → Koppelingen**.
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
| `src/db.ts` | Datamodel (kledingstuk, outfit, verwerkte mails) en database |
| `src/ai.ts` | Claude: aankopen uit mails halen, stylist, inspiratie zoeken |
| `src/gmail.ts` | Gmail-login, bestelmails zoeken en uitlezen |
| `src/settings.ts` | Sleutels en instellingen per apparaat |
| `src/util.ts` | Hulpfuncties, o.a. "Verras me" |
| `src/backup.ts` | Export en import van backups |
| `src/media.ts` | Foto's verkleinen, downloaden en tonen |
| `src/components/` | Schermen: Kast, Outfits, Stylist, Aankopen, Meer |
