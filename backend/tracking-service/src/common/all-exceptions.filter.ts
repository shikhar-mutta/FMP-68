import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let message: string | object = 'Internal server error';
    let errorName = 'InternalServerError';

    if (exception instanceof HttpException) {
      const res = exception.getResponse();
      message = typeof res === 'string' ? res : (res as any).message ?? res;
      errorName = exception.name;
    } else if (exception instanceof Error) {
      message = exception.message;
      errorName = exception.name || 'Error';
    }

    const isServerError = status >= 500;
    const logPayload = `${request.method} ${request.url} → ${status} ${errorName}: ${
      typeof message === 'string' ? message : JSON.stringify(message)
    }`;

    if (isServerError) {
      this.logger.error(
        logPayload,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(logPayload);
    }

    response.status(status).json({
      statusCode: status,
      error: errorName,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
