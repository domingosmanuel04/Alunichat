import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateKnowledgeBaseDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateKnowledgeBaseDto extends PartialType(CreateKnowledgeBaseDto) {}

export class CreateDocumentDto {
  @ApiProperty()
  @IsString()
  title!: string;

  @ApiProperty({ example: 'manual' })
  @IsString()
  sourceType!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sourceUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
