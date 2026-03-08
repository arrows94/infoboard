import { markdownToHtml, clamp } from "./utils.js";

let adminPw = localStorage.getItem("kita_admin_pw") || "";
let config = null;
let folders = null; // Die Liste der Ordner (aus /api/folders)
let imagesIndex = null; // Die Bilder zu den Ordnern (aus /api/state)

// --- Basis Funktionen ---

function showToast(message, keepAlive = false) {
  // Remove existing toast if any
  const existing = document.getElementById("admin-toast");
  if (existing) existing.remove();

  const el = document.createElement("div");
  el.id = "admin-toast";
  el.textContent = message;
  el.style.position = "fixed";
  el.style.bottom = "20px";
  el.style.right = "20px";
  el.style.background = "#333";
  el.style.color = "#fff";
  el.style.padding = "10px 20px";
  el.style.borderRadius = "4px";
  el.style.boxShadow = "0 2px 10px rgba(0,0,0,0.2)";
  el.style.zIndex = "9999";

  // Make sure inner content isn't wrapping weirdly
  el.style.display = "flex";
  el.style.flexDirection = "column";
  el.style.gap = "8px";

  document.body.appendChild(el);

  if (!keepAlive) {
    setTimeout(() => {
      if (el.parentNode) el.remove();
    }, 5000);
  }

  return el;
}

function setTheme(theme) {
  document.body.dataset.theme = theme || "mint";
}

function headers() {
  return {
    "Content-Type": "application/json",
    "X-Admin-Password": adminPw,
  };
}

function setAuthStatus(ok) {
  const el = document.getElementById("authStatus");
  if (ok) {
    el.textContent = "Verbunden";
    el.className = "pill ok";
  } else {
    el.textContent = "Nicht verbunden";
    el.className = "pill warn";
  }
}

// --- API Wrapper ---

async function apiGet(path) {
  const r = await fetch(path, { headers: headers(), cache: "no-store" });
  if (!r.ok) throw new Error(`${path} failed: ${r.status}`);
  return await r.json();
}

async function apiPost(path, body) {
  const r = await fetch(path, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${path} failed: ${r.status}`);
  return await r.json();
}

async function apiPut(path, body) {
  const r = await fetch(path, {
    method: "PUT",
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${path} failed: ${r.status}`);
  return await r.json();
}

async function apiDelete(path) {
  const r = await fetch(path, { method: "DELETE", headers: headers() });
  if (!r.ok) throw new Error(`${path} failed: ${r.status}`);
  return await r.json();
}

// --- Formular & Config Logik ---

function bindConfigToForm() {
  setTheme(config.theme);
  document.getElementById("theme").value = config.theme || "mint";
  document.getElementById("mode").value = config.layout?.mode || "carousel";
  document.getElementById("showInfo").checked =
    !!config.layout?.show_info_column;
  document.getElementById("showTicker").checked = !!config.layout?.show_ticker;

  document.getElementById("intervalSec").value =
    config.carousel?.interval_sec ?? 10;
  document.getElementById("shuffle").checked = !!config.carousel?.shuffle;

  document.getElementById("textTitle").value = config.text_panel?.title ?? "";
  document.getElementById("textMarkdown").value =
    config.text_panel?.markdown ?? "";

  document.getElementById("weatherEnabled").checked =
    !!config.info_boxes?.weather_enabled;
  document.getElementById("weatherCity").value =
    config.info_boxes?.weather?.city ?? "";
  document.getElementById("weatherLat").value =
    config.info_boxes?.weather?.lat ?? "";
  document.getElementById("weatherLon").value =
    config.info_boxes?.weather?.lon ?? "";

  document.getElementById("ampelStatus").value =
    config.info_boxes?.ampel?.status ?? "green";
  document.getElementById("ampelLabel").value =
    config.info_boxes?.ampel?.label ?? "";
  document.getElementById("ampelDetails").value =
    config.info_boxes?.ampel?.details ?? "";

  const custom = (config.info_boxes?.custom || [])[0] || {
    title: "",
    markdown: "",
    enabled: true,
  };
  document.getElementById("customBoxEnabled").checked = !!custom.enabled;
  document.getElementById("customBoxTitle").value = custom.title ?? "";
  document.getElementById("customBoxMarkdown").value = custom.markdown ?? "";

  document.getElementById("tickerSpeed").value = config.ticker?.speed ?? 70;
  document.getElementById("tickerEnabled").checked = !!config.ticker?.enabled;
  document.getElementById("tickerItems").value = (
    config.ticker?.items || []
  ).join("\n");

  // Events (Termine)
  document.getElementById("eventsEnabled").checked = !!config.events?.enabled;
  document.getElementById("eventsTitle").value =
    config.events?.title ?? "Termine";
  document.getElementById("eventsItems").value = (
    config.events?.items || []
  ).join("\n");

  // Ordner Auswahl für Karussell
  const sel = document.getElementById("carouselFolders");
  sel.innerHTML = "";
  if (folders && folders.folders) {
    for (const f of folders.folders) {
      const opt = document.createElement("option");
      opt.value = f.id;
      opt.textContent = f.name;
      sel.appendChild(opt);
    }
  }

  if (config.carousel?.folders === "all") {
    sel.value = "";
  } else if (Array.isArray(config.carousel?.folders)) {
    for (const opt of sel.options) {
      opt.selected = config.carousel.folders.includes(opt.value);
    }
  }
}

function readFormToConfig() {
  const theme = document.getElementById("theme").value;
  const mode = document.getElementById("mode").value;
  const showInfo = document.getElementById("showInfo").checked;
  const showTicker = document.getElementById("showTicker").checked;

  const intervalSec = clamp(
    parseInt(document.getElementById("intervalSec").value || "10", 10),
    3,
    120,
  );
  const shuffle = document.getElementById("shuffle").checked;

  const textTitle = document.getElementById("textTitle").value;
  const textMarkdown = document.getElementById("textMarkdown").value;

  const weatherEnabled = document.getElementById("weatherEnabled").checked;
  const weatherCity = document.getElementById("weatherCity").value;
  const weatherLat = parseFloat(
    document.getElementById("weatherLat").value || "0",
  );
  const weatherLon = parseFloat(
    document.getElementById("weatherLon").value || "0",
  );

  const ampelStatus = document.getElementById("ampelStatus").value;
  const ampelLabel = document.getElementById("ampelLabel").value;
  const ampelDetails = document.getElementById("ampelDetails").value;

  const customEnabled = document.getElementById("customBoxEnabled").checked;
  const customTitle = document.getElementById("customBoxTitle").value;
  const customMarkdown = document.getElementById("customBoxMarkdown").value;

  const tickerSpeed = clamp(
    parseInt(document.getElementById("tickerSpeed").value || "70", 10),
    20,
    220,
  );
  const tickerItems = document
    .getElementById("tickerItems")
    .value.split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const tickerEnabled = document.getElementById("tickerEnabled").checked;

  // Events lesen
  const eventsEnabled = document.getElementById("eventsEnabled").checked;
  const eventsTitle = document.getElementById("eventsTitle").value;
  const eventsItems = document
    .getElementById("eventsItems")
    .value.split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  const folderSelect = document.getElementById("carouselFolders");
  const selected = Array.from(folderSelect.selectedOptions).map((o) => o.value);
  const carouselFolders = selected.length === 0 ? "all" : selected;

  // Config Objekt zusammenbauen
  config.theme = theme;
  config.layout = {
    ...config.layout,
    mode,
    show_info_column: showInfo,
    show_ticker: showTicker,
  };
  config.carousel = {
    ...config.carousel,
    interval_sec: intervalSec,
    shuffle,
    folders: carouselFolders,
  };
  config.text_panel = { title: textTitle, markdown: textMarkdown };

  config.info_boxes = {
    ...config.info_boxes,
    weather_enabled: weatherEnabled,
    weather: {
      ...config.info_boxes?.weather,
      city: weatherCity,
      lat: weatherLat,
      lon: weatherLon,
      units: "metric",
    },
    ampel: { status: ampelStatus, label: ampelLabel, details: ampelDetails },
    custom: [
      { title: customTitle, markdown: customMarkdown, enabled: customEnabled },
    ],
  };

  config.ticker = {
    ...config.ticker,
    enabled: tickerEnabled,
    speed: tickerSpeed,
    items: tickerItems,
  };
  config.events = {
    enabled: eventsEnabled,
    title: eventsTitle,
    items: eventsItems,
  };
}

function el(tag, cls) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  return e;
}

// --- Bilder & Ordner Management (Neu & Korrigiert) ---

let currentFolderId = "";
let currentFolderImages = [];
let selectedImages = new Set(); // Speichert IDs der ausgewählten Bilder

function renderFolders() {
  const container = document.getElementById("folderList");
  container.innerHTML = "";

  // Ansicht umschalten
  document.getElementById("folderList").style.display = "block";
  document.getElementById("folderDetail").style.display = "none";

  const fList = folders?.folders || [];

  if (fList.length === 0) {
    container.innerHTML =
      "<p class='muted'>Keine Ordner vorhanden. Lege oben einen an.</p>";
    return;
  }

  const fragment = document.createDocumentFragment();

  for (const f of fList) {
    const ims = imagesIndex?.[f.id] || [];

    // Karte
    const card = el("div", "folder-card");
    // Inline Styles für Layout (damit es ohne CSS-Update funktioniert)
    card.style.cssText =
      "cursor:pointer; border:1px solid #444; border-radius:8px; padding:10px; margin-bottom:10px; background:#2a2a2a;";

    card.onclick = (e) => {
      // Klick auf Buttons ignorieren
      if (["BUTTON", "INPUT"].includes(e.target.tagName)) return;
      openFolder(f.id, f.name);
    };

    // Header Zeile
    const top = el("div");
    top.style.cssText =
      "display:flex; justify-content:space-between; align-items:center;";

    const title = el("div");
    // 🛡️ Sentinel: Safe DOM construction to prevent Stored XSS via folder names
    const strongName = document.createElement("strong");
    strongName.textContent = f.name;
    const spanMuted = el("span", "muted");
    spanMuted.textContent = ` (${ims.length} Bilder)`;
    title.appendChild(strongName);
    title.appendChild(spanMuted);

    // Actions (Upload / Delete)
    const actions = el("div");
    actions.style.display = "flex";
    actions.style.gap = "8px";

    // Verstecktes File Input für Upload
    const upInput = document.createElement("input");
    upInput.type = "file";
    upInput.multiple = true;
    upInput.accept = "image/*";
    upInput.style.display = "none";
    upInput.onchange = async () => {
      if (!upInput.files.length) return;

      const fileCount = upInput.files.length;
      let msg = `Lade ${fileCount} Datei(en) hoch...`;
      if (fileCount > 5) {
        msg = `Lade ${fileCount} Dateien hoch. Das kann einige Zeit dauern. Du kannst die Seite auch neu laden.`;
      }

      const toastEl = showToast(msg, true);

      // Create progress bar
      const progressContainer = document.createElement("div");
      progressContainer.style.width = "100%";
      progressContainer.style.height = "6px";
      progressContainer.style.background = "rgba(255,255,255,0.2)";
      progressContainer.style.borderRadius = "3px";
      progressContainer.style.overflow = "hidden";

      const progressBar = document.createElement("div");
      progressBar.style.width = "0%";
      progressBar.style.height = "100%";
      progressBar.style.background = "var(--accent, #5eead4)";
      progressBar.style.transition = "width 0.2s ease-out";

      progressContainer.appendChild(progressBar);
      toastEl.appendChild(progressContainer);

      try {
        const files = Array.from(upInput.files);
        const batchSize = 10;
        const totalFiles = files.length;
        let uploadedFiles = 0;

        for (let i = 0; i < totalFiles; i += batchSize) {
          const batch = files.slice(i, i + batchSize);
          await uploadToFolder(f.id, batch, (percent) => {
            const overallProgress =
              ((uploadedFiles + (percent / 100) * batch.length) / totalFiles) *
              100;
            progressBar.style.width = `${overallProgress}%`;
            if (overallProgress >= 99.9) {
              toastEl.firstChild.textContent =
                "Upload beendet. Server verarbeitet nun die Bilder...";
            }
          });
          uploadedFiles += batch.length;
        }

        toastEl.remove();
        showToast("Upload und Verarbeitung abgeschlossen!");
      } catch (err) {
        toastEl.remove();
        showToast("Fehler beim Upload.");
        console.error(err);
      }
      upInput.value = "";
      await reloadAll();
    };

    const btnUp = el("button", "btn primary");
    btnUp.textContent = "Upload";
    btnUp.style.padding = "4px 10px";
    btnUp.style.fontSize = "14px";
    btnUp.onclick = (e) => {
      e.stopPropagation();
      upInput.click();
    };

    const btnDel = el("button", "btn");
    btnDel.textContent = "Ordner löschen";
    btnDel.style.padding = "4px 10px";
    btnDel.style.fontSize = "14px";
    btnDel.onclick = async (e) => {
      e.stopPropagation();
      if (confirm(`Ordner "${f.name}" wirklich komplett löschen?`)) {
        await apiDelete(`/api/folders/${f.id}`);
        await reloadAll();
      }
    };

    actions.append(btnUp, btnDel);
    top.append(title, actions);
    card.appendChild(top);

    // Vorschau (Thumbnails)
    const preview = el("div");
    preview.style.cssText =
      "display:flex; gap:5px; margin-top:8px; overflow:hidden;";

    for (const im of ims.slice(0, 6)) {
      if (im.type === "video") {
        const d = el("div");
        d.textContent = "VIDEO";
        d.style.cssText =
          "width:40px; height:40px; background:#444; color:#fff; font-size:8px; display:flex; align-items:center; justify-content:center; border-radius:4px; font-weight:bold;";
        preview.appendChild(d);
      } else {
        const thumb = el("img");
        thumb.src = `/media/${f.slug}/${im.thumb || im.filename}`;
        thumb.alt = ""; // Decorative thumbnail
        thumb.style.cssText =
          "width:40px; height:40px; object-fit:cover; border-radius:4px;";
        preview.appendChild(thumb);
      }
    }
    card.appendChild(preview);
    fragment.appendChild(card);
  }

  container.appendChild(fragment);
}

function openFolder(folderId, folderName) {
  currentFolderId = folderId;
  currentFolderImages = imagesIndex?.[folderId] || [];

  // Slug finden für URLs
  const fObj = folders.folders.find((x) => x.id === folderId);
  const slug = fObj ? fObj.slug : "";

  selectedImages.clear();
  updateDeleteButton();

  document.getElementById("folderList").style.display = "none";
  document.getElementById("folderDetail").style.display = "block";
  document.getElementById("detailTitle").textContent = folderName;
  document.getElementById("selectAllBox").checked = false;

  const grid = document.getElementById("detailGrid");
  grid.innerHTML = "";

  const fragment = document.createDocumentFragment();

  for (const im of currentFolderImages) {
    const wrap = el("div", "img-wrap");
    wrap.style.cssText =
      "position:relative; cursor:pointer; display:inline-block; margin:5px;";

    wrap.onclick = (e) => {
      if (e.target.type !== "checkbox") toggleSelection(im.id);
    };

    let content;
    if (im.type === "video") {
      content = document.createElement("video");
      content.src = `/media/${slug}/${im.filename}`;
      content.preload = "metadata";
      content.style.cssText =
        "height:120px; border-radius:4px; display:block; background:#000;";
    } else {
      content = el("img");
      content.src = `/media/${slug}/${im.thumb || im.filename}`;
      content.alt = ""; // Decorative thumbnail
      content.loading = "lazy";
      content.style.cssText = "height:120px; border-radius:4px; display:block;";
    }

    const check = el("input");
    check.type = "checkbox";
    check.style.cssText =
      "position:absolute; top:5px; left:5px; transform:scale(1.3); cursor:pointer;";
    check.checked = selectedImages.has(im.id);
    check.onchange = () => toggleSelection(im.id);

    // Dataset ID speichern für schnelles UI Update
    wrap.dataset.imgid = im.id;

    wrap.appendChild(content);
    wrap.appendChild(check);
    fragment.appendChild(wrap);
  }

  grid.appendChild(fragment);
}

function closeFolder() {
  document.getElementById("folderList").style.display = "block";
  document.getElementById("folderDetail").style.display = "none";
}

function toggleSelection(id) {
  if (selectedImages.has(id)) {
    selectedImages.delete(id);
  } else {
    selectedImages.add(id);
  }

  // UI Rahmen aktualisieren
  const wrap = document.querySelector(
    `#detailGrid .img-wrap[data-imgid="${id}"]`,
  );
  if (wrap) {
    const cb = wrap.querySelector("input");
    cb.checked = selectedImages.has(id);
    wrap.style.outline = selectedImages.has(id)
      ? "3px solid var(--accent)"
      : "none";
  }

  updateDeleteButton();
}

function toggleSelectAll(checkbox) {
  const isChecked = checkbox.checked;
  selectedImages.clear();

  if (isChecked) {
    currentFolderImages.forEach((im) => selectedImages.add(im.id));
  }

  // Alle Checkboxen updaten
  const wraps = document.querySelectorAll("#detailGrid .img-wrap");
  wraps.forEach((w) => {
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

  // ⚡ Bolt: Use atomic batch delete to avoid broadcast storms and race conditions with index.json
  try {
    await apiPost(`/api/folders/${currentFolderId}/images/batch-delete`, {
      image_ids: Array.from(selectedImages),
    });
  } catch (e) {
    console.error("Fehler beim Löschen:", e);
    showToast("Fehler beim Löschen der Bilder.");
  }

  await reloadAll();

  // Wenn Ordner noch existiert, Ansicht aktualisieren
  const fObj = folders.folders.find((x) => x.id === currentFolderId);
  if (fObj) {
    openFolder(fObj.id, fObj.name);
  } else {
    closeFolder();
  }

  btn.disabled = false;
}

function uploadToFolder(folderId, fileList, onProgress) {
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    for (const f of fileList) {
      fd.append("files", f, f.name);
    }

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/folders/${folderId}/images`);
    xhr.setRequestHeader("X-Admin-Password", adminPw);

    if (onProgress && xhr.upload) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          onProgress((e.loaded / e.total) * 100);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        reject(new Error(`Upload fehlgeschlagen: ${xhr.statusText}`));
      }
    };

    xhr.onerror = () => reject(new Error("Netzwerkfehler beim Upload"));
    xhr.send(fd);
  });
}

// --- App State ---

async function reloadAll() {
  config = await apiGet("/api/config");
  folders = await apiGet("/api/folders"); // { folders: [...] }
  const state = await fetch("/api/state", { cache: "no-store" }).then((r) =>
    r.json(),
  );
  imagesIndex = state.images; // { "folderID": [img1, img2...], ... }

  bindConfigToForm();
  renderFolders();
  setAuthStatus(true);
}

function bindButtons() {
  // Passwort Buttons
  const btnSetPw = document.getElementById("btnSetPw");
  const inputPw = document.getElementById("adminPw");

  btnSetPw.onclick = () => {
    adminPw = inputPw.value || "";
    localStorage.setItem("kita_admin_pw", adminPw);
    reloadAll().catch(() => setAuthStatus(false));
  };

  // Keyboard support for Enter
  inputPw.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      btnSetPw.click();
    }
  });

  document.getElementById("btnClearPw").onclick = () => {
    adminPw = "";
    localStorage.removeItem("kita_admin_pw");
    document.getElementById("adminPw").value = "";
    setAuthStatus(false);
  };

  // Global Actions
  document.getElementById("btnReload").onclick = () =>
    reloadAll().catch(() => setAuthStatus(false));

  const btnSave = document.getElementById("btnSave");
  btnSave.onclick = async () => {
    try {
      btnSave.disabled = true;
      btnSave.textContent = "Speichere...";
      readFormToConfig();
      await apiPut("/api/config", config);
      setAuthStatus(true);
      showToast("Gespeichert. Kiosk aktualisiert sich in Kürze.");
    } catch (e) {
      console.error(e);
      setAuthStatus(false);
      showToast("Speichern fehlgeschlagen (Passwort prüfen?)");
    } finally {
      btnSave.disabled = false;
      btnSave.textContent = "Speichern";
    }
  };

  // Neuen Ordner erstellen
  const btnCreate = document.getElementById("btnCreateFolder");
  const inpNewFolder = document.getElementById("newFolderName");

  if (btnCreate && inpNewFolder) {
    btnCreate.onclick = async () => {
      const name = inpNewFolder.value.trim();
      if (!name) return;
      await apiPost("/api/folders", { name });
      inpNewFolder.value = "";
      showToast(`Ordner "${name}" erstellt!`);
      await reloadAll();
    };

    // Keyboard support for Enter
    inpNewFolder.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        btnCreate.click();
      }
    });
  }
}

function initAuthUi() {
  document.getElementById("adminPw").value = adminPw;
}

async function init() {
  initAuthUi();
  bindButtons();

  if (!adminPw) {
    setAuthStatus(false);
    return;
  }
  try {
    await reloadAll();
  } catch (e) {
    console.error(e);
    setAuthStatus(false);
  }
}

// Funktionen global verfügbar machen (für HTML onclicks)
window.closeFolder = closeFolder;
window.toggleSelectAll = toggleSelectAll;
window.deleteSelected = deleteSelected;

init();
