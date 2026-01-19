/**
 * Serviço de logging estruturado para AIChatFlow
 * Implementa logging com níveis, contexto e suporte para diferentes transportes
 */

import winston from 'winston';
import path from 'path';
import fs from 'fs';

// Tipos de log
type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'verbose';

interface LogContext {
  [key: string]: any;
}

interface LogOptions {
  level?: LogLevel;
  context?: LogContext;
  error?: Error;
  stackTrace?: boolean;
}

class LoggerService {
  private logger: winston.Logger;
  private serviceName: string;

  constructor(serviceName: string = 'AIChatFlow') {
    this.serviceName = serviceName;
    this.logger = this.createLogger();
  }

  private createLogger(): winston.Logger {
    // Criar diretório de logs se não existir
    const logDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    // Formato de log
    const logFormat = winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.splat(),
      winston.format.json()
    );

    // Transportes
    const transports = [
      // Console transport
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.printf((info) => {
            const { timestamp, level, message, service, context, stack, ...rest } = info;
            let logMessage = `${timestamp} [${level}] ${service || this.serviceName}: ${message}`;
            
            if (context && Object.keys(context).length > 0) {
              logMessage += ` ${JSON.stringify(context)}`;
            }
            
            if (stack) {
              logMessage += `\n${stack}`;
            }
            
            if (Object.keys(rest).length > 0) {
              logMessage += ` ${JSON.stringify(rest)}`;
            }
            
            return logMessage;
          })
        ),
        level: 'debug'
      }),
      
      // File transport para erros
      new winston.transports.File({
        filename: path.join(logDir, 'error.log'),
        level: 'error',
        format: logFormat,
        maxsize: 10485760, // 10MB
        maxFiles: 5
      }),
      
      // File transport para todos os logs
      new winston.transports.File({
        filename: path.join(logDir, 'combined.log'),
        format: logFormat,
        maxsize: 10485760, // 10MB
        maxFiles: 5
      })
    ];

    return winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      levels: winston.config.npm.levels,
      format: logFormat,
      transports,
      exitOnError: false,
      silent: process.env.NODE_ENV === 'test'
    });
  }

  private formatLogMessage(message: string, options: LogOptions = {}): any {
    const { level = 'info', context, error, stackTrace = true } = options;
    
    const logData: any = {
      service: this.serviceName,
      message,
      level
    };
    
    if (context) {
      logData.context = context;
    }
    
    if (error) {
      logData.error = {
        name: error.name,
        message: error.message,
        ...(stackTrace && { stack: error.stack })
      };
    }
    
    return logData;
  }

  /**
   * Log de erro
   */
  error(message: string, options: LogOptions = {}): void {
    const logData = this.formatLogMessage(message, { ...options, level: 'error' });
    this.logger.error(logData);
  }

  /**
   * Log de aviso
   */
  warn(message: string, options: LogOptions = {}): void {
    const logData = this.formatLogMessage(message, { ...options, level: 'warn' });
    this.logger.warn(logData);
  }

  /**
   * Log de informação
   */
  info(message: string, options: LogOptions = {}): void {
    const logData = this.formatLogMessage(message, { ...options, level: 'info' });
    this.logger.info(logData);
  }

  /**
   * Log de debug
   */
  debug(message: string, options: LogOptions = {}): void {
    const logData = this.formatLogMessage(message, { ...options, level: 'debug' });
    this.logger.debug(logData);
  }

  /**
   * Log verbose
   */
  verbose(message: string, options: LogOptions = {}): void {
    const logData = this.formatLogMessage(message, { ...options, level: 'verbose' });
    this.logger.verbose(logData);
  }

  /**
   * Log de erro com contexto adicional
   */
  errorWithContext(message: string, context: LogContext, error?: Error): void {
    this.error(message, { context, error });
  }

  /**
   * Log de API request
   */
  logRequest(method: string, path: string, status: number, duration: number, context?: LogContext): void {
    this.info(`HTTP ${method} ${path} ${status} ${duration}ms`, {
      context: {
        method,
        path,
        status,
        duration,
        ...context
      }
    });
  }

  /**
   * Log de evento de negócio
   */
  logBusinessEvent(eventName: string, entityType: string, entityId: string, context?: LogContext): void {
    this.info(`Business Event: ${eventName}`, {
      context: {
        eventName,
        entityType,
        entityId,
        ...context
      }
    });
  }

  /**
   * Log de métrica
   */
  logMetric(metricName: string, value: number, context?: LogContext): void {
    this.info(`Metric: ${metricName}`, {
      context: {
        metricName,
        value,
        ...context
      }
    });
  }

  /**
   * Middleware de logging para Express
   */
  expressMiddleware() {
    return (req: any, res: any, next: any) => {
      const start = Date.now();
      const { method, path, query, params, body } = req;
      
      // Log da requisição
      this.debug('Request started', {
        context: {
          method,
          path,
          query,
          params,
          body: this.sanitizeRequestBody(body)
        }
      });
      
      // Interceptar a resposta
      const originalSend = res.send;
      res.send = (body: any) => {
        const duration = Date.now() - start;
        const status = res.statusCode;
        
        this.logRequest(method, path, status, duration, {
          responseSize: typeof body === 'string' ? body.length : undefined
        });
        
        return originalSend.call(res, body);
      };
      
      // Tratar erros
      res.on('finish', () => {
        const duration = Date.now() - start;
        const status = res.statusCode;
        
        if (status >= 400) {
          this.warn(`Request completed with status ${status}`, {
            context: {
              method,
              path,
              duration,
              status
            }
          });
        }
      });
      
      next();
    };
  }

  /**
   * Sanitiza o corpo da requisição para logging
   */
  private sanitizeRequestBody(body: any): any {
    if (!body || typeof body !== 'object') {
      return body;
    }
    
    // Criar uma cópia do corpo
    const sanitized = { ...body };
    
    // Remover campos sensíveis
    const sensitiveFields = ['password', 'token', 'apiKey', 'secret', 'authorization'];
    
    sensitiveFields.forEach(field => {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    });
    
    return sanitized;
  }

  /**
   * Obtém estatísticas do logger
   */
  getStats(): { level: string; serviceName: string } {
    return {
      level: this.logger.level,
      serviceName: this.serviceName
    };
  }
}

// Instância singleton do logger
export const logger = new LoggerService();

// Funções de conveniência para importação direta
export const logError = (message: string, options?: LogOptions) => logger.error(message, options);
export const logWarn = (message: string, options?: LogOptions) => logger.warn(message, options);
export const logInfo = (message: string, options?: LogOptions) => logger.info(message, options);
export const logDebug = (message: string, options?: LogOptions) => logger.debug(message, options);