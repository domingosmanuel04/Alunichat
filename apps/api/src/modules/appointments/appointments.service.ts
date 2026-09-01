import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { paginatedMeta } from '../../common/dto/pagination.dto';
import {
  AppointmentQueryDto,
  CreateAppointmentDto,
  UpdateAppointmentDto,
} from './dto/appointment.dto';

@Injectable()
export class AppointmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, query: AppointmentQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = {
      tenantId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? { title: { contains: query.search, mode: 'insensitive' as const } }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.appointment.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { startsAt: 'asc' },
        include: { contact: true },
      }),
      this.prisma.appointment.count({ where }),
    ]);
    return { data: items, meta: paginatedMeta(page, pageSize, total) };
  }

  async findOne(tenantId: string, id: string) {
    const item = await this.prisma.appointment.findFirst({
      where: { id, tenantId },
      include: { contact: true },
    });
    if (!item) {
      throw new NotFoundException({
        code: 'APPOINTMENT_NOT_FOUND',
        message: 'Appointment not found',
      });
    }
    return item;
  }

  async create(tenantId: string, dto: CreateAppointmentDto) {
    return this.prisma.appointment.create({
      data: {
        tenantId,
        title: dto.title,
        startsAt: new Date(dto.startsAt),
        endsAt: new Date(dto.endsAt),
        contactId: dto.contactId,
        assigneeId: dto.assigneeId,
        serviceName: dto.serviceName,
        location: dto.location,
        notes: dto.notes,
        status: 'SCHEDULED',
      },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateAppointmentDto) {
    await this.findOne(tenantId, id);
    return this.prisma.appointment.update({
      where: { id },
      data: {
        title: dto.title,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
        contactId: dto.contactId,
        assigneeId: dto.assigneeId,
        serviceName: dto.serviceName,
        location: dto.location,
        notes: dto.notes,
        status: dto.status,
      },
    });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    await this.prisma.appointment.delete({ where: { id } });
    return { deleted: true };
  }

  async confirm(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    return this.prisma.appointment.update({
      where: { id },
      data: { status: 'CONFIRMED' },
    });
  }

  /** Mark upcoming appointments and create in-app reminders for assignees */
  async processReminders(tenantId: string) {
    const now = new Date();
    const inHour = new Date(now.getTime() + 60 * 60 * 1000);
    const due = await this.prisma.appointment.findMany({
      where: {
        tenantId,
        reminderSent: false,
        status: { in: ['SCHEDULED', 'CONFIRMED'] },
        startsAt: { gte: now, lte: inHour },
      },
    });

    let sent = 0;
    for (const appt of due) {
      if (appt.assigneeId) {
        await this.prisma.notification.create({
          data: {
            tenantId,
            userId: appt.assigneeId,
            type: 'appointment.reminder',
            title: 'Lembrete de agendamento',
            body: `${appt.title} começa às ${appt.startsAt.toLocaleString('pt-PT')}`,
            data: { appointmentId: appt.id },
            channel: 'IN_APP',
          },
        });
      }
      await this.prisma.appointment.update({
        where: { id: appt.id },
        data: { reminderSent: true },
      });
      sent += 1;
    }
    return { sent, checked: due.length };
  }
}
