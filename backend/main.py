
from __future__ import annotations

import asyncio
import json
import os
import re
import shutil
import time
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple
from PIL import Image, ImageOps

import httpx
from fastapi import (
    FastAPI, File, HTTPException, Request, UploadFile, WebSocket, WebSocketDisconnect
)
from fastapi.responses import FileResponse, HTMLResponse, Response
from fastapi.staticfiles import StaticFiles
from PIL import Image

APP_NAME = "Kita-Infotafel"
DATA_DIR = Path(os.environ.get("DATA_DIR", "/data")).resolve()
MEDIA_DIR = DATA_DIR / "media"
CONFIG_PATH = DATA_DIR / "config.json"
FOLDERS_PATH = DATA_DIR / "folders.json"
INDEX_PATH = DATA_DIR / "index.json"

ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "change-me")

DEFAULT_CITY = os.environ.get("DEFAULT_CITY", "Eichsfeld")
DEFAULT_LAT = float(os.environ.get("DEFAULT_LAT", "51.3"))
DEFAULT_LON = float(os.environ.get("DEFAULT_LON", "10.3"))

MAX_UPLOAD_FILES = 30
MAX_UPLOAD_MB_PER_FILE = 25  # client side should keep it reasonable

# Resize targets
MAX_IMAGE_EDGE = 1920
THUMB_EDGE = 480
OUTPUT_FORMAT = "WEBP"  # Chromium supports WebP well (size win)
OUTPUT_QUALITY = 85

# ---- Utilities ----

def _atomic_write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(path)

def _load_json(path: Path, default: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return default
    except json.JSONDecodeError:
        # if corrupted, keep a backup and reset
        bak = path.with_suffix(path.suffix + ".corrupt")
        try:
            shutil.copy2(path, bak)
        except Exception:
            pass
        return default

_slug_rx = re.compile(r"[^a-z0-9\-]+")

def slugify(name: str) -> str:
    s = name.strip().lower()
    s = s.replace("ä", "ae").replace("ö", "oe").replace("ü", "ue").replace("ß", "ss")
    s = re.sub(r"\s+", "-", s)
    s = _slug_rx.sub("", s)
    s = re.sub(r"\-+", "-", s).strip("-")
    return s or "ordner"

def ensure_admin(request: Request) -> None:
    pw = request.headers.get("X-Admin-Password", "")
    if pw != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Unauthorized")

def ensure_admin_ws(ws: WebSocket) -> None:
    pw = ws.headers.get("x-admin-password", "")
    if pw != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Unauthorized")

def now_iso() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%S%z")

def safe_filename(original: str) -> str:
    # keep only safe ascii-ish stuff
    base = Path(original).name
    base = re.sub(r"[^A-Za-z0-9\.\-\_]+", "_", base)
    if len(base) > 120:
        stem, suf = os.path.splitext(base)
        base = stem[:100] + suf
    return base or "upload"

# ---- Data model (JSON files) ----

def default_config() -> Dict[str, Any]:
    return {
        "theme": "mint",
        "layout": {
            "show_info_column": True,
            "show_ticker": True,
            "mode": "carousel",  # carousel | text
        },
        "carousel": {
            "interval_sec": 10,
            "folders": "all",  # "all" or [folder_id,...]
            "shuffle": True,
        },
        "text_panel": {
            "title": "Willkommen!",
            "markdown": "### Kita-Infotafel\n\n- Infos für Eltern\n- Wetter & Ampel\n- Bilder & Erinnerungen\n",
        },
        "info_boxes": {
            "weather_enabled": True,
            "weather": {
                "city": DEFAULT_CITY,
                "lat": DEFAULT_LAT,
                "lon": DEFAULT_LON,
                "units": "metric",
            },
            # EVENTS
        "events": {
            "enabled": True,
            "title": "Nächste Termine",
            "items": [
                "24.12.2026 Weihnachtsfeier",
                "01.01.2027 Neujahr"
            ]
        },
        # --------------------
            "ampel": {
                "status": "green",  # green | yellow | red
                "label": "Betreuung normal",
                "details": "Alles wie geplant.",
            },
            "custom": [
                {
                    "title": "Hinweis",
                    "markdown": "Bitte morgens bis **09:00** Uhr ankommen.",
                    "enabled": True,
                }
            ],
        },
        "ticker": {
            "enabled": True,
            "speed": 70,  # px/sec
            "items": [
                "Heute: Turnhalle für die Sternchen-Gruppe",
                "Bitte Hausschuhe beschriften",
                "Nächste Woche: Fototag",
            ],
        },
        "autorefresh": {
            "poll_fallback_sec": 30
        }
    }

def default_folders() -> Dict[str, Any]:
    return {
        "folders": []
    }

def default_index() -> Dict[str, Any]:
    # folder_id -> list of images
    return {
        "images": {}
    }

def load_config() -> Dict[str, Any]:
    cfg = _load_json(CONFIG_PATH, default_config())
    # merge missing keys (simple forward-compat)
    def deep_merge(dst: Dict[str, Any], src: Dict[str, Any]) -> Dict[str, Any]:
        for k, v in src.items():
            if k not in dst:
                dst[k] = v
            elif isinstance(v, dict) and isinstance(dst.get(k), dict):
                deep_merge(dst[k], v)
        return dst
    return deep_merge(cfg, default_config())

def save_config(cfg: Dict[str, Any]) -> None:
    _atomic_write_json(CONFIG_PATH, cfg)

def load_folders() -> Dict[str, Any]:
    return _load_json(FOLDERS_PATH, default_folders())

def save_folders(data: Dict[str, Any]) -> None:
    _atomic_write_json(FOLDERS_PATH, data)

def load_index() -> Dict[str, Any]:
    return _load_json(INDEX_PATH, default_index())

def save_index(data: Dict[str, Any]) -> None:
    _atomic_write_json(INDEX_PATH, data)

# ---- WebSocket broadcast ----

class Hub:
    def __init__(self) -> None:
        self._queues: Dict[WebSocket, asyncio.Queue] = {}
        self._lock = asyncio.Lock()

    async def connect(self, ws: WebSocket) -> asyncio.Queue:
        await ws.accept()
        q: asyncio.Queue = asyncio.Queue(maxsize=20)
        async with self._lock:
            self._queues[ws] = q
        return q

    async def disconnect(self, ws: WebSocket) -> None:
        async with self._lock:
            self._queues.pop(ws, None)

    async def broadcast(self, msg: Dict[str, Any]) -> None:
        async with self._lock:
            dead: List[WebSocket] = []
            for ws, q in self._queues.items():
                try:
                    if q.full():
                        # drop one to keep freshest updates
                        _ = q.get_nowait()
                    q.put_nowait(msg)
                except Exception:
                    dead.append(ws)
            for ws in dead:
                self._queues.pop(ws, None)

hub = Hub()

# ---- Weather cache ----


@dataclass
class WeatherCache:
    ts: float = 0.0
    payload: Optional[Dict[str, Any]] = None

weather_cache = WeatherCache()

async def fetch_weather(lat: float, lon: float, units: str = "metric") -> Dict[str, Any]:
    # Open-Meteo: no key required
    # docs: https://open-meteo.com/
    temp_unit = "celsius" if units == "metric" else "fahrenheit"
    wind_unit = "kmh" if units == "metric" else "mph"
    params = {
        "latitude": lat,
        "longitude": lon,
        "current": "temperature_2m,apparent_temperature,is_day,weather_code,wind_speed_10m",
        "daily": "temperature_2m_max,temperature_2m_min,weather_code",
        "timezone": "auto",
        "temperature_unit": temp_unit,
        "wind_speed_unit": wind_unit,
    }
    url = "https://api.open-meteo.com/v1/forecast"
    async with httpx.AsyncClient(timeout=8.0) as client:
        r = await client.get(url, params=params)
        r.raise_for_status()
        data = r.json()

    # minimal normalization for frontend
    current = data.get("current", {})
    daily = data.get("daily", {})
    out = {
        "fetched_at": now_iso(),
        "current": {
            "temp": current.get("temperature_2m"),
            "feels": current.get("apparent_temperature"),
            "wind": current.get("wind_speed_10m"),
            "code": current.get("weather_code"),
            "is_day": current.get("is_day"),
        },
        "daily": []
    }
    times = daily.get("time", []) or []
    tmax = daily.get("temperature_2m_max", []) or []
    tmin = daily.get("temperature_2m_min", []) or []
    codes = daily.get("weather_code", []) or []
    for i in range(min(3, len(times))):
        out["daily"].append({
            "date": times[i],
            "tmax": tmax[i] if i < len(tmax) else None,
            "tmin": tmin[i] if i < len(tmin) else None,
            "code": codes[i] if i < len(codes) else None,
        })
    return out

async def get_weather_cached(cfg: Dict[str, Any]) -> Dict[str, Any]:
    wcfg = cfg.get("info_boxes", {}).get("weather", {})
    lat = float(wcfg.get("lat", DEFAULT_LAT))
    lon = float(wcfg.get("lon", DEFAULT_LON))
    units = wcfg.get("units", "metric")
    now = time.time()
    # refresh every 30 minutes
    if weather_cache.payload is None or (now - weather_cache.ts) > 1800:
        try:
            weather_cache.payload = await fetch_weather(lat, lon, units)
            weather_cache.ts = now
        except Exception as e:
            # keep last payload; surface error info
            if weather_cache.payload is None:
                weather_cache.payload = {"error": str(e), "fetched_at": now_iso(), "current": None, "daily": []}
    return weather_cache.payload

# ---- Images ----

def _ensure_data_dirs() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    MEDIA_DIR.mkdir(parents=True, exist_ok=True)

def _find_folder(folder_id: str) -> Dict[str, Any]:
    folders = load_folders().get("folders", [])
    for f in folders:
        if f.get("id") == folder_id:
            return f
    raise HTTPException(status_code=404, detail="Folder not found")

def _folder_path(folder: Dict[str, Any]) -> Path:
    return MEDIA_DIR / folder["slug"]

def _image_list_for(folder_id: str) -> List[Dict[str, Any]]:
    idx = load_index()
    return idx.get("images", {}).get(folder_id, []) or []

def _save_image_list_for(folder_id: str, images: List[Dict[str, Any]]) -> None:
    idx = load_index()
    idx.setdefault("images", {})
    idx["images"][folder_id] = images
    save_index(idx)

def _resize_and_store(src_path: Path, dst_path: Path) -> Tuple[int, int]:
    with Image.open(src_path) as im:
        im = ImageOps.exif_transpose(im)
        im = im.convert("RGB")
        w, h = im.size
        scale = min(1.0, float(MAX_IMAGE_EDGE) / max(w, h))
        if scale < 1.0:
            im = im.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
        dst_path.parent.mkdir(parents=True, exist_ok=True)
        im.save(dst_path, OUTPUT_FORMAT, quality=OUTPUT_QUALITY, method=6)
        return im.size

def _make_thumb(src_path: Path, dst_path: Path) -> None:
    with Image.open(src_path) as im:
        im = ImageOps.exif_transpose(im)
        im = im.convert("RGB")
        w, h = im.size
        scale = min(1.0, float(THUMB_EDGE) / max(w, h))
        if scale < 1.0:
            im = im.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
        dst_path.parent.mkdir(parents=True, exist_ok=True)
        im.save(dst_path, OUTPUT_FORMAT, quality=78, method=6)

# ---- App ----

app = FastAPI(title=APP_NAME)

# Mount static frontend
FRONTEND_DIR = Path(__file__).parent / "frontend"
app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")

# Mount /media
_ensure_data_dirs()
app.mount("/media", StaticFiles(directory=str(MEDIA_DIR)), name="media")


@app.get("/", response_class=HTMLResponse)
def kiosk_index() -> str:
    return (FRONTEND_DIR / "index.html").read_text(encoding="utf-8")

@app.get("/admin", response_class=HTMLResponse)
def admin_index() -> str:
    return (FRONTEND_DIR / "admin.html").read_text(encoding="utf-8")

@app.get("/healthz")
def healthz() -> Dict[str, str]:
    return {"status": "ok"}

# ---- Public API for kiosk ----

@app.get("/api/state")
async def api_state() -> Dict[str, Any]:
    cfg = load_config()
    folders = load_folders().get("folders", [])
    idx = load_index().get("images", {})
    weather = None
    if cfg.get("info_boxes", {}).get("weather_enabled", True):
        weather = await get_weather_cached(cfg)
    return {
        "config": cfg,
        "folders": folders,
        "images": idx,
        "weather": weather,
        "server_time": now_iso(),
    }

@app.get("/api/weather")
async def api_weather() -> Dict[str, Any]:
    cfg = load_config()
    return await get_weather_cached(cfg)

# ---- Admin API ----

@app.get("/api/config")
def get_config(request: Request) -> Dict[str, Any]:
    ensure_admin(request)
    return load_config()

@app.put("/api/config")
async def put_config(request: Request) -> Dict[str, Any]:
    ensure_admin(request)
    payload = await request.json()
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="config must be an object")
    cfg = load_config()
    # allow overwrite of known top-level keys only to keep it safer
    for key in ["theme","layout","carousel","text_panel","info_boxes","ticker","autorefresh","events"]:
        if key in payload:
            cfg[key] = payload[key]
    save_config(cfg)
    await hub.broadcast({"type": "refresh", "reason": "config"})
    return {"ok": True, "config": cfg}

@app.get("/api/folders")
def list_folders(request: Request) -> Dict[str, Any]:
    ensure_admin(request)
    return load_folders()

@app.post("/api/folders")
async def create_folder(request: Request) -> Dict[str, Any]:
    ensure_admin(request)
    data = await request.json()
    name = str(data.get("name", "")).strip()
    if not name:
        raise HTTPException(status_code=400, detail="name required")
    folders_data = load_folders()
    folders = folders_data.get("folders", [])
    # unique slug
    slug = slugify(name)
    used = {f["slug"] for f in folders}
    base_slug = slug
    i = 2
    while slug in used:
        slug = f"{base_slug}-{i}"
        i += 1
    folder_id = uuid.uuid4().hex
    folder = {"id": folder_id, "name": name, "slug": slug, "created_at": now_iso()}
    folders.append(folder)
    folders_data["folders"] = folders
    save_folders(folders_data)
    _folder_path(folder).mkdir(parents=True, exist_ok=True)
    # init index
    _save_image_list_for(folder_id, [])
    await hub.broadcast({"type": "refresh", "reason": "folders"})
    return {"ok": True, "folder": folder}

@app.delete("/api/folders/{folder_id}")
async def delete_folder(folder_id: str, request: Request) -> Dict[str, Any]:
    ensure_admin(request)
    folders_data = load_folders()
    folders = folders_data.get("folders", [])
    folder = None
    for f in folders:
        if f["id"] == folder_id:
            folder = f
            break
    if folder is None:
        raise HTTPException(status_code=404, detail="Folder not found")
    # delete media directory
    try:
        shutil.rmtree(_folder_path(folder), ignore_errors=True)
    except Exception:
        pass
    # remove from folders
    folders = [f for f in folders if f["id"] != folder_id]
    folders_data["folders"] = folders
    save_folders(folders_data)
    # remove index
    idx = load_index()
    idx.get("images", {}).pop(folder_id, None)
    save_index(idx)
    await hub.broadcast({"type": "refresh", "reason": "folders"})
    return {"ok": True}

@app.get("/api/folders/{folder_id}/images")
def list_images(folder_id: str, request: Request) -> Dict[str, Any]:
    ensure_admin(request)
    _find_folder(folder_id)
    return {"images": _image_list_for(folder_id)}

@app.post("/api/folders/{folder_id}/images")
async def upload_images(folder_id: str, request: Request, files: List[UploadFile] = File(...)) -> Dict[str, Any]:
    ensure_admin(request)
    folder = _find_folder(folder_id)
    if len(files) > MAX_UPLOAD_FILES:
        raise HTTPException(status_code=400, detail=f"too many files (max {MAX_UPLOAD_FILES})")

    folder_dir = _folder_path(folder)
    folder_dir.mkdir(parents=True, exist_ok=True)

    images = _image_list_for(folder_id)
    added: List[Dict[str, Any]] = []

    for up in files:
        # quick size guard (best-effort; content-length not always provided)
        contents = await up.read()
        if len(contents) > MAX_UPLOAD_MB_PER_FILE * 1024 * 1024:
            continue

        orig_name = safe_filename(up.filename or "upload")
        tmp_path = DATA_DIR / "tmp_upload"
        tmp_path.mkdir(parents=True, exist_ok=True)
        tmp_file = tmp_path / f"{uuid.uuid4().hex}_{orig_name}"
        tmp_file.write_bytes(contents)

        img_id = uuid.uuid4().hex
        filename = f"{img_id.lower()}.webp"
        dst = folder_dir / filename
        thumb = folder_dir / f"{img_id.lower()}_thumb.webp"

        try:
            w, h = _resize_and_store(tmp_file, dst)
            _make_thumb(tmp_file, thumb)
        except Exception:
            # not an image or corrupted
            try:
                tmp_file.unlink(missing_ok=True)
            except Exception:
                pass
            continue
        finally:
            try:
                tmp_file.unlink(missing_ok=True)
            except Exception:
                pass

        meta = {
            "id": img_id,
            "filename": filename,
            "thumb": f"{img_id.lower()}_thumb.webp",
            "original_name": orig_name,
            "uploaded_at": now_iso(),
            "width": w,
            "height": h,
        }
        images.append(meta)
        added.append(meta)

    _save_image_list_for(folder_id, images)
    await hub.broadcast({"type": "refresh", "reason": "images"})
    return {"ok": True, "added": added}

@app.delete("/api/folders/{folder_id}/images/{image_id}")
async def delete_image(folder_id: str, image_id: str, request: Request) -> Dict[str, Any]:
    ensure_admin(request)
    folder = _find_folder(folder_id)
    folder_dir = _folder_path(folder)

    images = _image_list_for(folder_id)
    keep: List[Dict[str, Any]] = []
    removed = None
    for im in images:
        if im.get("id") == image_id:
            removed = im
        else:
            keep.append(im)

    if removed is None:
        raise HTTPException(status_code=404, detail="Image not found")

    # delete files
    try:
        (folder_dir / removed["filename"]).unlink(missing_ok=True)
        (folder_dir / removed.get("thumb","")).unlink(missing_ok=True)
    except Exception:
        pass

    _save_image_list_for(folder_id, keep)
    await hub.broadcast({"type": "refresh", "reason": "images"})
    return {"ok": True}

# ---- WebSocket ----

@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket):
    q = await hub.connect(ws)
    try:
        while True:
            # Wait for either: a broadcast message OR any client message (for keepalive / disconnect detection)
            t_queue = asyncio.create_task(q.get())
            t_recv = asyncio.create_task(ws.receive_text())
            done, pending = await asyncio.wait({t_queue, t_recv}, return_when=asyncio.FIRST_COMPLETED)

            for t in pending:
                t.cancel()

            if t_queue in done:
                msg = t_queue.result()
                await ws.send_json(msg)
                continue

            if t_recv in done:
                text = (t_recv.result() or "").strip().lower()
                if text == "ping":
                    await ws.send_text("pong")
                # ignore anything else
    except WebSocketDisconnect:
        await hub.disconnect(ws)
    except Exception:
        await hub.disconnect(ws)
