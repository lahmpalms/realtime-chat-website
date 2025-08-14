import { getConfig } from '@/lib/config';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogFields {
  [key: string]: unknown;
}

function shouldLog(level: LogLevel): boolean {
  const { logging } = getConfig();
  const order: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };
  return order[level] >= order[logging.level];
}

function consoleSafe(args: unknown[]) {
  try {
    // Avoid logging sensitive env or tokens
    return args.map((a) => {
      if (typeof a === 'string') {
        return a.replace(/(apiKey|token|secret)=([^&\s]+)/gi, '$1=****');
      }
      return a;
    });
  } catch {
    return args;
  }
}

export const logger = {
  debug(message: string, fields?: LogFields) {
    const { logging } = getConfig();
    if (logging.enableConsole && shouldLog('debug')) {
      // eslint-disable-next-line no-console
      console.debug('[debug]', message, fields ? consoleSafe([fields]) : '');
    }
  },
  info(message: string, fields?: LogFields) {
    const { logging } = getConfig();
    if (logging.enableConsole && shouldLog('info')) {
      // eslint-disable-next-line no-console
      console.info('[info]', message, fields ? consoleSafe([fields]) : '');
    }
  },
  warn(message: string, fields?: LogFields) {
    const { logging } = getConfig();
    if (logging.enableConsole && shouldLog('warn')) {
      // eslint-disable-next-line no-console
      console.warn('[warn]', message, fields ? consoleSafe([fields]) : '');
    }
  },
  error(message: string, fields?: LogFields) {
    const { logging } = getConfig();
    if (logging.enableConsole && shouldLog('error')) {
      // eslint-disable-next-line no-console
      console.error('[error]', message, fields ? consoleSafe([fields]) : '');
    }
    // Remote logging hook (Sentry) wired later
  },
};


