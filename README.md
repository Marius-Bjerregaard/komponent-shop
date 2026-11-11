# Komponent-bibliotek

Søgbart bibliotek over komponenterne i reolerne, delt i **serier** → **funktioner**. Kan lægges på hjemskærmen på iPhone/iPad (Del → Føj til hjemmeskærm).

## Kør i Dockge
1. Push repo til GitHub → Actions bygger `ghcr.io/<bruger>/komponent-shop:latest` (sæt pakken til *public* under GitHub → Packages, eller log Docker ind på ghcr).
2. Dockge → **+ Compose** → indsæt `compose.yaml`, ret `OWNER` og `API_TOKEN` → Deploy.
3. Opdatering: tryk **Update** i Dockge (henter nyt image). Data ligger i volumen `komponent-data` og bevares.

## Tilføj komponenter uden at opdatere siden (MCP)
Endpoint: `http://<server>:3000/mcp` (Streamable HTTP), header `Authorization: Bearer <API_TOKEN>`.

```bash
claude mcp add --transport http komponenter http://SERVER:3000/mcp --header "Authorization: Bearer DIN_TOKEN"
```
Værktøjer: `search_components`, `list_series`, `add_component`, `add_components`, `update_component`, `delete_component`, `add_series`, `list_shelves`.

REST: `GET /api/components?q=&series=&function=`, `POST/PATCH/DELETE` kræver token.

## Reolbilleder
Billederne i `billeder/` hedder `NN - Indhold.heic`. Ret `00` til reolens nummer, kør `./sync-billeder.sh`, commit og push.
