export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
  fatal: 5,
};

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  prefix: string;
  message: string;
  meta?: Record<string, unknown>;
}

type Transport = {
  write: (entry: LogEntry) => void;
};

interface Logger {
  trace: (msg: string, meta?: Record<string, unknown>) => void;
  debug: (msg: string, meta?: Record<string, unknown>) => void;
  info: (msg: string, meta?: Record<string, unknown>) => void;
  warn: (msg: string, meta?: Record<string, unknown>) => void;
  error: (msg: string, meta?: Record<string, unknown>) => void;
  fatal: (msg: string, meta?: Record<string, unknown>) => void;
  setLevel: (level: LogLevel) => void;
  addTransport: (transport: Transport) => void;
  child: (childPrefix: string) => Logger;
  getHistory: () => LogEntry[];
}

const history: LogEntry[] = [];
const MAX_HISTORY = 10000;

function formatTimestamp(): string {
  return new Date().toISOString();
}

export function setupLogger(
  prefix: string,
  minLevel: LogLevel = "debug",
): Logger {
  let currentLevel = minLevel;
  const transports: Transport[] = [];

  const shouldLog = (level: LogLevel): boolean => {
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[currentLevel];
  };

  const log = (level: LogLevel, msg: string, meta?: Record<string, unknown>) => {
    const entry: LogEntry = {
      timestamp: formatTimestamp(),
      level,
      prefix,
      message: msg,
      meta,
    };

    if (history.length >= MAX_HISTORY) {
      history.splice(0, Math.floor(MAX_HISTORY / 4));
    }
    history.push(entry);

    if (!shouldLog(level)) return;

    for (const transport of transports) {
      transport.write(entry);
    }

    const levelStr = level.toUpperCase().padEnd(5);
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : "";
    console.log(`${entry.timestamp} [${levelStr}] [${prefix}] ${msg}${metaStr}`);
  };

  const logger: Logger = {
    trace: (msg, meta) => log("trace", msg, meta),
    debug: (msg, meta) => log("debug", msg, meta),
    info: (msg, meta) => log("info", msg, meta),
    warn: (msg, meta) => log("warn", msg, meta),
    error: (msg, meta) => log("error", msg, meta),
    fatal: (msg, meta) => log("fatal", msg, meta),
    setLevel: (level) => {
      currentLevel = level;
    },
    addTransport: (transport) => {
      transports.push(transport);
    },
    child: (childPrefix) => {
      return setupLogger(`${prefix}:${childPrefix}`, currentLevel);
    },
    getHistory: () => [...history],
  };

  return logger;
}

export function clearHistory(): void {
  history.length = 0;
}

export function filterHistory(
  level: LogLevel,
  prefix?: string,
): LogEntry[] {
  return history.filter((entry) => {
    const levelMatch =
      LOG_LEVEL_PRIORITY[entry.level] >= LOG_LEVEL_PRIORITY[level];
    const prefixMatch = prefix ? entry.prefix.startsWith(prefix) : true;
    return levelMatch && prefixMatch;
  });
}

export function formatLogEntry(entry: LogEntry): string {
  const levelStr = entry.level.toUpperCase().padEnd(5);
  const metaStr = entry.meta ? ` ${JSON.stringify(entry.meta)}` : "";
  return `${entry.timestamp} [${levelStr}] [${entry.prefix}] ${entry.message}${metaStr}`;
}

export function createConsoleTransport(): Transport {
  return {
    write(entry: LogEntry) {
      const formatted = formatLogEntry(entry);
      switch (entry.level) {
        case "trace":
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
        case "fatal":
          console.error(formatted);
          break;
      }
    },
  };
}

export function createJsonTransport(writeFn: (json: string) => void): Transport {
  return {
    write(entry: LogEntry) {
      writeFn(JSON.stringify(entry));
    },
  };
}
