import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface JwtPayload {
  sub: string;
  email: string;
  tenantId: string;
  workspaceId?: string;
  role: string;
  permissions: string[];
  platformRole?: string | null;
  /** Set when a platform admin is impersonating into a tenant */
  impersonatorId?: string;
}

export const CurrentUser = createParamDecorator(
  (data: keyof JwtPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as JwtPayload;
    return data ? user?.[data] : user;
  },
);
