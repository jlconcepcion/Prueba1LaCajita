const LOG_LEVELS = {
  DEBUG: 'DEBUG',
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR',
};

const isDevelopment = import.meta.env.DEV;

class Logger {
  constructor() {
    this.logs = [];
    this.maxLogs = 100;
  }

  _addLog(level, message, data) {
    const timestamp = new Date().toISOString();
    const logEntry = { timestamp, level, message, data };
    this.logs.push(logEntry);

    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    return logEntry;
  }

  debug(message, data) {
    const log = this._addLog(LOG_LEVELS.DEBUG, message, data);
    if (isDevelopment) console.debug(`[${log.timestamp}] ${message}`, data);
  }

  info(message, data) {
    const log = this._addLog(LOG_LEVELS.INFO, message, data);
    if (isDevelopment) console.info(`[${log.timestamp}] ${message}`, data);
  }

  warn(message, data) {
    const log = this._addLog(LOG_LEVELS.WARN, message, data);
    console.warn(`[${log.timestamp}] ${message}`, data);
  }

  error(message, error) {
    const log = this._addLog(LOG_LEVELS.ERROR, message, {
      message: error?.message,
      stack: error?.stack,
    });
    console.error(`[${log.timestamp}] ${message}`, error);
  }

  getLogs(level = null) {
    if (!level) return this.logs;
    return this.logs.filter(log => log.level === level);
  }

  clearLogs() {
    this.logs = [];
  }

  exportLogs() {
    return JSON.stringify(this.logs, null, 2);
  }
}

export const logger = new Logger();

export function captureError(error, context = '') {
  logger.error(`Error ${context}`, error);
}

export function trackEvent(eventName, data) {
  logger.info(`Event: ${eventName}`, data);
}
