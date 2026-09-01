import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const TenantId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    const fromUser = request.user?.tenantId;
    const fromReq = request.tenantId;
    const value =
      (typeof fromUser === 'string' && fromUser.trim()) ||
      (typeof fromReq === 'string' && fromReq.trim()) ||
      '';
    return value;
  },
);
