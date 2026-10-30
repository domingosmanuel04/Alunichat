import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'Maria Silva' })
  @IsString()
  @MinLength(2)
  ownerName!: string;

  @ApiProperty({ example: 'maria@empresa.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Empresa XYZ' })
  @IsString()
  @MinLength(2)
  companyName!: string;

  @ApiProperty({ example: 'empresa-xyz' })
  @IsString()
  @Matches(/^[a-z0-9-]{2,40}$/)
  slug!: string;

  @ApiProperty({ example: 'PRO', enum: ['FREE', 'STARTER', 'PRO', 'BUSINESS', 'ENTERPRISE'] })
  @IsString()
  @IsIn(['FREE', 'STARTER', 'PRO', 'BUSINESS', 'ENTERPRISE'])
  planName!: string;

  @ApiPropertyOptional({ example: '900000000' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ description: 'Token de captcha (GET /auth/captcha)' })
  @IsOptional()
  @IsString()
  captchaToken?: string;

  @ApiPropertyOptional({ description: 'Resposta do desafio captcha' })
  @IsOptional()
  @IsString()
  captchaAnswer?: string;

  @ApiPropertyOptional({ description: 'Código de referência / cupão' })
  @IsOptional()
  @IsString()
  referralCode?: string;
}
