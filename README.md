# Komponent-bibliotek

Søgbart bibliotek over komponenterne i reolerne, delt i **serier** → **funktioner**. Kan lægges på hjemskærmen på iPhone/iPad (Del → Føj til hjemmeskærm).

## Kør på Cloudflare (anbefalet)
Siden, REST-API'et og MCP-serveren kører som én Cloudflare Worker (`src/worker.js`). Databasen ligger i et Durable Object med egen SQLite, og der er ingen hjemmeserver eller tunnel. Gratis-planen er nok.

Første gang:
1. Opret en gratis konto på cloudflare.com.
2. `npm install`, derefter `npx wrangler login` (åbner browseren).
3. `npm run deploy`. Første gang skal du vælge et `workers.dev`-subdomæne. Adressen bliver `https://komponent-shop.<subdomæne>.workers.dev`.
4. `npx wrangler secret put API_TOKEN` og indsæt en lang hemmelig streng (fx fra `openssl rand -hex 32`). Uden token er alt, der skriver, låst.
5. Flyt data fra hjemmeserveren: `API_TOKEN=<token> npm run flyt-data -- <gammel-url> <ny-url>`. `<gammel-url>` kan også være en `db.json`-fil (`docker cp komponenter:/data/db.json .`). Den nye database overskrives, den gamle røres ikke.
6. Peg Claude på den nye MCP (se nedenfor) og sluk derefter stakken i Dockge og tunnelen.

Opdatering: `npm run deploy`, eller forbind repoet under Cloudflare → Workers → komponent-shop → Settings → Builds, så deployes `main` automatisk ved push. Data bevares ved deploy.

Backup: `curl -H "Authorization: Bearer <token>" <url>/api/export > backup.json`. Gendan med `npm run flyt-data -- backup.json <url>`.

Lokalt: læg `API_TOKEN=noget` i `.dev.vars` og kør `npm run dev` (http://localhost:8787).

## Kør i Dockge
1. Push repo til GitHub → Actions bygger `ghcr.io/<bruger>/komponent-shop:latest` (sæt pakken til *public* under GitHub → Packages, eller log Docker ind på ghcr).
2. Dockge → **+ Compose** → indsæt `compose.yaml`, ret `OWNER` og `API_TOKEN` → Deploy.
3. Opdatering: tryk **Update** i Dockge (henter nyt image). Data ligger i volumen `komponent-data` og bevares.

## Tilføj komponenter uden at opdatere siden (MCP)
Endpoint: `https://komponent-shop.<subdomæne>.workers.dev/mcp` på Cloudflare, eller `http://<server>:3000/mcp` i Docker (Streamable HTTP), header `Authorization: Bearer <API_TOKEN>`.

```bash
claude mcp add --transport http komponenter https://komponent-shop.SUBDOMÆNE.workers.dev/mcp --header "Authorization: Bearer DIN_TOKEN"
```
Værktøjer: `search_components`, `list_series`, `add_component`, `add_components`, `update_component`, `delete_component`, `add_series`, `list_cabinets`, `get_cabinet`, `set_cabinet`, `list_shelves`.

## Reol-modellen
Forsiden er en virtuel model af væggen. Hver reol (`cabinet`) har en kolonne `x` (0 = længst til venstre), `y` (0 = øverst, 1 = nederst) og et gitter af skuffer. En komponent ligger i `cabinet` + `row` (fra toppen) + `col` (fra venstre), begge 1-baserede. Skuffer uden komponent vises som tomme. Nye reoler oprettes med `set_cabinet`, og komponenter flyttes med `update_component`.

REST: `GET /api/components?q=&series=&function=`, `POST/PATCH/DELETE` kræver token. `GET /api/export` og `PUT /api/import` (hele databasen) kræver også token.

## Kode
`core.js` er al logikken (datamodel, søgning, MCP, REST) og bruges af både `server.js` (Node/Docker) og `src/worker.js` (Cloudflare).

## Reolbilleder
Billederne i `billeder/` hedder `NN - Indhold.heic`. Nummeret følger reolernes rækkefølge (venstre mod højre, øverst før nederst). Ret det efter behov, kør `./sync-billeder.sh`, commit og push (og `npm run deploy`, hvis Cloudflare ikke deployer automatisk).
