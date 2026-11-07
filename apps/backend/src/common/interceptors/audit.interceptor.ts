import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { AuditService } from '../../audit/audit.service';
import { AuthUserContext } from '../types/auth-user';

const AUDITED_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly audit: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<{
      method: string;
      originalUrl?: string;
      url: string;
      user?: AuthUserContext;
      ip?: string;
      headers: Record<string, string | undefined>;
      params: Record<string, string>;
      body?: Record<string, unknown>;
    }>();

    if (!AUDITED_METHODS.has(req.method) || !req.user) {
      return next.handle();
    }

    const path = req.originalUrl ?? req.url;
    // Skip noisy auth refresh
    if (path.includes('/auth/login') || path.includes('/auth/refresh')) {
      return next.handle();
    }

    return next.handle().pipe(
      tap({
        next: (result) => {
          const entityId =
            req.params?.id ??
            (result && typeof result === 'object' && 'id' in result
              ? String((result as { id: string }).id)
              : null);
          void this.audit
            .log({
              tenantId: req.user!.tenantId,
              actorUserId: req.user!.id,
              action: `${req.method} ${path.split('?')[0]}`,
              entityType: this.guessEntity(path),
              entityId,
              context: `role=${req.user!.role}`,
              metadata: {
                bodyKeys: req.body ? Object.keys(req.body) : [],
              },
              ip:
                req.headers['x-forwarded-for']?.toString().split(',')[0] ??
                req.ip,
            })
            .catch(() => undefined);
        },
      }),
    );
  }

  private guessEntity(path: string): string {
    const parts = path.replace(/^\/api\/v1\//, '').split('/').filter(Boolean);
    return parts[0] ?? 'unknown';
  }
}
