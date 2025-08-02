import { EventEmitter } from 'events';

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

class Logger {
  private level: LogLevel;
  private eventEmitter: EventEmitter;

  constructor() {
    this.level = this.getLogLevelFromEnv();
    this.eventEmitter = new EventEmitter();
  }

  private getLogLevelFromEnv(): LogLevel {
    const envLevel = process.env.LOG_LEVEL?.toUpperCase();
    switch (envLevel) {
      case 'ERROR': return LogLevel.ERROR;
      case 'WARN': return LogLevel.WARN;
      case 'INFO': return LogLevel.INFO;
      case 'DEBUG': return LogLevel.DEBUG;
      default: return LogLevel.INFO;
    }
  }

  private formatMessage(level: string, message: string, meta?: any): string {
    const timestamp = new Date().toISOString();
    const metaString = meta ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] [${level}] ${message}${metaString}`;
  }

  error(message: string, error?: any): void {
    if (this.level >= LogLevel.ERROR) {
      console.error(this.formatMessage('ERROR', message, error));
      this.eventEmitter.emit('log', { level: 'error', message, error });
    }
  }

  warn(message: string, meta?: any): void {
    if (this.level >= LogLevel.WARN) {
      console.warn(this.formatMessage('WARN', message, meta));
      this.eventEmitter.emit('log', { level: 'warn', message, meta });
    }
  }

  info(message: string, meta?: any): void {
    if (this.level >= LogLevel.INFO) {
      console.log(this.formatMessage('INFO', message, meta));
      this.eventEmitter.emit('log', { level: 'info', message, meta });
    }
  }

  debug(message: string, meta?: any): void {
    if (this.level >= LogLevel.DEBUG) {
      console.log(this.formatMessage('DEBUG', message, meta));
      this.eventEmitter.emit('log', { level: 'debug', message, meta });
    }
  }

  // For modules that need to listen to log events
  on(event: string, handler: Function): void {
    this.eventEmitter.on(event, handler as any);
  }
}

// Export singleton instance
export const logger = new Logger();
