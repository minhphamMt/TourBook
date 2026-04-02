const fs = require("fs");
const path = require("path");

const ROOT_DIR = process.cwd();
const SCAN_ROOTS = ["js", "css", "pages"];
const SCAN_EXTENSIONS = new Set([".js", ".css", ".html"]);

const MARKERS = {
  replacement: "\uFFFD",
  bomText: String.fromCharCode(0x00EF, 0x00BB, 0x00BF),
  mojibakeA: String.fromCharCode(0x00C3),
  mojibakeB: String.fromCharCode(0x00C2),
  mojibakeQuote: String.fromCharCode(0x00E2, 0x20AC),
  mojibakeEmoji: String.fromCharCode(0x00F0, 0x0178)
};

const SUSPICIOUS_PATTERNS = [
  { label: "replacement char", regex: new RegExp(MARKERS.replacement, "g") },
  { label: "double-encoded BOM", regex: new RegExp(MARKERS.bomText, "g") },
  { label: "UTF-8 mojibake A", regex: new RegExp(`${MARKERS.mojibakeA}.`, "g") },
  { label: "UTF-8 mojibake B", regex: new RegExp(`${MARKERS.mojibakeB}.`, "g") },
  { label: "smart-quote mojibake", regex: new RegExp(`${MARKERS.mojibakeQuote}[\\u0080-\\u00BF]?`, "g") },
  { label: "emoji mojibake", regex: new RegExp(`${MARKERS.mojibakeEmoji}[\\u0080-\\u00BF]?`, "g") }
];

function walk(dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
      continue;
    }
    if (SCAN_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      files.push(fullPath);
    }
  }
  return files;
}

function getLineNumber(content, index) {
  let line = 1;
  for (let i = 0; i < index; i += 1) {
    if (content.charCodeAt(i) === 10) line += 1;
  }
  return line;
}

function previewAt(content, index) {
  const start = Math.max(0, index - 24);
  const end = Math.min(content.length, index + 24);
  return content.slice(start, end).replace(/\r/g, "").replace(/\n/g, " ");
}

const findings = [];
for (const scanRoot of SCAN_ROOTS) {
  const absoluteRoot = path.join(ROOT_DIR, scanRoot);
  if (!fs.existsSync(absoluteRoot)) continue;
  for (const filePath of walk(absoluteRoot)) {
    const content = fs.readFileSync(filePath, "utf8");
    for (const pattern of SUSPICIOUS_PATTERNS) {
      pattern.regex.lastIndex = 0;
      const match = pattern.regex.exec(content);
      if (!match) continue;
      findings.push({
        filePath,
        label: pattern.label,
        line: getLineNumber(content, match.index),
        preview: previewAt(content, match.index)
      });
      break;
    }
  }
}

if (!findings.length) {
  console.log("Encoding check passed: no suspicious mojibake markers found in js/css/pages.");
  process.exit(0);
}

console.error("Encoding check failed. Suspicious text markers found:");
for (const finding of findings) {
  const relativePath = path.relative(ROOT_DIR, finding.filePath).replace(/\\/g, "/");
  console.error(`- ${relativePath}:${finding.line} [${finding.label}] ${finding.preview}`);
}
process.exit(1);
