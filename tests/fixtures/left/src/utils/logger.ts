export type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  prefix: string;
  message: string;
}

interface Logger {
  debug: (msg: string) => void;
  info: (msg: string) => void;
  warn: (msg: string) => void;
  error: (msg: string) => void;
  setLevel: (level: LogLevel) => void;
  getHistory: () => LogEntry[];
}

const history: LogEntry[] = [];

function formatTimestamp(): string {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, "0");
  const m = String(now.getMinutes()).padStart(2, "0");
  const s = String(now.getSeconds()).padStart(2, "0");
  const ms = String(now.getMilliseconds()).padStart(3, "0");
  return `${h}:${m}:${s}.${ms}`;
}

export function setupLogger(prefix: string, minLevel: LogLevel = "debug"): Logger {
  let currentLevel = minLevel;

  const shouldLog = (level: LogLevel): boolean => {
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[currentLevel];
  };

  const log = (level: LogLevel, msg: string) => {
    const entry: LogEntry = {
      timestamp: formatTimestamp(),
      level,
      prefix,
      message: msg,
    };
    history.push(entry);

    if (!shouldLog(level)) return;

    const levelStr = level.toUpperCase().padEnd(5);
    console.log(`${entry.timestamp} [${levelStr}] [${prefix}] ${msg}`);
  };

  return {
    debug: (msg) => log("debug", msg),
    info: (msg) => log("info", msg),
    warn: (msg) => log("warn", msg),
    error: (msg) => log("error", msg),
    setLevel: (level) => {
      currentLevel = level;
    },
    getHistory: () => [...history],
  };
}

export function clearHistory(): void {
  history.length = 0;
}

export function filterHistory(level: LogLevel): LogEntry[] {
  return history.filter(
    (entry) =>
      LOG_LEVEL_PRIORITY[entry.level] >= LOG_LEVEL_PRIORITY[level],
  );
}

export function formatLogEntry(entry: LogEntry): string {
  const levelStr = entry.level.toUpperCase().padEnd(5);
  return `${entry.timestamp} [${levelStr}] [${entry.prefix}] ${entry.message}`;
}

export function createConsoleTransport() {
  return {
    write(entry: LogEntry) {
      const formatted = formatLogEntry(entry);
      switch (entry.level) {
        case "debug":
          console.debug(formatted);
          break;
        case "info":
          console.info(formatted);
          break;
        case "warn":
          console.warn(formatted);
          break;
        case "error":
          console.error(formatted);
          break;
      }
    },
  };
}
