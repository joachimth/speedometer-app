# Audit: speedometer-app
Dato: 2026-06-02 | Commit: f6d6d28

---

## Status: ✅ Klar til brug (efter denne audit)

Appen havde 4 kritiske bugs der forhindrede den i at virke overhovedet. Alle er rettet.

---

## Kritiske bugs (rettet)

### Bug 1 — App crasher ved klik: `icon-start` / `icon-ok` manglede i HTML
**Fil:** `index.html`

`main.js` refererer til `document.getElementById("icon-start")` og `icon-ok` ved knapklik.
Begge elementer stod som `<!-- SVG-icons her -->` kommentar — aldrig implementeret.
Resulterede i `TypeError: Cannot set properties of null (reading 'style')` ved hvert klik.
Appen startede aldrig.

**Fix:** Tilføjet to `<span>` elementer med ▶ og ✓ Unicode-ikoner.

---

### Bug 2 — `calculateDirection` ikke importeret i `main.js`
**Fil:** `js/main.js`

Funktionen `calculateDirection()` kaldtes på hvert GPS-opdatering men var aldrig importeret fra `helpers.js`.
Resulterede i `ReferenceError: calculateDirection is not defined` på 2. GPS-fix og fremad.
Sideeffekt: `collectedCoordinates.push()` nåede aldrig at køre → koordinater akkumulerede aldrig →
`getSpeedLimit()` og `checkForSpeedCameras()` kaldtes aldrig → hastighedsgrænse vistes altid som "000".

**Fix:** Tilføjet `import { calculateDirection } from './helpers.js';`

---

### Bug 3 — `ROAD_CHECK_THRESHOLD` udefineret i `helpers.js`
**Fil:** `js/helpers.js`

`isConsistentRoadData()` brugte `ROAD_CHECK_THRESHOLD` som om den var en global konstant.
Variablen er kun defineret i `main.js` — ES modules deler ikke scope.
Resulterede i `ReferenceError: ROAD_CHECK_THRESHOLD is not defined` hver gang funktionen kaldtes.

**Fix:** Omdefineret som parameter med default: `isConsistentRoadData(roadHistory, threshold = 3)`

---

### Bug 4 — `lon` vs `lng` i `speedcamera.js`
**Fil:** `js/speedcamera.js`

Koordinat-arrays bruger `{lat, lng}` overalt i kodebasen.
`speedcamera.js` destructurerede `const { lat, lon } = coordinates[0]` — `lon` er altid `undefined`.
Afstandsberegningen til fartkameraer var altid forkert (NaN).

**Fix:** Rettet til `const { lat, lng } = coordinates[0]`

---

## Mindre fixes

| # | Problem | Fil | Fix |
|---|---------|-----|-----|
| 5 | Dobbelt `<meta name="viewport">` | `index.html` | Fjernet det første (overflødige) |
| 6 | `app.js` var død kode — `index.html` loader kun `main.js` | `js/app.js` | Slettet |
| 7 | CI deployede ved push til alle branches | `.github/workflows/deploy.yml` | Begrænset til `main` |
| 8 | `actions/checkout@v3` forældet | `.github/workflows/deploy.yml` | Opgraderet til `@v4` |
| 9 | Ingen `.gitignore` | — | Tilføjet |
| 10 | README beskrev kun hastighedsmåler, ikke speed limit / fartkameraer | `README.md` | Omskrevet |

---

## Arkitektur-noter (ikke rettet, men værd at vide)

**`axios` via CDN uden import:** `speedlimit.js` og `speedcamera.js` bruger `axios` som global (CDN-injiceret i index.html). Virker, men hvis CDN-URL ændres crasher appen stille. Alternativ: brug native `fetch()` og fjern CDN-afhængighed.

**Traffic alerts (`trafikinfo.js`):** Hele filen er kommenteret ud — kræver `trafikalarm.dk` API-nøgle. `YOUR_AUTH_TOKEN` placeholder sidder stadig i den udkommenterede kode. Hvis du nogensinde aktiverer denne feature, skal token håndteres via miljøvariabel / build-step, ikke hardcoded.

**Wake lock:** README hævdede tidligere "Keeps the screen on at all times" — ingen `navigator.wakeLock` er implementeret. Fjernet fra README.

---

## Hvad der er tilbage til dig

- **Manuel test i browser:** Åbn på telefon, tillad lokation, verificer at hastighedsgrænse vises korrekt
- **Traffic alerts:** Kræver `trafikalarm.dk` API-nøgle hvis du vil aktivere den feature
- **Wake Lock:** Hvis "skærm forbliver tændt" er vigtigt, skal `navigator.wakeLock.request('screen')` implementeres
