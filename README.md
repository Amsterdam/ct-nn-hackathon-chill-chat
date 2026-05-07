# UpStand

Bystanders toolkit hackathon prototype — a chat plug-in that empowers kids to flag escalating group dynamics and triggers AI-mediated cooldowns or "Freeze Mode".

## Stack

- **Backend** — FastAPI (Python 3.13), `apps/ai-service/`. Azure OpenAI via `DefaultAzureCredential` (Entra ID token, mirrors brede-welvaart's auth). Single `generate()` function, no LLM abstraction layer.
- **Frontend** — pnpm + Vite + React + TypeScript + Amsterdam Design System, `apps/frontend/`. Custom UpStand brand layered on top of `--ams-*` tokens.

Patterns mirror `ct-brede-welvaart-app` (pnpm monorepo + ADS frontend + Python ai-service), stripped down for hackathon speed. **Hackathon scope: skipped Node Apollo backend, GraphQL codegen, catalog pinning, Helm/AKS plumbing — frontend talks directly to ai-service.**

## Where to drop assets

- **Sticker PNG/SVG** (avatars, emotion blobs) → [apps/frontend/public/stickers/](apps/frontend/public/stickers/)
- **Scenario gradient backgrounds** (freeze-mode mood panels) → [apps/frontend/public/backgrounds/](apps/frontend/public/backgrounds/)
- **Scripted demo conversations as CSVs** → [apps/frontend/public/scenarios/](apps/frontend/public/scenarios/)

Suggested CSV columns: `author,sticker,text,delay_ms` — e.g. `Sam,sam.png,Hé jongens kijk,800`. Reference assets from CSV as `/stickers/sam.png`, `/backgrounds/scenario3.png`.

## Run

### Backend

Requires `az login` first (DefaultAzureCredential picks up your Azure CLI session).

```sh
az login
cd apps/ai-service
cp .env.example .env   # set FOUNDRY_ENDPOINT, FOUNDRY_API_VERSION, LLM_DEPLOYMENT
uv sync
uv run uvicorn src.main:app --reload --port 8000
```

### Frontend

```sh
pnpm install           # from repo root
cd apps/frontend
cp .env.example .env
pnpm dev               # http://localhost:5173
```

## Endpoints

- `POST /api/mediation` — soft popup content (mid-escalation)
- `POST /api/freeze` — freeze-mode summary + redirect prompt
- `GET  /api/health`

## Notes

- Default deployment: `gpt-4o-mini` (override with `LLM_DEPLOYMENT` env var). Use `gpt-4o` for higher-quality freeze content if available in your Foundry.
- Dutch prompts in [apps/ai-service/src/prompts.py](apps/ai-service/src/prompts.py) — validate tone with a native speaker before demo.
- No auth, no persistence, CORS open in dev. Hackathon only.
