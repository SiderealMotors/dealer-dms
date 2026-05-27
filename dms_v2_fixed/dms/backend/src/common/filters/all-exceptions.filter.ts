import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';

/**
 * Unified JSON errors for clients; avoids leaking stack traces on 500 in production.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (typeof body === 'object' && body !== null && 'message' in body) {
        const m = (body as { message?: string | string[] }).message;
        message = m ?? message;
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      status = HttpStatus.BAD_REQUEST;
      message = 'Invalid database operation';
      this.logger.warn(`${exception.code} ${req.method} ${req.url} — ${exception.message}`);
    } else if (exception instanceof Prisma.PrismaClientValidationError) {
      status = HttpStatus.BAD_REQUEST;
      message = 'Invalid request data';
      this.logger.warn(`Prisma validation ${req.method} ${req.url}`);
    } else if (exception instanceof Error) {
      this.logger.error(
        `${exception.name}: ${exception.message}`,
        exception.stack ?? '',
      );
    }

    const payload: Record<string, unknown> = {
      statusCode: status,
      message,
      path: req.url,
    };

    if (process.env.NODE_ENV !== 'production' && exception instanceof Error && status >= 500) {
      payload.error = exception.name;
    }

    res.status(status).json(payload);
  }
}
