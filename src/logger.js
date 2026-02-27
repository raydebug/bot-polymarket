function ts() {
  return new Date().toISOString();
}

function log(level, message, meta) {
  if (meta) {
    console.log(`[${ts()}] [${level}] ${message}`, meta);
    return;
  }
  console.log(`[${ts()}] [${level}] ${message}`);
}

module.exports = {
  info: (msg, meta) => log("INFO", msg, meta),
  warn: (msg, meta) => log("WARN", msg, meta),
  error: (msg, meta) => log("ERROR", msg, meta),
};
