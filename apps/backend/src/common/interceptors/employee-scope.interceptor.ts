import {
  CallHandler,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Observable } from 'rxjs';
import { AuthUserContext } from '../types/auth-user';

function waiterMay(method: string, url: string): boolean {
  const path = url.split('?')[0];
  if (path.includes('/auth/')) return true;
  if (method === 'POST' && path.endsWith('/cards/resolve')) return true;
  if (method === 'POST' && path.endsWith('/consumptions')) return true;
  if (method === 'GET' && path.endsWith('/exchange-rate')) return true;
  if (method === 'GET' && path.endsWith('/service/active')) return true;
  if (method === 'GET' && path.endsWith('/service/my-dispatches')) return true;
  if (method === 'POST' && path.endsWith('/service/visits')) return true;
  return false;
}

/** El camarero solo resuelve la tarjeta y registra el despacho en mesa. */
@Injectable()
export class EmployeeScopeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const req = context.switchToHttp().getRequest<{
      method: string;
      originalUrl?: string;
      url: string;
      user?: AuthUserContext;
    }>();
    if (req.user?.role !== UserRole.EMPLOYEE) return next.handle();
    const url = req.originalUrl ?? req.url;
    if (!waiterMay(req.method, url)) {
      throw new ForbiddenException('El camarero solo atiende el servicio en mesa');
    }
    return next.handle();
  }
}
