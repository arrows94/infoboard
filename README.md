
# Kita-Infotafel (Docker)

Eine moderne, performante Infotafel für einen Kindergarten – optimiert für einen TV im Chromium Kiosk Mode (z.B. Raspberry Pi).

**Features**
- Kiosk-Seite: Bildkarussell **oder** Textfeld (Markdown)
- Info-Spalte: Wetter (Open‑Meteo), Betreuungsampel, eigene Info-Box
- Optionaler Liveticker unten (Scrolling)
- Admin-Seite: Themes, Layout-Toggles, Inhalte, Ordner & Bilder verwalten
- Upload: automatische Verkleinerung + Konvertierung zu WebP (spart Speicher)
- Auto-Refresh der Kiosk-Seite via WebSocket (plus Poll-Fallback)

---

## Start

1) Repo/Ordner holen und in das Projektverzeichnis wechseln.

2) Admin-Passwort setzen (wichtig!):
- In `docker-compose.yml` `ADMIN_PASSWORD` ändern.

3) Starten:
```bash
docker compose up -d --build
```

4) Öffnen:
- Kiosk: `http://<SERVER-IP>:8080/`
- Admin: `http://<SERVER-IP>:8080/admin`

---

## Raspberry Pi Kiosk (Chromium)

Beispiel:
```bash
chromium-browser --kiosk --incognito --noerrdialogs --disable-infobars http://<SERVER-IP>:8080/
```

Tipp: Bildschirm-Timeout/Blanking auf dem Pi deaktivieren.

---

## Datenhaltung / Backup

Alles liegt im gemounteten Ordner `./data`:
- `data/config.json` – Einstellungen/Inhalte
- `data/folders.json` – Ordnerliste
- `data/index.json` – Bildindex
- `data/media/...` – Bilder (WebP + Thumbs)

Backup = einfach den `data/` Ordner sichern.

---

## Sicherheit (minimal, aber besser als nix)

Die Admin-API erwartet den Header `X-Admin-Password`.
Die Admin-Seite speichert das Passwort im Browser (LocalStorage) – daher bitte nur auf vertrauenswürdigen Geräten nutzen.

Für mehr Sicherheit:
- Reverse Proxy mit Basic Auth / VPN im LAN
- Oder Admin nur intern erreichbar machen.

---

## Anpassungen

- Themes: in `backend/frontend/styles.css` (CSS-Variablen)
- Layout/JS: `backend/frontend/kiosk.js`
- API/Backend: `backend/main.py`
