import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateMacroDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty({
    description:
      'Actions: { assignToMe?, status?, tag?, reply?, departmentId? }',
  })
  @IsObject()
  actions!: Record<string, unknown>;
}

export class UpdateMacroDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  actions?: Record<string, unknown>;
}
