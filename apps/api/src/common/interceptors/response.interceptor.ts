import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { Request } from 'express';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const requestId =
      (request.headers['x-request-id'] as string) ||
      (request as Request & { requestId?: string }).requestId;

    return next.handle().pipe(
      map((payload) => {
        if (
          payload &&
          typeof payload === 'object' &&
          'success' in (payload as object)
        ) {
          return payload;
        }

        if (
          payload &&
          typeof payload === 'object' &&
          'data' in (payload as object) &&
          'meta' in (payload as object)
        ) {
          const { data, meta, ...rest } = payload as {
            data: unknown;
            meta?: Record<string, unknown>;
          };
          return {
            success: true,
            data,
            meta: { requestId, ...meta, ...rest },
          };
        }

        return {
          success: true,
          data: payload,
          meta: { requestId },
        };
      }),
    );
  }
}
