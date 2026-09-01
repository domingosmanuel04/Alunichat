import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { ConversationStatus } from '@alurichat/shared';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class ConversationQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ConversationStatus })
  @IsOptional()
  @IsEnum(ConversationStatus)
  status?: ConversationStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  channelId?: string;

  @ApiPropertyOptional({ description: 'Filter by channel type, e.g. WHATSAPP' })
  @IsOptional()
  @IsString()
  channelType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assigneeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  departmentId?: string;

  @ApiPropertyOptional({
    description:
      'Queue shortcut: aguardando | atendendo | finalizado | unassigned | mine | open | all | tagged',
  })
  @IsOptional()
  @IsString()
  queue?: string;
}

export class AssignConversationDto {
  @ApiProperty()
  @IsString()
  assigneeId!: string;
}

export class TransferConversationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assigneeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  teamId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  departmentId?: string;
}

export class UpdateStatusDto {
  @ApiProperty({ enum: ConversationStatus })
  @IsEnum(ConversationStatus)
  status!: ConversationStatus;
}

export class SendMessageDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  body!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  isPrivate?: boolean;

  @ApiPropertyOptional({
    description: 'ISO datetime — if in the future, message is scheduled',
  })
  @IsOptional()
  @IsISO8601()
  scheduledAt?: string;
}
