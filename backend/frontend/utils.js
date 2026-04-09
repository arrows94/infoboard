export function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

// ⚡ Bolt: Cache regex patterns globally to avoid recompilation inside hot function
const NEWLINE_REGEX = /\r\n/g;
const AMP_REGEX = /&/g;
const LT_REGEX = /</g;
const GT_REGEX = />/g;
const BOLD_REGEX = /\*\*(.+?)\*\*/g;
const ITALIC_REGEX = /\*(.+?)\*/g;

// tiny markdown subset: headings, bold, italic, lists, paragraphs
export function markdownToHtml(md) {
  md = (md || "").replace(NEWLINE_REGEX, "\n");
  const lines = md.split("\n");
  let html = "";
  let inList = false;

  function esc(s) {
    return s
      .replace(AMP_REGEX, "&amp;")
      .replace(LT_REGEX, "&lt;")
      .replace(GT_REGEX, "&gt;");
  }

  function inline(s) {
    // bold ** **
    s = esc(s);
    s = s.replace(BOLD_REGEX, "<strong>$1</strong>");
    s = s.replace(ITALIC_REGEX, "<em>$1</em>");
    return s;
  }

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      if (inList) {
        html += "</ul>";
        inList = false;
      }
      continue;
    }
    if (line.startsWith("### ")) {
      if (inList) {
        html += "</ul>";
        inList = false;
      }
      html += `<h3>${inline(line.slice(4))}</h3>`;
      continue;
    }
    if (line.startsWith("## ")) {
      if (inList) {
        html += "</ul>";
        inList = false;
      }
      html += `<h2>${inline(line.slice(3))}</h2>`;
      continue;
    }
    if (line.startsWith("# ")) {
      if (inList) {
        html += "</ul>";
        inList = false;
      }
      html += `<h1>${inline(line.slice(2))}</h1>`;
      continue;
    }
    if (line.startsWith("- ")) {
      if (!inList) {
        html += "<ul>";
        inList = true;
      }
      html += `<li>${inline(line.slice(2))}</li>`;
      continue;
    }
    if (inList) {
      html += "</ul>";
      inList = false;
    }
    html += `<p>${inline(line)}</p>`;
  }
  if (inList) html += "</ul>";
  return html;
}

const WX_ICONS = {
  sun: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="wx-icon"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>`,
  cloud: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="wx-icon"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg>`,
  cloudRain: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="wx-icon"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M16 14v6"/><path d="M8 14v6"/><path d="M12 16v6"/></svg>`,
  cloudSnow: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="wx-icon"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M8 15h.01"/><path d="M8 19h.01"/><path d="M12 17h.01"/><path d="M12 21h.01"/><path d="M16 15h.01"/><path d="M16 19h.01"/></svg>`,
  cloudLightning: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="wx-icon"><path d="M19 16.9A5 5 0 0 0 18 7h-1.26a8 8 0 1 0-11.62 9"/><polyline points="13 11 9 17 15 17 11 23"/></svg>`,
  fog: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="wx-icon"><path d="M4 8h16"/><path d="M4 16h16"/><path d="M8 12h8"/></svg>`,
};

export const windIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="wx-icon wind-icon"><path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2"/><path d="M9.6 4.6A2 2 0 1 1 11 8H2"/><path d="M12.6 19.4A2 2 0 1 0 14 16H2"/></svg>`;

export function wxCodeToIcon(code) {
  const c = Number(code);
  if (Number.isNaN(c)) return WX_ICONS.sun;

  if (c === 0 || c === 1) return WX_ICONS.sun;
  if (c === 2 || c === 3) return WX_ICONS.cloud;
  if (c === 45 || c === 48) return WX_ICONS.fog;
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(c)) return WX_ICONS.cloudRain;
  if ([71, 73, 75, 85, 86].includes(c)) return WX_ICONS.cloudSnow;
  if ([95, 96, 99].includes(c)) return WX_ICONS.cloudLightning;

  return WX_ICONS.sun;
}

// Open-Meteo weather_code -> short German label (subset)
export function wxCodeToLabel(code) {
  const c = Number(code);
  if (Number.isNaN(c)) return "—";
  const map = {
    0: "Klar",
    1: "Überwiegend klar",
    2: "Wolkig",
    3: "Bedeckt",
    45: "Nebel",
    48: "Raureif-Nebel",
    51: "Niesel leicht",
    53: "Niesel",
    55: "Niesel stark",
    61: "Regen leicht",
    63: "Regen",
    65: "Regen stark",
    71: "Schnee leicht",
    73: "Schnee",
    75: "Schnee stark",
    80: "Schauer leicht",
    81: "Schauer",
    82: "Schauer stark",
    95: "Gewitter",
  };
  return map[c] || "Wetter";
}
