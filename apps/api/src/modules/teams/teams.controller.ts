import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TeamsService } from './teams.service';
import { AddTeamMemberDto, CreateTeamDto, UpdateTeamDto } from './dto/team.dto';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('teams')
@ApiBearerAuth()
@Controller('teams')
export class TeamsController {
  constructor(private readonly teams: TeamsService) {}

  @Get()
  @RequirePermissions('users.manage')
  findAll(@TenantId() tenantId: string) {
    return this.teams.findAll(tenantId);
  }

  @Post()
  @RequirePermissions('users.manage')
  create(@TenantId() tenantId: string, @Body() dto: CreateTeamDto) {
    return this.teams.create(tenantId, dto);
  }

  @Patch(':id')
  @RequirePermissions('users.manage')
  update(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateTeamDto,
  ) {
    return this.teams.update(tenantId, id, dto);
  }

  @Post(':id/members')
  @RequirePermissions('users.manage')
  addMember(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: AddTeamMemberDto,
  ) {
    return this.teams.addMember(tenantId, id, dto);
  }

  @Delete(':id')
  @RequirePermissions('users.manage')
  remove(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.teams.remove(tenantId, id);
  }
}
