import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { PLATFORM_ONLY_KEY } from '../decorators/permissions.decorator';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const platformOnly = this.reflector.getAllAndOverride<boolean>(
      PLATFORM_ONLY_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (platformOnly) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user) return true;

    const tenantId =
      (typeof user.tenantId === 'string' && user.tenantId.trim()) ||
      (typeof request.tenantId === 'string' && request.tenantId.trim()) ||
      '';

    // Super admin may access platform routes without tenant; tenant-scoped
    // controllers still require a tenant (login with tenantSlug or membership).
    if (!tenantId) {
      if (user.platformRole === 'SUPER_ADMIN') {
        return true;
      }
      throw new ForbiddenException({
        code: 'TENANT_REQUIRED',
        message:
          'Tenant context is required. Faça login com tenantSlug (ex.: demo).',
      });
    }

    request.tenantId = tenantId;
    user.tenantId = tenantId;
    return true;
  }
}
