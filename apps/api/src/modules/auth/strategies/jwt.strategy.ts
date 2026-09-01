import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from '../../../common/decorators/current-user.decorator';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>(
        'JWT_SECRET',
        'change-me-jwt-secret-min-32-chars-long!!',
      ),
    });
  }

  validate(payload: JwtPayload): JwtPayload {
    if (!payload?.sub) {
      throw new UnauthorizedException({
        code: 'INVALID_TOKEN',
        message: 'Invalid access token',
      });
    }
    return {
      sub: payload.sub,
      email: payload.email,
      tenantId: payload.tenantId,
      workspaceId: payload.workspaceId,
      role: payload.role,
      permissions: payload.permissions ?? [],
      platformRole: payload.platformRole,
    };
  }
}
