import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'owner@demo.alurichat.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'DemoOwner123!' })
  @IsString()
  @MinLength(6)
  password!: string;

  @ApiPropertyOptional({ example: 'demo' })
  @IsOptional()
  @IsString()
  tenantSlug?: string;

  @ApiPropertyOptional({ description: 'Código 2FA (se MFA estiver ativo)' })
  @IsOptional()
  @IsString()
  mfaCode?: string;

  @ApiPropertyOptional({ description: 'Token de captcha (GET /auth/captcha)' })
  @IsOptional()
  @IsString()
  captchaToken?: string;

  @ApiPropertyOptional({ description: 'Resposta do desafio captcha' })
  @IsOptional()
  @IsString()
  captchaAnswer?: string;
}

export class RefreshTokenDto {
  @ApiProperty()
  @IsString()
  refreshToken!: string;
}

export class ForgotPasswordDto {
  @ApiProperty()
  @IsEmail()
  email!: string;
}

export class ResetPasswordDto {
  @ApiProperty()
  @IsString()
  @MinLength(20)
  token!: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  password!: string;
}
