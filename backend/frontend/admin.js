
import { markdownToHtml, clamp } from "./utils.js";

let adminPw = localStorage.getItem("kita_admin_pw") || "";
let config = null;
let folders = null;
let imagesIndex = null;

function setTheme(theme){
  document.body.dataset.theme = theme || "mint";
}

function headers(){
  return {
    "Content-Type": "application/json",
    "X-Admin-Password": adminPw,
  };
}

function setAuthStatus(ok){
  const el = document.getElementById("authStatus");
  if (ok){
    el.textContent = "Verbunden";
    el.className = "pill ok";
  } else {
    el.textContent = "Nicht verbunden";
    el.className = "pill warn";
  }
}

async function apiGet(path){
  const r = await fetch(path, { headers: headers(), cache: "no-store" });
  if (!r.ok) throw new Error(`${path} failed: ${r.status}`);
  return await r.json();
}

async function apiPost(path, body){
  const r = await fetch(path, { method:"POST", headers: headers(), body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`${path} failed: ${r.status}`);
  return await r.json();
}

async function apiPut(path, body){
  const r = await fetch(path, { method:"PUT", headers: headers(), body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`${path} failed: ${r.status}`);
  return await r.json();
}

async function apiDelete(path){
  const r = await fetch(path, { method:"DELETE", headers: headers() });
  if (!r.ok) throw new Error(`${path} failed: ${r.status}`);
  return await r.json();
}

function bindConfigToForm(){
  setTheme(config.theme);
  document.getElementById("theme").value = config.theme || "mint";
  document.getElementById("mode").value = config.layout?.mode || "carousel";
  document.getElementById("showInfo").checked = !!config.layout?.show_info_column;
  document.getElementById("showTicker").checked = !!config.layout?.show_ticker;

  document.getElementById("intervalSec").value = config.carousel?.interval_sec ?? 10;
  document.getElementById("shuffle").checked = !!config.carousel?.shuffle;

  document.getElementById("textTitle").value = config.text_panel?.title ?? "";
  document.getElementById("textMarkdown").value = config.text_panel?.markdown ?? "";

  document.getElementById("weatherEnabled").checked = !!config.info_boxes?.weather_enabled;
  document.getElementById("weatherCity").value = config.info_boxes?.weather?.city ?? "";
  document.getElementById("weatherLat").value = config.info_boxes?.weather?.lat ?? "";
  document.getElementById("weatherLon").value = config.info_boxes?.weather?.lon ?? "";

  document.getElementById("ampelStatus").value = config.info_boxes?.ampel?.status ?? "green";
  document.getElementById("ampelLabel").value = config.info_boxes?.ampel?.label ?? "";
  document.getElementById("ampelDetails").value = config.info_boxes?.ampel?.details ?? "";

  const custom = (config.info_boxes?.custom || [])[0] || { title:"", markdown:"", enabled:true };
  document.getElementById("customBoxEnabled").checked = !!custom.enabled;
  document.getElementById("customBoxTitle").value = custom.title ?? "";
  document.getElementById("customBoxMarkdown").value = custom.markdown ?? "";

  document.getElementById("tickerSpeed").value = config.ticker?.speed ?? 70;
  document.getElementById("tickerEnabled").checked = !!config.ticker?.enabled;
  document.getElementById("tickerItems").value = (config.ticker?.items || []).join("\n");

  // Events
  document.getElementById("eventsEnabled").checked = !!config.events?.enabled;
  document.getElementById("eventsTitle").value = config.events?.title ?? "Termine";
  document.getElementById("eventsItems").value = (config.events?.items || []).join("\n");

  // folders multiselect
  const sel = document.getElementById("carouselFolders");
  sel.innerHTML = "";
  for (const f of folders.folders){
    const opt = document.createElement("option");
    opt.value = f.id;
    opt.textContent = f.name;
    sel.appendChild(opt);
  }
  if (config.carousel?.folders === "all"){
    // none selected means "all"
    sel.value = "";
  } else if (Array.isArray(config.carousel?.folders)){
    for (const opt of sel.options){
      opt.selected = config.carousel.folders.includes(opt.value);
    }
  }
}

function readFormToConfig(){
  const theme = document.getElementById("theme").value;
  const mode = document.getElementById("mode").value;
  const showInfo = document.getElementById("showInfo").checked;
  const showTicker = document.getElementById("showTicker").checked;

  const intervalSec = clamp(parseInt(document.getElementById("intervalSec").value || "10", 10), 3, 120);
  const shuffle = document.getElementById("shuffle").checked;

  const textTitle = document.getElementById("textTitle").value;
  const textMarkdown = document.getElementById("textMarkdown").value;

  const weatherEnabled = document.getElementById("weatherEnabled").checked;
  const weatherCity = document.getElementById("weatherCity").value;
  const weatherLat = parseFloat(document.getElementById("weatherLat").value || "0");
  const weatherLon = parseFloat(document.getElementById("weatherLon").value || "0");

  const ampelStatus = document.getElementById("ampelStatus").value;
  const ampelLabel = document.getElementById("ampelLabel").value;
  const ampelDetails = document.getElementById("ampelDetails").value;

  const customEnabled = document.getElementById("customBoxEnabled").checked;
  const customTitle = document.getElementById("customBoxTitle").value;
  const customMarkdown = document.getElementById("customBoxMarkdown").value;

  const tickerSpeed = clamp(parseInt(document.getElementById("tickerSpeed").value || "70", 10), 20, 220);
  const tickerItems = document.getElementById("tickerItems").value
    .split("\n").map(s => s.trim()).filter(Boolean);
  const tickerEnabled = document.getElementById("tickerEnabled").checked;

  // Events lesen
  const eventsEnabled = document.getElementById("eventsEnabled").checked;
  const eventsTitle = document.getElementById("eventsTitle").value;
  const eventsItems = document.getElementById("eventsItems").value
    .split("\n").map(s => s.trim()).filter(Boolean);

  config.events = { enabled: eventsEnabled, title: eventsTitle, items: eventsItems };

  const folderSelect = document.getElementById("carouselFolders");
  const selected = Array.from(folderSelect.selectedOptions).map(o => o.value);
  const carouselFolders = selected.length === 0 ? "all" : selected;

  config.theme = theme;
  config.layout = { ...config.layout, mode, show_info_column: showInfo, show_ticker: showTicker };
  config.carousel = { ...config.carousel, interval_sec: intervalSec, shuffle, folders: carouselFolders };

  config.text_panel = { title: textTitle, markdown: textMarkdown };

  config.info_boxes = {
    ...config.info_boxes,
    weather_enabled: weatherEnabled,
    weather: { ...config.info_boxes?.weather, city: weatherCity, lat: weatherLat, lon: weatherLon, units: "metric" },
    ampel: { status: ampelStatus, label: ampelLabel, details: ampelDetails },
    custom: [{ title: customTitle, markdown: customMarkdown, enabled: customEnabled }],
  };

config.ticker = { ...config.ticker, enabled: tickerEnabled, speed: tickerSpeed, items: tickerItems };}

function folderImages(folderId){
  return (imagesIndex?.[folderId] || []);
}

function el(tag, cls){
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  return e;
}

function renderFolders(){
  const wrap = document.getElementById("folderList");
  wrap.innerHTML = "";
  for (const f of folders.folders){
    const card = el("div","folder");
    const top = el("div","folderTop");
    const left = el("div");
    const name = el("div","folderName");
    name.textContent = f.name;
    const meta = el("div","folderMeta");
    meta.textContent = `slug: ${f.slug} · ${folderImages(f.id).length} Bilder`;
    left.append(name, meta);

    const actions = el("div","folderActions");

    const up = document.createElement("input");
    up.type = "file";
    up.multiple = true;
    up.accept = "image/*";
    up.className = "input";
    up.style.maxWidth = "260px";

    const btnUpload = el("button","btn primary");
    btnUpload.textContent = "Upload";
    btnUpload.onclick = async () => {
      if (!up.files || up.files.length === 0) return;
      await uploadToFolder(f.id, up.files);
      up.value = "";
    };

    const btnDel = el("button","btn");
    btnDel.textContent = "Ordner löschen";
    btnDel.onclick = async () => {
      if (!confirm(`Ordner "${f.name}" wirklich löschen? (inkl. Bilder)`)) return;
      await apiDelete(`/api/folders/${f.id}`);
      await reloadAll();
    };

    actions.append(up, btnUpload, btnDel);

    top.append(left, actions);
    card.appendChild(top);

    const thumbs = el("div","thumbGrid");
    const ims = folderImages(f.id);
    for (const im of ims.slice(-18).reverse()){
      const t = el("div","thumb");
      const img = document.createElement("img");
      img.src = `/media/${f.slug}/${im.thumb || im.filename}`;
      img.loading = "lazy";
      const del = document.createElement("button");
      del.textContent = "×";
      del.title = "Bild löschen";
      del.onclick = async () => {
        if (!confirm("Bild löschen?")) return;
        await apiDelete(`/api/folders/${f.id}/images/${im.id}`);
        await reloadAll();
      };
      t.append(img, del);
      thumbs.appendChild(t);
    }
    card.appendChild(thumbs);

    wrap.appendChild(card);
  }
}

async function uploadToFolder(folderId, fileList){
  const fd = new FormData();
  for (const f of fileList){
    fd.append("files", f, f.name);
  }
  const r = await fetch(`/api/folders/${folderId}/images`, {
    method: "POST",
    headers: { "X-Admin-Password": adminPw },
    body: fd
  });
  if (!r.ok) throw new Error("Upload fehlgeschlagen");
  return await r.json();
}

async function reloadAll(){
  config = await apiGet("/api/config");
  folders = await apiGet("/api/folders");
  const state = await fetch("/api/state", { cache:"no-store" }).then(r => r.json());
  imagesIndex = state.images;
  bindConfigToForm();
  renderFolders();
  setAuthStatus(true);
}

function bindButtons(){
  document.getElementById("btnSetPw").onclick = () => {
    adminPw = document.getElementById("adminPw").value || "";
    localStorage.setItem("kita_admin_pw", adminPw);
    reloadAll().catch(() => setAuthStatus(false));
  };
  document.getElementById("btnClearPw").onclick = () => {
    adminPw = "";
    localStorage.removeItem("kita_admin_pw");
    document.getElementById("adminPw").value = "";
    setAuthStatus(false);
  };
  document.getElementById("btnReload").onclick = () => reloadAll().catch(() => setAuthStatus(false));
  document.getElementById("btnSave").onclick = async () => {
    try{
      readFormToConfig();
      await apiPut("/api/config", config);
      setAuthStatus(true);
      alert("Gespeichert. Kiosk aktualisiert automatisch.");
    }catch(e){
      console.error(e);
      setAuthStatus(false);
      alert("Speichern fehlgeschlagen (Passwort korrekt?)");
    }
  };

  document.getElementById("btnCreateFolder").onclick = async () => {
    const name = document.getElementById("newFolderName").value.trim();
    if (!name) return;
    await apiPost("/api/folders", { name });
    document.getElementById("newFolderName").value = "";
    await reloadAll();
  };
}

function initAuthUi(){
  document.getElementById("adminPw").value = adminPw;
}

async function init(){
  initAuthUi();
  bindButtons();

  if (!adminPw){
    setAuthStatus(false);
    return;
  }
  try{
    await reloadAll();
  }catch(e){
    console.error(e);
    setAuthStatus(false);
  }
}

init();
