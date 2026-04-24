# Challenger Lab

Sistema web de experimentación **Champion & Challenger** para publicidad — originalmente para 121 LATAM. Ejecuta 4 skills orquestados vía Claude API para generar y evaluar challengers creativos a partir de un aviso Champion.

- **Backend:** Railway · Node.js · Express · PostgreSQL
- **Frontend:** Vercel · React · Vite · Tailwind
- **Storage:** Cloudinary
- **AI:** Anthropic Claude (Opus 4.7)

---

## Arquitectura de skills

Cada skill tiene su propio **system prompt** + **modelo** + **hiperparámetros** (max_tokens, temperature) almacenados en la tabla `skill_prompts` y editables por admins desde la UI.

**Estrategia multi-modelo** (~46% de ahorro vs. todo-Opus):

| # | Skill | Modelo default | max_tokens | temperature | Rol |
|---|---|---|---|---|---|
| 1 | Product Insights Analyzer | `claude-sonnet-4-6` | 4096 | 0.75 | Genera 5 ángulos estratégicos |
| 2 | Behavioral Science Optimizer | `claude-haiku-4-5` | 2048 | 0.60 | Aplica nudges a cada ángulo |
| 3 | Ogilvy Creative Execution | `claude-sonnet-4-6` | 6144 | 0.80 | Big Idea + concepto + headline + copy + hashtags |
| 4 | Performance Scorer | `claude-haiku-4-5` | 2048 | 0.30 | Scoring 0-10 y selección del ganador |

Criterio:
- **Sonnet** donde hace falta razonamiento de alto nivel sobre imagen/histórico o redacción creativa.
- **Haiku** para tareas estructuradas y baratas (optimización de ángulos, scoring con temperatura baja).
- **Opus** queda disponible como opción en la UI para casos donde el admin quiera máxima calidad.

Los prompts se cachean con `cache_control: ephemeral` — el system prompt sólo se factura la primera vez de cada ventana de 5 min, reduciendo el costo adicional al mínimo.

---

## Estructura del repo

```
challenger-lab/
├── backend/           # API Express (Railway)
│   ├── src/
│   │   ├── config/    # db, cloudinary, anthropic
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── controllers/
│   │   └── services/
│   ├── migrations/    # SQL schema + seeds
│   └── package.json
├── frontend/          # React + Vite (Vercel)
│   ├── src/
│   └── package.json
└── README.md
```

---

## Setup local

### Requisitos
- Node 20+
- PostgreSQL 15+ (o cuenta Railway)
- Cuenta Cloudinary y Anthropic

### Backend

```bash
cd backend
cp .env.example .env   # completar variables
npm install
npm run migrate        # aplica /migrations/*.sql
npm run dev            # escucha en $PORT (default 3001)
```

### Frontend

```bash
cd frontend
cp .env.example .env   # VITE_API_URL=http://localhost:3001
npm install
npm run dev            # Vite en 5173
```

---

## Variables de entorno

### Backend (`backend/.env`)

| Variable | Descripción |
|---|---|
| `DATABASE_URL` | Cadena de conexión PostgreSQL |
| `JWT_SECRET` | Secreto para firmar tokens JWT |
| `ANTHROPIC_API_KEY` | API key de Claude |
| `CLOUDINARY_CLOUD_NAME` | `dermtudfl` |
| `CLOUDINARY_API_KEY` | API key de Cloudinary |
| `CLOUDINARY_API_SECRET` | API secret de Cloudinary |
| `FRONTEND_URL` | Origen permitido por CORS |
| `PORT` | Puerto (Railway lo inyecta) |

### Frontend (`frontend/.env`)

| Variable | Descripción |
|---|---|
| `VITE_API_URL` | URL base del backend |

---

## Despliegue

- **Backend → Railway:** root `/backend`, variables del cuadro anterior. Railway inyecta `PORT` y corre `npm start`.
- **Frontend → Vercel:** root `/frontend`, build `npm run build`, output `dist`. Variable `VITE_API_URL` apuntando al backend de Railway.

URLs productivas:
- Backend: https://modest-truth-production-a971.up.railway.app
- Frontend: https://challenger-lab.vercel.app

---

## Migraciones

Las migraciones viven en `backend/migrations/` y se aplican en orden alfabético. Ejecutar con:

```bash
cd backend && npm run migrate
```

---

## Roadmap

- [x] **Fase 1** — Estructura base, auth JWT, schema, CRUD, configuración de prompts
- [x] **Fase 2** — Upload Champion a Cloudinary, orquestación de 4 skills con prompt caching, UI de ejecución con polling
- [ ] **Fase 3** — Parser de Excel para histórico, export de resultados, reintentos granulares por skill
- [ ] **Fase 4** — Dashboards, reporting, comparativas históricas

### Endpoints clave (Fase 2)

| Método | Path | Rol | Descripción |
|---|---|---|---|
| POST | `/api/uploads/champion` | admin/analyst | Sube imagen a Cloudinary, devuelve `url` + `public_id` |
| POST | `/api/experiments` | admin/analyst | Crea experimento con `champion_image_url` |
| POST | `/api/experiments/:id/run` | admin/analyst | Dispara orquestación async (fire-and-forget) |
| GET | `/api/experiments/:id` | any | Estado + resultados parciales (polling desde UI) |
| PATCH | `/api/experiments/:id` | admin/analyst | Edita brief/histórico/imagen antes de ejecutar |

### Flujo de orquestación

```
draft → analyzing → optimizing → executing → scoring → completed
                                                     ↘ failed (con error_message)
```

Cada paso persiste su output (`angles`, `optimized_angles`, `executions`, `scores`) en JSONB
del experimento. El frontend hace polling cada 3.5s mientras el status sea running.
