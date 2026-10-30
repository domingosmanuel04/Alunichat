import {
  ExecutionContext,
  Injectable,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { firstValueFrom, isObservable } from 'rxjs';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ApiKeysService } from '../../modules/api-keys/api-keys.service';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private reflector: Reflector,
    @Optional() private readonly apiKeys?: ApiKeysService,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const header = String(request.headers?.authorization || '');
    const match = header.match(/^Bearer\s+(.+)$/i);
    const token = match?.[1]?.trim() || '';

    if (token.startsWith('alc_')) {
      if (!this.apiKeys) {
        throw new UnauthorizedException({
          code: 'API_KEY_AUTH_UNAVAILABLE',
          message: 'API key authentication is not available',
        });
      }
      const apiKey = await this.apiKeys.validateRawKey(token);
      if (!apiKey) {
        throw new UnauthorizedException({
          code: 'INVALID_API_KEY',
          message: 'Invalid or revoked API key',
        });
      }
      await this.apiKeys.touchLastUsed(apiKey.id);
      const scopes = Array.isArray(apiKey.scopes)
        ? apiKey.scopes.filter((s): s is string => typeof s === 'string')
        : [];
      request.user = {
        sub: `apikey:${apiKey.id}`,
        email: `apikey+${apiKey.id}@alurichat.local`,
        tenantId: apiKey.tenantId,
        role: 'API_KEY',
        permissions: scopes.includes('*')
          ? ['*']
          : scopes.length
            ? scopes
            : ['*'],
        platformRole: null,
      };
      return true;
    }

    const result = super.canActivate(context);
    if (isObservable(result)) {
      return firstValueFrom(result);
    }
    return result as Promise<boolean> | boolean;
  }
}
