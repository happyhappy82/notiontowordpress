type LogLevel = "info" | "warn" | "error" | "debug";

function timestamp(): string {
  return new Date().toISOString();
}

function format(level: LogLevel, message: string, data?: Record<string, unknown>): string {
  const base = `[${timestamp()}] [${level.toUpperCase()}] ${message}`;
  if (data) {
    return `${base} ${JSON.stringify(data)}`;
  }
  return base;
}

export const logger = {
  info(message: string, data?: Record<string, unknown>) {
    console.log(format("info", message, data));
  },
  warn(message: string, data?: Record<string, unknown>) {
    console.warn(format("warn", message, data));
  },
  error(message: string, data?: Record<string, unknown>) {
    console.error(format("error", message, data));
  },
  debug(message: string, data?: Record<string, unknown>) {
    if (process.env.DEBUG) {
      console.debug(format("debug", message, data));
    }
  },
};
