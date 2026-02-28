const fs = require("fs");
const path = require("path");

const envPath = path.join(process.cwd(), ".env");

function readEnvLines() {
  if (!fs.existsSync(envPath)) return [];
  return fs.readFileSync(envPath, "utf8").split(/\r?\n/);
}

function updateEnvValues(updates) {
  const lines = readEnvLines();
  const keys = Object.keys(updates);
  const seen = new Set();

  const next = lines.map((line) => {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    if (!m) return line;
    const key = m[1];
    if (!(key in updates)) return line;
    seen.add(key);
    return `${key}=${String(updates[key] ?? "")}`;
  });

  for (const key of keys) {
    if (!seen.has(key)) next.push(`${key}=${String(updates[key] ?? "")}`);
  }

  const out = next.join("\n").replace(/\n*$/, "\n");
  fs.writeFileSync(envPath, out, "utf8");
}

module.exports = { envPath, updateEnvValues };
