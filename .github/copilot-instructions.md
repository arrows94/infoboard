# Copilot / AI Agent Instructions — Kita-Infotafel

Kurz: dieses Repository ist eine kleine FastAPI-App mit eingebettetem statischem Frontend.
Nutze die Hinweise hier, um schnell produktiv zu werden ohne unnötige Änderungen.

- **Architektur (big picture):**
  - Backend: `backend/main.py` (FastAPI) — liefert API unter `/api/*`, WebSocket unter `/ws`, und mountet statische Dateien unter `/static` sowie Medien unter `/media`.
  - Frontend: `backend/frontend/` — `kiosk.js` = öffentlicher Kiosk-Client, `admin.js` = Admin-UI; `styles.css` enthält Theme-Variablen.
  - Deployment: Docker + `docker-compose.yml` (siehe README.md). Data-Volume: `./data` (konfigurierbar via `DATA_DIR`).

- **Wichtige Lauf- / Entwicklervorgänge:**
  - Lokales Starten (entweder Docker wie README oder direkt):
    - Docker: `docker compose up -d --build` (siehe README.md).
    - Direkt (dev): `uvicorn backend.main:app --host 0.0.0.0 --port 8080 --reload` (abhängig von `backend/requirements.txt`).
  - Admin-Passwort: setze `ADMIN_PASSWORD` in `docker-compose.yml` oder Umgebung; Admin-API erwartet Header `X-Admin-Password` (WebSocket erwartet `x-admin-password`).

- **Datenmodell & Date-Layout (discoverable):**
  - `data/config.json` — zentrale App-Konfiguration (generiert durch `default_config()` in `backend/main.py`).
  - `data/folders.json` — Ordnerliste; `data/index.json` — Bildindex; `data/media/<slug>/` — Bilddateien (.webp + _thumb.webp).
  - Backup: sichere einfach den `data/`-Ordner.

- **API- und Integrations-Punkte (Exemplare):**
  - Public state: `GET /api/state` — liefert `config`, `folders`, `images`, `weather`.
  - Admin: `GET/PUT /api/config`, `GET/POST/DELETE /api/folders`, `POST /api/folders/{id}/images` (multipart `files`), `DELETE /api/folders/{id}/images/{image_id}`.
  - WebSocket: `/ws` — Backend broadcastet `{"type":"refresh"}`; Kiosk reconnect-Logik in `kiosk.js::connectWs()`.

- **Project-specific patterns & conventions:**
  - Config forward-compat: `load_config()` deep-merget mit `default_config()` — Änderungen an Keys sollten kompatibel sein.
  - Carousel folder selection: `config.carousel.folders` ist entweder `"all"` oder ein Array von `folder_id` (siehe `kiosk.js::pickCarouselImages`).
  - Images: Backend konvertiert alles zu WebP, max edge `MAX_IMAGE_EDGE=1920`, thumbs `THUMB_EDGE=480` (siehe Konstanten in `backend/main.py`).
  - Admin client stores pw in LocalStorage key `kita_admin_pw` (siehe `admin.js`).

- **When changing behavior, inspect these hotspots first:**
  - API surface & auth: `backend/main.py` (`ensure_admin`, endpoints)
  - Client rendering logic: `backend/frontend/kiosk.js` (`render`, `buildCarousel`, `buildTextPanel`)
  - Upload/processing: `_resize_and_store`, `_make_thumb` in `backend/main.py`.

- **Code style / quick heuristics for PRs:**
  - Keep changes minimal and backward-compatible with existing JSON config keys.
  - Prefer updating `default_config()` when adding safe defaults, and let `load_config()` merge.
  - When modifying frontend behavior, update `backend/frontend/*` files and test via `uvicorn` or Docker; Kiosk auto-refreshes via WebSocket or poll fallback.

Wenn etwas unklar ist oder du bevorzugte Formulierungen willst, sag kurz Bescheid — ich passe die Datei an.