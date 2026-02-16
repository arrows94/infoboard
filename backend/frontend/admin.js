
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

// Globale Variablen für die Auswahl
let currentFolderImages = [];
let selectedImages = new Set();
let currentFolderPath = "";

function renderFolders() {
  const container = document.getElementById("folderList");
  container.innerHTML = "";
  
  // Stelle sicher, dass wir in der Übersicht sind
  document.getElementById("folderList").style.display = "block";
  document.getElementById("folderDetail").style.display = "none";

  const folders = Object.keys(imagesData).sort();

  if (folders.length === 0) {
    container.innerHTML = "<p class='muted'>Keine Bilder gefunden.</p>";
    return;
  }

  for (const folder of folders) {
    const ims = imagesData[folder] || [];
    
    // Ordner-Karte erstellen
    const card = el("div", "folder-card");
    card.onclick = () => openFolder(folder); // Klick öffnet Details
    card.style.cursor = "pointer";
    card.style.border = "1px solid #444";
    card.style.borderRadius = "8px";
    card.style.padding = "10px";
    card.style.marginBottom = "10px";
    card.style.background = "#2a2a2a";

    // Titel & Anzahl
    const head = el("div");
    head.innerHTML = `<strong>${folder}</strong> <span class="muted">(${ims.length} Bilder)</span>`;
    card.appendChild(head);

    // Mini-Vorschau (max 5 Bilder)
    const preview = el("div");
    preview.style.display = "flex";
    preview.style.gap = "5px";
    preview.style.marginTop = "8px";
    preview.style.overflow = "hidden";
    
    for (const im of ims.slice(0, 5)) {
      const thumb = el("img");
      thumb.src = im.thumb || im.src;
      thumb.style.width = "40px";
      thumb.style.height = "40px";
      thumb.style.objectFit = "cover";
      thumb.style.borderRadius = "4px";
      preview.appendChild(thumb);
    }
    card.appendChild(preview);
    container.appendChild(card);
  }
}

// Öffnet die Detail-Ansicht
function openFolder(folder) {
  currentFolderPath = folder;
  currentFolderImages = imagesData[folder] || [];
  selectedImages.clear();
  updateDeleteButton();

  document.getElementById("folderList").style.display = "none";
  document.getElementById("folderDetail").style.display = "block";
  document.getElementById("detailTitle").textContent = folder;
  document.getElementById("selectAllBox").checked = false;

  const grid = document.getElementById("detailGrid");
  grid.innerHTML = "";

  // Alle Bilder anzeigen
  for (const im of currentFolderImages) {
    const wrap = el("div", "img-wrap");
    wrap.style.position = "relative";
    wrap.style.cursor = "pointer";
    
    // Klick auf das Bild toggelt Checkbox
    wrap.onclick = (e) => {
      // Verhindern, dass Klick auf Checkbox doppelt feuert
      if (e.target.type !== 'checkbox') {
        toggleSelection(im.filename);
      }
    };

    const img = el("img");
    img.src = im.thumb || im.src;
    img.loading = "lazy";
    
    // Checkbox overlay
    const check = el("input");
    check.type = "checkbox";
    check.className = "img-select-box";
    check.style.position = "absolute";
    check.style.top = "5px";
    check.style.left = "5px";
    check.style.transform = "scale(1.5)";
    check.style.zIndex = "10";
    check.checked = selectedImages.has(im.filename);
    check.onchange = () => toggleSelection(im.filename);

    // ID für einfaches Finden
    wrap.dataset.filename = im.filename; 

    wrap.appendChild(img);
    wrap.appendChild(check);
    grid.appendChild(wrap);
  }
}

function closeFolder() {
  document.getElementById("folderList").style.display = "block";
  document.getElementById("folderDetail").style.display = "none";
}

// Ein einzelnes Bild markieren/demarkieren
function toggleSelection(filename) {
  if (selectedImages.has(filename)) {
    selectedImages.delete(filename);
  } else {
    selectedImages.add(filename);
  }
  
  // Visuelles Update (Rahmen um Bild)
  const wraps = document.querySelectorAll("#detailGrid .img-wrap");
  wraps.forEach(w => {
    const checkbox = w.querySelector("input[type='checkbox']");
    if (w.dataset.filename === filename) {
        checkbox.checked = selectedImages.has(filename);
        w.style.outline = selectedImages.has(filename) ? "3px solid var(--accent)" : "none";
    }
  });

  updateDeleteButton();
}

// "Alle auswählen" Checkbox Logik
function toggleSelectAll(checkbox) {
  const isChecked = checkbox.checked;
  selectedImages.clear();
  
  if (isChecked) {
    currentFolderImages.forEach(im => selectedImages.add(im.filename));
  }
  
  // UI aktualisieren
  const wraps = document.querySelectorAll("#detailGrid .img-wrap");
  wraps.forEach(w => {
     w.querySelector("input").checked = isChecked;
     w.style.outline = isChecked ? "3px solid var(--accent)" : "none";
  });
  updateDeleteButton();
}

function updateDeleteButton() {
  const btn = document.getElementById("btnDeleteSelected");
  if (selectedImages.size > 0) {
    btn.style.display = "inline-block";
    btn.textContent = `${selectedImages.size} Bilder löschen`;
  } else {
    btn.style.display = "none";
  }
}

async function deleteSelected() {
  if (!confirm(`Wirklich ${selectedImages.size} Bilder löschen?`)) return;

  const btn = document.getElementById("btnDeleteSelected");
  btn.disabled = true;
  btn.textContent = "Lösche...";

  // Für jedes Bild eine Lösch-Anfrage senden
  for (const filename of selectedImages) {
    try {
      await apiDelete(currentFolderPath, filename);
    } catch (e) {
      console.error("Fehler beim Löschen von", filename, e);
    }
  }

  // Daten neu laden und Ansicht aktualisieren
  await loadImages();
  // Wenn der Ordner leer ist, zurück zur Übersicht, sonst Refresh
  if (!imagesData[currentFolderPath] || imagesData[currentFolderPath].length === 0) {
    closeFolder();
  } else {
    openFolder(currentFolderPath);
  }
  
  btn.disabled = false;
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

window.closeFolder = closeFolder;
window.toggleSelectAll = toggleSelectAll;
window.deleteSelected = deleteSelected;

init();
