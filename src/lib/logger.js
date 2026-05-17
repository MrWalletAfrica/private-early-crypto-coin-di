export function safeErr(err) {
  return (
    err?.response?.data?.error?.message ||
    err?.response?.data?.message ||
    err?.message ||
    String(err)
  );
}

function write(level, message, meta = {}) {
  const row = {
    level,
    message,
    ...meta,
    ts: new Date().toISOString(),
  };

  const out = JSON.stringify(row);
  if (level === "error") console.error(out);
  else if (level === "warn") console.warn(out);
  else console.log(out);
}

export const log = {
  info: (message, meta = {}) => write("info", message, meta),
  warn: (message, meta = {}) => write("warn", message, meta),
  error: (message, meta = {}) => write("error", message, meta),
};
