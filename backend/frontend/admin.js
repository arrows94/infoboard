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
  el.setAttribute("role", "status");
  el.setAttribute("aria-live", "polite");
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
  document.getElementById("aspectRatio").value =
    config.layout?.image_aspect_ratio || "auto";
  document.getElementById("showInfo").checked =
    !!config.layout?.show_info_column;
  document.getElementById("sidebarWidth").value =
    config.layout?.sidebar_width || "280px";
  document.getElementById("showTicker").checked = !!config.layout?.show_ticker;

  document.getElementById("intervalSec").value =
    config.carousel?.interval_sec ?? 10;
  document.getElementById("shuffle").checked = !!config.carousel?.shuffle;
  document.getElementById("animation").value =
    config.carousel?.animation || "fade";

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

  document.getElementById("ampelEnabled").checked =
    config.info_boxes?.ampel?.enabled ?? true;
  document.getElementById("ampelLayout").value =
    config.info_boxes?.ampel?.layout ?? "sidebar";
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
  renderEventsList();

  // Ordner Auswahl für Karussell
  const sel = document.getElementById("carouselFolders");
  sel.innerHTML = "";
  if (folders && folders.folders) {
    // ⚡ Bolt: Use DocumentFragment to batch DOM insertions and prevent excessive reflows
    const frag = document.createDocumentFragment();
    for (const f of folders.folders) {
      const opt = document.createElement("option");
      opt.value = f.id;
      opt.textContent = f.name;
      frag.appendChild(opt);
    }
    sel.appendChild(frag);
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
  const aspectRatio = document.getElementById("aspectRatio").value;
  const showInfo = document.getElementById("showInfo").checked;
  const sidebarWidth = document.getElementById("sidebarWidth").value;
  const showTicker = document.getElementById("showTicker").checked;

  const intervalSec = clamp(
    parseInt(document.getElementById("intervalSec").value || "10", 10),
    3,
    120,
  );
  const shuffle = document.getElementById("shuffle").checked;
  const animation = document.getElementById("animation").value;

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

  const ampelEnabled = document.getElementById("ampelEnabled").checked;
  const ampelLayout = document.getElementById("ampelLayout").value;
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
  // Events are already managed in config.events.items via the UI, no need to read from a textarea
  const eventsItems = config.events?.items || [];

  const folderSelect = document.getElementById("carouselFolders");
  const selected = Array.from(folderSelect.selectedOptions).map((o) => o.value);
  const carouselFolders = selected.length === 0 ? "all" : selected;

  // Config Objekt zusammenbauen
  config.theme = theme;
  config.layout = {
    ...config.layout,
    mode,
    image_aspect_ratio: aspectRatio,
    show_info_column: showInfo,
    sidebar_width: sidebarWidth,
    show_ticker: showTicker,
  };
  config.carousel = {
    ...config.carousel,
    interval_sec: intervalSec,
    shuffle,
    animation,
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
    ampel: {
      enabled: ampelEnabled,
      layout: ampelLayout,
      status: ampelStatus,
      label: ampelLabel,
      details: ampelDetails,
    },
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
    ...config.events,
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

  // ⚡ Bolt: Use DocumentFragment to batch DOM insertions and prevent excessive reflows
  const frag = document.createDocumentFragment();
  for (const f of fList) {
    const ims = imagesIndex?.[f.id] || [];

    // Karte
    const card = el("div", "folder-card");
    // Accessibility attributes
    card.setAttribute("role", "button");
    card.tabIndex = 0;
    card.setAttribute("aria-label", `Ordner ${f.name} öffnen`);
    // Inline Styles für Layout (damit es ohne CSS-Update funktioniert)
    card.style.cssText =
      "cursor:pointer; border:1px solid #444; border-radius:8px; padding:10px; margin-bottom:10px; background:#2a2a2a;";

    card.onclick = (e) => {
      // Klick auf Buttons ignorieren
      if (["BUTTON", "INPUT"].includes(e.target.tagName)) return;
      openFolder(f.id, f.name);
    };

    card.onkeydown = (e) => {
      if (e.key === "Enter" || e.key === " ") {
        if (["BUTTON", "INPUT"].includes(e.target.tagName)) return;
        e.preventDefault();
        openFolder(f.id, f.name);
      }
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
    spanMuted.textContent = ` (${ims.length} Medien)`;
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
    upInput.accept = "image/*,video/mp4,video/webm,video/quicktime";
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
        btnDel.disabled = true;
        btnDel.textContent = "Lösche...";
        try {
          await apiDelete(`/api/folders/${f.id}`);
          await reloadAll();
        } finally {
          btnDel.disabled = false;
          btnDel.textContent = "Ordner löschen";
        }
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
    frag.appendChild(card);
  }
  container.appendChild(frag);
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

  const selectAllRow = document.getElementById("selectAllRow");
  if (currentFolderImages.length === 0) {
    if (selectAllRow) selectAllRow.style.display = "none";
    const emptyMsg = document.createElement("p");
    emptyMsg.className = "muted";
    emptyMsg.style.cssText = "margin: 15px;";
    emptyMsg.textContent =
      "Dieser Ordner ist noch leer. Bitte lade Bilder hoch.";
    grid.appendChild(emptyMsg);
    return;
  }
  if (selectAllRow) selectAllRow.style.display = "";

  // ⚡ Bolt: Use DocumentFragment to batch DOM insertions and prevent excessive reflows
  const frag = document.createDocumentFragment();
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
    check.setAttribute("aria-label", `Bild ${im.filename || "auswählen"}`);
    check.onchange = () => toggleSelection(im.id);

    // Dataset ID speichern für schnelles UI Update
    wrap.dataset.imgid = im.id;

    wrap.appendChild(content);
    wrap.appendChild(check);
    frag.appendChild(wrap);
  }
  grid.appendChild(frag);
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
  // ⚡ Bolt: Prefer O(1) targeted DOM query to update a single element instead of O(N) querySelectorAll + loop
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

function renderEventsList() {
  const container = document.getElementById("eventsList");
  if (!container) return;

  container.innerHTML = "";
  const items = config.events?.items || [];

  if (items.length === 0) {
    const empty = document.createElement("div");
    empty.className = "muted";
    empty.textContent = "Keine Termine vorhanden.";
    container.appendChild(empty);
    return;
  }

  const frag = document.createDocumentFragment();
  items.forEach((item, index) => {
    const row = document.createElement("div");
    row.style.cssText =
      "display: flex; justify-content: space-between; align-items: center; background: #2a2a2a; padding: 8px 12px; border-radius: 4px; border: 1px solid #444; min-height: 40px;";

    // Parsing existing item to extract date and text for pre-filling
    let dateStr = "";
    let textStr = "";
    const match = item.match(/^(\d{2}\.\d{2}\.\d{4})\s+(.*)$/);
    if (match) {
      dateStr = match[1];
      textStr = match[2];
    } else {
      textStr = item;
    }

    const viewMode = document.createElement("div");
    viewMode.style.cssText =
      "display: flex; justify-content: space-between; align-items: center; width: 100%;";

    const textSpan = document.createElement("span");
    textSpan.textContent = item;

    const actionsDiv = document.createElement("div");
    actionsDiv.style.cssText = "display: flex; gap: 8px;";

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "btn";
    editBtn.textContent = "Bearbeiten";
    editBtn.style.padding = "4px 8px";
    editBtn.style.fontSize = "12px";
    editBtn.setAttribute("aria-label", `Termin bearbeiten: ${item}`);

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "btn";
    delBtn.textContent = "Löschen";
    delBtn.style.padding = "4px 8px";
    delBtn.style.fontSize = "12px";
    delBtn.setAttribute("aria-label", `Termin löschen: ${item}`);
    delBtn.onclick = () => {
      config.events.items.splice(index, 1);
      renderEventsList();
    };

    actionsDiv.appendChild(editBtn);
    actionsDiv.appendChild(delBtn);

    viewMode.appendChild(textSpan);
    viewMode.appendChild(actionsDiv);

    // Edit Mode container
    const editMode = document.createElement("div");
    editMode.style.cssText =
      "display: none; justify-content: space-between; align-items: center; width: 100%; gap: 8px;";

    const editDateInput = document.createElement("input");
    editDateInput.type = "date";
    editDateInput.className = "input";
    editDateInput.style.padding = "4px";
    editDateInput.style.fontSize = "12px";
    editDateInput.style.width = "110px";
    editDateInput.style.flex = "0 0 auto";
    if (match) {
      const parts = dateStr.split(".");
      editDateInput.value = `${parts[2]}-${parts[1]}-${parts[0]}`;
    }

    const editTextInput = document.createElement("input");
    editTextInput.type = "text";
    editTextInput.className = "input";
    editTextInput.value = textStr;
    editTextInput.style.padding = "4px";
    editTextInput.style.fontSize = "12px";
    editTextInput.style.flex = "1";
    editTextInput.style.minWidth = "100px";

    const editActionsDiv = document.createElement("div");
    editActionsDiv.style.cssText = "display: flex; gap: 8px;";

    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "btn primary";
    saveBtn.textContent = "Speichern";
    saveBtn.style.padding = "4px 8px";
    saveBtn.style.fontSize = "12px";

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "btn";
    cancelBtn.textContent = "Abbrechen";
    cancelBtn.style.padding = "4px 8px";
    cancelBtn.style.fontSize = "12px";

    editActionsDiv.appendChild(saveBtn);
    editActionsDiv.appendChild(cancelBtn);

    editMode.appendChild(editDateInput);
    editMode.appendChild(editTextInput);
    editMode.appendChild(editActionsDiv);

    // Toggle logic
    editBtn.onclick = () => {
      viewMode.style.display = "none";
      editMode.style.display = "flex";
    };

    cancelBtn.onclick = () => {
      editMode.style.display = "none";
      viewMode.style.display = "flex";
      // Reset values to original
      if (match) {
        const parts = dateStr.split(".");
        editDateInput.value = `${parts[2]}-${parts[1]}-${parts[0]}`;
      } else {
        editDateInput.value = "";
      }
      editTextInput.value = textStr;
    };

    saveBtn.onclick = () => {
      const newDateVal = editDateInput.value;
      const newTextVal = editTextInput.value.trim();

      if (!newDateVal || !newTextVal) {
        showToast("Bitte Datum und Beschreibung eingeben.");
        return;
      }

      const parts = newDateVal.split("-");
      if (parts.length === 3) {
        const formattedDate = `${parts[2]}.${parts[1]}.${parts[0]}`;
        const newItem = `${formattedDate} ${newTextVal}`;
        config.events.items[index] = newItem;

        config.events.items.sort((a, b) => {
          const parseDate = (str) => {
            const m = str.match(/^(\d{2})\.(\d{2})\.(\d{4})/);
            if (!m) return 0;
            return new Date(`${m[3]}-${m[2]}-${m[1]}`).getTime();
          };
          return parseDate(a) - parseDate(b);
        });

        renderEventsList();
      }
    };

    row.appendChild(viewMode);
    row.appendChild(editMode);
    frag.appendChild(row);
  });

  container.appendChild(frag);
}

function bindButtons() {
  // Event hinzufügen Button
  const btnAddEvent = document.getElementById("btnAddEvent");
  if (btnAddEvent) {
    btnAddEvent.onclick = () => {
      const dateInput = document.getElementById("newEventDate");
      const textInput = document.getElementById("newEventText");

      const dateVal = dateInput.value;
      const textVal = textInput.value.trim();

      if (!dateVal || !textVal) {
        showToast("Bitte Datum und Beschreibung eingeben.");
        return;
      }

      // Parse YYYY-MM-DD to DD.MM.YYYY
      const parts = dateVal.split("-");
      if (parts.length === 3) {
        const formattedDate = `${parts[2]}.${parts[1]}.${parts[0]}`;
        const newItem = `${formattedDate} ${textVal}`;

        if (!config.events) config.events = {};
        if (!config.events.items) config.events.items = [];

        config.events.items.push(newItem);

        // Optional: Sort items by date
        config.events.items.sort((a, b) => {
          const parseDate = (str) => {
            const match = str.match(/^(\d{2})\.(\d{2})\.(\d{4})/);
            if (!match) return 0;
            return new Date(`${match[3]}-${match[2]}-${match[1]}`).getTime();
          };
          return parseDate(a) - parseDate(b);
        });

        renderEventsList();

        // Reset inputs
        dateInput.value = "";
        textInput.value = "";
      }
    };
  }

  // Passwort Buttons
  const btnSetPw = document.getElementById("btnSetPw");
  const inputPw = document.getElementById("adminPw");

  btnSetPw.onclick = async () => {
    adminPw = inputPw.value || "";
    localStorage.setItem("kita_admin_pw", adminPw);
    btnSetPw.disabled = true;
    btnSetPw.textContent = "Prüfe...";
    try {
      await reloadAll();
    } catch (e) {
      setAuthStatus(false);
    } finally {
      btnSetPw.disabled = false;
      btnSetPw.textContent = "Setzen";
    }
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
  const btnReload = document.getElementById("btnReload");
  btnReload.onclick = async () => {
    btnReload.disabled = true;
    btnReload.textContent = "Lade...";
    try {
      await reloadAll();
    } catch (e) {
      setAuthStatus(false);
    } finally {
      btnReload.disabled = false;
      btnReload.textContent = "Neu laden";
    }
  };

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
      btnCreate.disabled = true;
      btnCreate.textContent = "Erstelle...";
      try {
        await apiPost("/api/folders", { name });
        inpNewFolder.value = "";
        showToast(`Ordner "${name}" erstellt!`);
        await reloadAll();
      } finally {
        btnCreate.disabled = false;
        btnCreate.textContent = "Ordner anlegen";
      }
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
