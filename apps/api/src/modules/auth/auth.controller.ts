import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto, RefreshTokenDto, ForgotPasswordDto, ResetPasswordDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { Public } from '../../common/decorators/public.decorator';
import {
  CurrentUser,
  JwtPayload,
} from '../../common/decorators/current-user.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('login')
  @ApiOperation({ summary: 'Login with email/password' })
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.auth.login(dto, req.ip, req.headers['user-agent']);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('register')
  @ApiOperation({ summary: 'Self-serve signup with plan + payment proof' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: [
        'ownerName',
        'email',
        'companyName',
        'slug',
        'planName',
        'paymentProof',
      ],
      properties: {
        ownerName: { type: 'string' },
        email: { type: 'string', format: 'email' },
        companyName: { type: 'string' },
        slug: { type: 'string' },
        planName: {
          type: 'string',
          enum: ['FREE', 'STARTER', 'PRO', 'BUSINESS', 'ENTERPRISE'],
        },
        phone: { type: 'string' },
        captchaToken: { type: 'string' },
        captchaAnswer: { type: 'string' },
        referralCode: { type: 'string' },
        paymentProof: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('paymentProof', {
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  register(
    @Body() dto: RegisterDto,
    @UploadedFile()
    paymentProof: {
      originalname: string;
      mimetype: string;
      size: number;
      buffer: Buffer;
    },
    @Req() req: Request,
  ) {
    return this.auth.register(
      dto,
      paymentProof,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @Public()
  @Get('captcha')
  @ApiOperation({ summary: 'Create a short-lived captcha challenge' })
  captcha() {
    return this.auth.createCaptcha();
  }

  @Public()
  @Post('forgot-password')
  @ApiOperation({ summary: 'Request password reset email' })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto.email);
  }

  @Public()
  @Post('reset-password')
  @ApiOperation({ summary: 'Reset password with token' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto.token, dto.password);
  }

  @Public()
  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token' })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Public()
  @Post('logout')
  @ApiOperation({ summary: 'Logout / revoke refresh token' })
  logout(@Body() dto: RefreshTokenDto) {
    return this.auth.logout(dto.refreshToken);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Current authenticated user' })
  me(@CurrentUser() user: JwtPayload) {
    return this.auth.me(user.sub, user.tenantId || undefined);
  }

  @Get('mfa')
  @ApiBearerAuth()
  @ApiOperation({ summary: '2FA status' })
  mfaStatus(@CurrentUser() user: JwtPayload) {
    return this.auth.mfaStatus(user.sub);
  }

  @Post('mfa/enable')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Enable 2FA for current user' })
  enableMfa(@CurrentUser() user: JwtPayload) {
    return this.auth.enableMfa(user.sub);
  }

  @Post('mfa/disable')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Disable 2FA for current user' })
  disableMfa(@CurrentUser() user: JwtPayload) {
    return this.auth.disableMfa(user.sub);
  }
}
