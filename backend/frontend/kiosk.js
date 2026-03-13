import { markdownToHtml, wxCodeToLabel, clamp } from "./utils.js";

let state = null;
let ws = null;
let tickerAnim = null;

function setTheme(theme) {
  document.body.dataset.theme = theme || "mint";
}

function el(tag, cls) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  return e;
}

function setClock() {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  document.getElementById("clock").textContent = `${hh}:${mm}`;
  const dateFmt = d.toLocaleDateString("de-DE", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "2-digit",
  });
  document.getElementById("date").textContent = dateFmt;
}

function buildTextPanel(cfg) {
  const wrap = el("div", "kioskText");
  const h1 = el("h1");
  h1.textContent = cfg.text_panel?.title || "Info";
  wrap.appendChild(h1);
  const html = markdownToHtml(cfg.text_panel?.markdown || "");
  const content = el("div");
  content.innerHTML = html;
  wrap.appendChild(content);
  return wrap;
}

function pickCarouselImages(cfg, folders, imagesIndex) {
  let folderIds = [];
  if (cfg.carousel?.folders === "all") {
    folderIds = folders.map((f) => f.id);
  } else if (Array.isArray(cfg.carousel?.folders)) {
    folderIds = cfg.carousel.folders;
  }

  // ⚡ Bolt: Cache folders in a Map to replace O(N^2) search with O(N) lookup
  const folderMap = new Map();
  for (let i = 0; i < folders.length; i++) {
    folderMap.set(folders[i].id, folders[i]);
  }

  const list = [];
  for (const fid of folderIds) {
    const folder = folderMap.get(fid);
    if (!folder) continue;
    const ims = imagesIndex?.[fid] || [];
    for (const im of ims) {
      list.push({
        ...im,
        type: im.type || "image",
        folder_id: fid,
        folder_slug: folder.slug,
        folder_name: folder.name,
        url: `/media/${folder.slug}/${im.filename}`,
      });
    }
  }
  return list;
}

function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildCarousel(cfg, folders, imagesIndex) {
  const container = el("div", "carousel");

  const slides = [];
  let images = pickCarouselImages(cfg, folders, imagesIndex);
  if (cfg.carousel?.shuffle) images = shuffleInPlace(images);
  if (images.length === 0) {
    const empty = el("div", "kioskText");
    empty.innerHTML = `<h1>Keine Bilder</h1><p>Bitte in der Adminseite einen Ordner anlegen und Bilder hochladen.</p>`;
    return empty;
  }

  if (images.length === 1) {
    const item = images[0];
    const s = el("div", "slide active"); // active immediately

    const cap = el("div", "caption");
    cap.textContent = item.folder_name;

    if (item.type === "video") {
      const vid = document.createElement("video");
      vid.src = item.url;
      vid.style.width = "100%";
      vid.style.height = "100%";
      vid.style.objectFit = "cover";
      vid.autoplay = true;
      vid.loop = true;
      vid.muted = false;
      s.appendChild(vid);
    } else {
      const img = document.createElement("img");
      img.src = item.url;
      img.alt = ""; // Decorative carousel image
      img.style.width = "100%";
      img.style.height = "100%";
      img.style.objectFit = "cover";
      s.appendChild(img);
    }
    s.appendChild(cap);
    container.appendChild(s);
    return container;
  }

  // two-slide crossfade pool (more performant)
  for (let i = 0; i < 2; i++) {
    const s = el("div", "slide");

    const img = document.createElement("img");
    img.alt = ""; // Decorative carousel image
    img.loading = "eager";
    img.decoding = "async";

    const vid = document.createElement("video");
    vid.style.display = "none";
    vid.style.width = "100%";
    vid.style.height = "100%";
    vid.style.objectFit = "cover";
    vid.preload = "auto";

    const cap = el("div", "caption");

    s.appendChild(img);
    s.appendChild(vid);
    s.appendChild(cap);
    container.appendChild(s);
    slides.push({ root: s, img, vid, cap });
  }

  let idx = 0;
  let active = 0;

  function setSlide(slot, image) {
    if (image.type === "video") {
      slot.img.style.display = "none";
      slot.vid.style.display = "block";
      slot.vid.src = image.url;
      slot.vid.muted = false;
    } else {
      slot.vid.style.display = "none";
      slot.img.style.display = "block";
      slot.img.src = image.url;
      slot.vid.src = ""; // unload video
    }
    slot.cap.textContent = image.folder_name;
  }

  setSlide(slides[0], images[0]);
  slides[0].root.classList.add("active");

  const interval =
    clamp(parseInt(cfg.carousel?.interval_sec ?? 10, 10), 3, 120) * 1000;
  let timer = null;

  function scheduleNext() {
    idx = (idx + 1) % images.length;
    const nextItem = images[idx];
    const nextSlot = 1 - active;

    setSlide(slides[nextSlot], nextItem);

    slides[nextSlot].root.classList.add("active");
    slides[active].root.classList.remove("active");

    // cleanup previous video after transition
    const prevSlot = active;
    setTimeout(() => {
      if (slides[prevSlot].vid) {
        slides[prevSlot].vid.pause();
        slides[prevSlot].vid.currentTime = 0;
      }
    }, 1000);

    active = nextSlot;

    if (nextItem.type === "video") {
      const vid = slides[nextSlot].vid;
      vid.currentTime = 0;
      vid.muted = false;

      const onEnded = () => {
        vid.removeEventListener("ended", onEnded);
        scheduleNext();
      };
      vid.addEventListener("ended", onEnded);

      vid.play().catch((e) => {
        console.error("Video play failed", e);
        timer = setTimeout(scheduleNext, interval);
      });
    } else {
      timer = setTimeout(scheduleNext, interval);
    }
  }

  // Start logic
  const firstItem = images[0];
  if (firstItem.type === "video") {
    const vid = slides[0].vid;
    vid.currentTime = 0;
    vid.muted = false;
    const onEnded = () => {
      vid.removeEventListener("ended", onEnded);
      scheduleNext();
    };
    vid.addEventListener("ended", onEnded);
    vid.play().catch((e) => {
      console.error("First video play failed", e);
      timer = setTimeout(scheduleNext, interval);
    });
  } else {
    timer = setTimeout(scheduleNext, interval);
  }

  // cleanup hook
  container.__destroy = () => {
    clearTimeout(timer);
    slides.forEach((s) => {
      if (s.vid) s.vid.pause();
    });
  };

  return container;
}

function buildInfoColumn(cfg, weather) {
  const col = document.getElementById("infoColumn");
  col.innerHTML = "";

  // ⚡ Bolt: Use DocumentFragment to batch DOM insertions and prevent excessive reflows
  const frag = document.createDocumentFragment();

  // Weather
  if (cfg.info_boxes?.weather_enabled) {
    const box = el("div", "box");
    const h = el("h3");
    h.textContent = `Wetter – ${cfg.info_boxes?.weather?.city || ""}`.trim();
    box.appendChild(h);

    if (weather?.error) {
      const p = el("div", "small");
      p.textContent = "Wetterdaten nicht verfügbar.";
      box.appendChild(p);
    } else if (weather?.current) {
      const temp = el("div", "big");
      temp.textContent = `${Math.round(weather.current.temp)}°`;
      box.appendChild(temp);

      const label = el("div", "small");
      const wx = wxCodeToLabel(weather.current.code);
      label.textContent = `${wx} · Wind ${Math.round(weather.current.wind)} km/h`;
      box.appendChild(label);

      if (Array.isArray(weather.daily) && weather.daily[0]) {
        const d0 = weather.daily[0];
        const small = el("div", "small");
        small.textContent = `Heute: ${Math.round(d0.tmin)} – ${Math.round(d0.tmax)}°`;
        box.appendChild(small);
      }
    } else {
      const p = el("div", "small");
      p.textContent = "Lade Wetter…";
      box.appendChild(p);
    }
    frag.appendChild(box);
  }

  const eventBox = buildEventBox(cfg);
  if (eventBox) frag.appendChild(eventBox);

  // Ampel
  const ab = el("div", "box");
  const ah = el("h3");
  ah.textContent = "Betreuungsampel";
  ab.appendChild(ah);

  const row = el("div", "ampel");

  const lights = el("div", "lights");
  const lG = el("div", "light");
  const lY = el("div", "light");
  const lR = el("div", "light");
  lights.append(lG, lY, lR);

  const status = (cfg.info_boxes?.ampel?.status || "green").toLowerCase();
  if (status === "green") lG.classList.add("on", "green");
  if (status === "yellow") lY.classList.add("on", "yellow");
  if (status === "red") lR.classList.add("on", "red");

  row.appendChild(lights);

  const txt = el("div");
  const lab = el("div", "ampelLabel");
  lab.textContent = cfg.info_boxes?.ampel?.label || "—";
  const det = el("div", "ampelDetail");
  det.innerHTML = markdownToHtml(cfg.info_boxes?.ampel?.details || "");
  txt.append(lab, det);
  row.appendChild(txt);

  ab.appendChild(row);
  frag.appendChild(ab);

  // Custom boxes
  const custom = cfg.info_boxes?.custom || [];
  for (const c of custom) {
    if (!c?.enabled) continue;
    const b = el("div", "box");
    const h = el("h3");
    h.textContent = c.title || "Info";
    b.appendChild(h);
    const d = el("div", "small");
    d.innerHTML = markdownToHtml(c.markdown || "");
    b.appendChild(d);
    frag.appendChild(b);
  }

  col.appendChild(frag);
}

function stopTicker() {
  const track = document.getElementById("tickerTrack");
  if (track) track.innerHTML = "";
  if (tickerAnim) {
    cancelAnimationFrame(tickerAnim);
    tickerAnim = null;
  }
}

function startTicker(cfg) {
  const footer = document.getElementById("ticker");
  const enabled = !!cfg.ticker?.enabled && !!cfg.layout?.show_ticker;
  footer.classList.toggle("enabled", enabled);
  if (!enabled) {
    stopTicker();
    return;
  }

  const speed = clamp(parseInt(cfg.ticker?.speed ?? 70, 10), 20, 220); // speed is pixels per second approx, earlier it was per frame roughly
  const track = document.getElementById("tickerTrack");
  track.innerHTML = "";

  const wrapper = el("div", "tickerWrapper");
  const content = el("div", "tickerContent");

  const items = cfg.ticker?.items || [];
  if (items.length === 0) {
    content.innerHTML = `<span>—</span>`;
  } else {
    for (const it of items) {
      const span = document.createElement("span");
      span.textContent = it;
      content.appendChild(span);
      const sep = document.createElement("span");
      sep.textContent = "•";
      sep.className = "sep";
      content.appendChild(sep);
    }
  }

  // To create a seamless loop, we need two identical content blocks side-by-side
  const contentClone = content.cloneNode(true);
  wrapper.appendChild(content);
  wrapper.appendChild(contentClone);
  track.appendChild(wrapper);

  // We wait a frame for the layout to measure the true width
  requestAnimationFrame(() => {
    const contentWidth = content.scrollWidth;
    // duration = total distance to move / speed
    // the distance to move is exactly one contentWidth (to loop)
    const duration = contentWidth / speed;
    wrapper.style.animation = `tickerMove ${duration}s linear infinite`;
  });
}

function destroyMainPanel(panel) {
  if (panel && panel.__destroy) panel.__destroy();
}

function buildEventBox(cfg) {
  if (!cfg.events?.enabled) return null;

  const box = el("div", "box");
  const h = el("h3");
  h.textContent = cfg.events?.title || "Termine";
  box.appendChild(h);

  const list = el("div", "eventList");
  const items = cfg.events?.items || [];

  // ⚡ Bolt: Use DocumentFragment to batch DOM insertions and prevent excessive reflows
  const frag = document.createDocumentFragment();

  // ⚡ Bolt: Cache regex and avoid intermediate object allocations in loop
  const eventDateRegex = /^(\d{1,2})\.(\d{1,2})\.(\d{4})(.*)$/;

  // Filter & Render
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Reset time to compare dates only
  const todayTime = today.getTime();

  let count = 0;
  for (const raw of items) {
    const parts = raw.match(eventDateRegex);
    if (!parts) continue; // Skip invalid format

    const d = parseInt(parts[1], 10);
    const m = parseInt(parts[2], 10) - 1; // JS months are 0-11
    const y = parseInt(parts[3], 10);
    const text = parts[4].trim();

    const fullDate = new Date(y, m, d);

    // Zeige Termin nur, wenn er heute oder in Zukunft ist
    if (fullDate.getTime() >= todayTime) {
      const row = el("div", "eventItem");

      const dateEl = el("div", "eventDate");
      // Formatiere Datum hübsch: 15.03.
      const dStr =
        String(d).padStart(2, "0") + "." + String(m + 1).padStart(2, "0") + ".";
      dateEl.textContent = dStr;

      const textEl = el("div", "eventText");
      textEl.textContent = text;

      row.append(dateEl, textEl);
      frag.appendChild(row);
      count++;
    }
  }

  list.appendChild(frag);

  if (count === 0) {
    const empty = el("div", "small");
    empty.textContent = "Aktuell keine Termine.";
    box.appendChild(empty);
  } else {
    box.appendChild(list);
  }

  return box;
}

function render(state) {
  const cfg = state.config;
  setTheme(cfg.theme);

  // layout toggles
  const infoCol = document.getElementById("infoColumn");
  const layout = document.querySelector(".layout");

  infoCol.style.display = cfg.layout?.show_info_column ? "flex" : "none";

  // Apply aspect ratio
  const aspectRatio = cfg.layout?.image_aspect_ratio || "auto";
  const mainPanel = document.getElementById("mainPanel");

  if (aspectRatio === "16:9") {
    mainPanel.style.aspectRatio = "16 / 9";
  } else if (aspectRatio === "4:3") {
    mainPanel.style.aspectRatio = "4 / 3";
  } else {
    mainPanel.style.aspectRatio = "auto";
  }

  // Update grid layout depending on the ratio and info column status
  if (cfg.layout?.show_info_column) {
    if (aspectRatio === "auto") {
      layout.style.gridTemplateColumns = "1fr 280px";
    } else {
      // If a fixed aspect ratio is used, we let the main panel dictate its width via aspect-ratio + height (100%),
      // and let the info column fill the remaining 1fr space. Ensure min width of 280px for info.
      layout.style.gridTemplateColumns = "auto minmax(280px, 1fr)";
    }
  } else {
    if (aspectRatio === "auto") {
      layout.style.gridTemplateColumns = "1fr";
      mainPanel.style.margin = "0";
    } else {
      layout.style.gridTemplateColumns = "auto";
      // Center the panel if it has a specific ratio but no side panel
      layout.style.justifyContent = "center";
    }
  }

  // Handle justifyContent reset when info column is shown
  if (cfg.layout?.show_info_column) {
    layout.style.justifyContent = "initial";
  }

  // main content
  const main = document.getElementById("mainPanel");
  destroyMainPanel(main.firstChild);
  main.innerHTML = "";

  const mode = cfg.layout?.mode || "carousel";
  if (mode === "text") {
    main.appendChild(buildTextPanel(cfg));
  } else {
    main.appendChild(buildCarousel(cfg, state.folders, state.images));
  }

  buildInfoColumn(cfg, state.weather);
  startTicker(cfg);
}

async function fetchState() {
  const r = await fetch("/api/state", { cache: "no-store" });
  if (!r.ok) throw new Error("state load failed");
  return await r.json();
}

function connectWs() {
  try {
    const proto = location.protocol === "https:" ? "wss" : "ws";
    ws = new WebSocket(`${proto}://${location.host}/ws`);
    ws.onmessage = async (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === "refresh") {
          state = await fetchState();
          render(state);
        }
      } catch (_) {}
    };
    ws.onopen = () => {};
    ws.onclose = () => {
      // retry
      setTimeout(connectWs, 2000);
    };
  } catch (_) {}
}

async function init() {
  setClock();
  setInterval(setClock, 1000 * 5);

  state = await fetchState();
  render(state);
  connectWs();

  // polling fallback
  const poll = clamp(
    parseInt(state.config?.autorefresh?.poll_fallback_sec ?? 30, 10),
    5,
    300,
  );
  setInterval(async () => {
    try {
      const s2 = await fetchState();
      // naive diff: compare config string
      if (
        JSON.stringify(s2.config) !== JSON.stringify(state.config) ||
        JSON.stringify(s2.images) !== JSON.stringify(state.images) ||
        JSON.stringify(s2.weather) !== JSON.stringify(state.weather)
      ) {
        state = s2;
        render(state);
      }
    } catch (_) {}
  }, poll * 1000);
}

init().catch((err) => {
  const main = document.getElementById("mainPanel");
  main.innerHTML = "";
  const div = document.createElement("div");
  div.className = "kioskText";
  const h1 = document.createElement("h1");
  h1.textContent = "Fehler";
  const p = document.createElement("p");
  // 🛡️ Sentinel: Safe error rendering to prevent DOM-based XSS
  p.textContent = String(err);
  div.appendChild(h1);
  div.appendChild(p);
  main.appendChild(div);
});
