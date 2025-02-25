/**
 * Simple logger module for consistent application logging
 */

/**
 * Log levels
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}

/**
 * Interface for log data
 */
interface LogData {
  [key: string]: any;
}

/**
 * Logger class for handling application logs
 */
export class Logger {
  private serviceName: string;

  constructor(serviceName: string = 'app') {
    this.serviceName = serviceName;
  }

  /**
   * Format a log message
   */
  private formatLog(level: LogLevel, message: string, data: LogData = {}): string {
    const timestamp = new Date().toISOString();
    const dataString = Object.keys(data).length ? ` ${JSON.stringify(data)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] [${this.serviceName}] ${message}${dataString}`;
  }

  /**
   * Log a debug message
   */
  debug(message: string, data: LogData = {}): void {
    if (process.env.LOG_LEVEL === 'debug') {
      console.debug(this.formatLog(LogLevel.DEBUG, message, data));
    }
  }

  /**
   * Log an info message
   */
  info(message: string, data: LogData = {}): void {
    if (['debug', 'info'].includes(process.env.LOG_LEVEL || 'info')) {
      console.info(this.formatLog(LogLevel.INFO, message, data));
    }
  }

  /**
   * Log a warning message
   */
  warn(message: string, data: LogData = {}): void {
    if (['debug', 'info', 'warn'].includes(process.env.LOG_LEVEL || 'info')) {
      console.warn(this.formatLog(LogLevel.WARN, message, data));
    }
  }

  /**
   * Log an error message
   */
  error(message: string, data: LogData = {}): void {
    console.error(this.formatLog(LogLevel.ERROR, message, data));
  }
}

// Default logger instance
export const logger = new Logger('search-service');

// Export a function to create new logger instances
export const createLogger = (serviceName: string): Logger => {
  return new Logger(serviceName);
}; 