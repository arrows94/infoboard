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
