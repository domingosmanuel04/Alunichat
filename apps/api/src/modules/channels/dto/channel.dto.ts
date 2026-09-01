import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsEnum, IsObject, IsOptional, IsString, MinLength } from 'class-validator';
import { ChannelProviderType, ChannelType } from '@alurichat/shared';

export class CreateChannelDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty({ enum: ChannelType })
  @IsEnum(ChannelType)
  type!: ChannelType;

  @ApiProperty({ enum: ChannelProviderType })
  @IsEnum(ChannelProviderType)
  provider!: ChannelProviderType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  workspaceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Plain credentials — encrypted at rest' })
  @IsOptional()
  @IsObject()
  credentials?: Record<string, unknown>;
}

export class UpdateChannelDto extends PartialType(CreateChannelDto) {}

export class ConnectChannelDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}

export class SendWhatsAppTextDto {
  @ApiProperty({ example: '5541999999999' })
  @IsString()
  @MinLength(8)
  to!: string;

  @ApiProperty({ example: 'Olá!' })
  @IsString()
  @MinLength(1)
  message!: string;
}

export class SendWhatsAppMediaDto {
  @ApiProperty({ example: '5541999999999' })
  @IsString()
  @MinLength(8)
  to!: string;

  @ApiPropertyOptional({ example: 'https://example.com/file.jpg' })
  @IsOptional()
  @IsString()
  @MinLength(5)
  url?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  caption?: string;

  @ApiPropertyOptional({ enum: ['image', 'audio', 'document'] })
  @IsOptional()
  @IsString()
  mediaType?: 'image' | 'audio' | 'document';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fileName?: string;
}

export class CheckWhatsAppNumberDto {
  @ApiProperty({ example: '5541999999999' })
  @IsString()
  @MinLength(8)
  number!: string;
}

export class ScheduleWhatsAppMessageDto {
  @ApiProperty({ example: '5511999999999' })
  @IsString()
  @MinLength(8)
  to!: string;

  @ApiPropertyOptional({ example: 'Olá! Lembrete da consulta.' })
  @IsOptional()
  @IsString()
  message?: string;

  @ApiProperty({
    example: '2026-08-15T18:41:00.000Z',
    description: 'ISO datetime in the future (UTC)',
  })
  @IsString()
  @MinLength(10)
  scheduledAt!: string;

  @ApiPropertyOptional({
    enum: ['text', 'image', 'audio', 'document'],
    default: 'text',
  })
  @IsOptional()
  @IsString()
  messageType?: 'text' | 'image' | 'audio' | 'document';

  @ApiPropertyOptional({ description: 'Public URL for media (image/audio/document)' })
  @IsOptional()
  @IsString()
  mediaUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  caption?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fileName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mimetype?: string;

  @ApiPropertyOptional({ description: 'Voice note (PTT) for audio' })
  @IsOptional()
  ptt?: boolean | string;
}
