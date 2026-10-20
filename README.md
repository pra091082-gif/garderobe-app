# Garderobe

Een web-app (PWA) voor je persoonlijke kledingkast: kleding vastleggen met foto, outfits samenstellen en bijhouden wat je draagt. Alle gegevens blijven lokaal op je apparaat (IndexedDB); er is geen account of server nodig.

## Functies

- **Kast** – kledingstukken met foto, categorie, kleur(en), seizoen, merk en notities. Zoeken en filteren op categorie, seizoen, kleur en favorieten.
- **Outfits** – stukken combineren tot outfits, met een collage-weergave. "Verras me" stelt een passende combinatie voor op basis van het seizoen.
- **Draaggedrag** – "Vandaag gedragen" telt per stuk hoe vaak en wanneer je het droeg.
- **Meer** – overzicht (aantallen per categorie, meest/nooit gedragen), backup downloaden/terugzetten als JSON (inclusief foto's) en alles wissen.
- **Installeerbaar** – werkt offline en kan via "Zet op beginscherm" als app op je telefoon.

## Ontwikkelen

```bash
npm install
npm run dev      # ontwikkelserver
npm run build    # typecheck + productiebuild in dist/
npm run preview  # productiebuild lokaal bekijken
npm run lint
```

## Techniek

React 19 + TypeScript + Vite, [Dexie](https://dexie.org) voor IndexedDB, `vite-plugin-pwa` voor manifest en service worker. Foto's worden bij het toevoegen verkleind (max. 900 px) om opslag te sparen.

| Bestand | Inhoud |
| --- | --- |
| `src/db.ts` | Datamodel (kledingstuk, outfit), categorieën, kleuren, database |
| `src/util.ts` | Hulpfuncties, o.a. de outfit-suggestie |
| `src/backup.ts` | Export/import van backups |
| `src/media.ts` | Foto's verkleinen en tonen |
| `src/components/` | Schermen: Kast, Outfits, Meer en de formulieren |
