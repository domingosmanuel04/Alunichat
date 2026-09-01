import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateQuickReplyDto {
  @ApiProperty({ example: 'ola' })
  @IsString()
  @MinLength(1)
  shortcut!: string;

  @ApiProperty({ example: 'Saudação' })
  @IsString()
  @MinLength(1)
  title!: string;

  @ApiProperty({ example: 'Olá! Como posso ajudar?' })
  @IsString()
  @MinLength(1)
  body!: string;

  @ApiPropertyOptional({ example: 'geral' })
  @IsOptional()
  @IsString()
  category?: string;
}

export class UpdateQuickReplyDto extends PartialType(CreateQuickReplyDto) {}
