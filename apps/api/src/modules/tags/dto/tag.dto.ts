import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateTagDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiPropertyOptional({ example: '#14b8a6' })
  @IsOptional()
  @IsString()
  color?: string;
}

export class UpdateTagDto extends PartialType(CreateTagDto) {}
