import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AddTeamMemberDto, CreateTeamDto, UpdateTeamDto } from './dto/team.dto';

@Injectable()
export class TeamsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string) {
    return this.prisma.team.findMany({
      where: { tenantId },
      include: {
        members: {
          include: {
            membership: {
              include: {
                user: { select: { id: true, name: true, email: true } },
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async create(tenantId: string, dto: CreateTeamDto) {
    return this.prisma.team.create({
      data: {
        tenantId,
        name: dto.name,
        description: dto.description,
      },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateTeamDto) {
    const team = await this.prisma.team.findFirst({ where: { id, tenantId } });
    if (!team) {
      throw new NotFoundException({ code: 'TEAM_NOT_FOUND', message: 'Team not found' });
    }
    return this.prisma.team.update({
      where: { id },
      data: { name: dto.name, description: dto.description },
    });
  }

  async addMember(tenantId: string, teamId: string, dto: AddTeamMemberDto) {
    const team = await this.prisma.team.findFirst({ where: { id: teamId, tenantId } });
    if (!team) {
      throw new NotFoundException({ code: 'TEAM_NOT_FOUND', message: 'Team not found' });
    }
    return this.prisma.teamMember.create({
      data: {
        tenantId,
        teamId,
        membershipId: dto.membershipId,
      },
    });
  }

  async remove(tenantId: string, id: string) {
    const team = await this.prisma.team.findFirst({ where: { id, tenantId } });
    if (!team) {
      throw new NotFoundException({ code: 'TEAM_NOT_FOUND', message: 'Team not found' });
    }
    await this.prisma.team.delete({ where: { id } });
    return { deleted: true };
  }
}
