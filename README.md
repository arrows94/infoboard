
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

## Widgets & Features im Detail

Die Kiosk-Ansicht ist in drei Hauptbereiche unterteilt:

### 1. Hauptbereich (Main Area)
Der Hauptbereich nimmt den größten Teil des Bildschirms ein und kann in einem von zwei Modi betrieben werden:
- **Bildkarussell (Carousel Mode):** Zeigt eine automatisch ablaufende Diashow aus hochgeladenen Bildern und Videos.
  - **Funktionen:** Einstellbares Intervall, zufällige Wiedergabe (Shuffle) und rekursives Scheduling für Medien mit unterschiedlichen Längen (z.B. Videos). Bilder werden aus Leistungsgründen statisch ohne aufwendige CSS-Übergänge gerendert.
  - **Medien:** Unterstützt `.mp4`, `.webm`, `.mov` für Videos (nativ gespeichert) sowie gängige Bildformate (werden beim Upload automatisch verkleinert und platzsparend ins WebP-Format konvertiert).
- **Textfeld (Text Panel Mode):** Eine statische, durch Markdown formatierbare Textfläche, ideal für Willkommensnachrichten oder allgemeine, dauerhafte Ankündigungen.

### 2. Info-Spalte (Sidebar)
Auf der rechten Seite befindet sich eine optionale Informationsspalte, die verschiedene Widgets enthalten kann:
- **Wetter (Weather Widget):** Zeigt das aktuelle Wetter sowie eine 3-Tage-Vorschau an. Die Daten stammen kostenfrei und ohne API-Key von Open-Meteo. Der Standort (Koordinaten) kann in den Einstellungen angepasst werden.
- **Betreuungsampel (Care Status Traffic Light):** Ein visuelles Signal (Grün, Gelb, Rot) mit anpassbarem Text, um Eltern sofort über die aktuelle Betreuungssituation (z.B. Normalbetrieb, Notbetreuung, Engpass) zu informieren.
- **Termine (Events List):** Eine Liste mit den nächsten anstehenden Terminen (z.B. Weihnachtsfeier, Schließtage).
- **Eigene Info-Boxen (Custom Info Boxes):** Beliebig viele zusätzliche Textboxen, die Markdown unterstützen. Nützlich für spezifische Hinweise oder Erinnerungen.

### 3. Liveticker (Footer)
Am unteren Bildschirmrand kann optional ein Laufband (Scrolling Ticker) aktiviert werden.
- **Funktion:** Ideal für sehr dringende oder kurze Nachrichten (z.B. "Bitte Hausschuhe beschriften!"). Die Geschwindigkeit des Laufbands ist einstellbar.

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
