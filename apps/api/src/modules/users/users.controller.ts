import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { InviteUserDto, UpdateMembershipDto } from './dto/user.dto';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @RequirePermissions('users.manage')
  findAll(@TenantId() tenantId: string) {
    return this.users.findMemberships(tenantId);
  }

  @Post('invite')
  @RequirePermissions('users.manage')
  invite(@TenantId() tenantId: string, @Body() dto: InviteUserDto) {
    return this.users.invite(tenantId, dto);
  }

  @Patch(':membershipId')
  @RequirePermissions('users.manage')
  update(
    @TenantId() tenantId: string,
    @Param('membershipId') membershipId: string,
    @Body() dto: UpdateMembershipDto,
  ) {
    return this.users.updateMembership(tenantId, membershipId, dto);
  }

  @Delete(':membershipId')
  @RequirePermissions('users.manage')
  remove(
    @TenantId() tenantId: string,
    @Param('membershipId') membershipId: string,
  ) {
    return this.users.removeMembership(tenantId, membershipId);
  }
}
