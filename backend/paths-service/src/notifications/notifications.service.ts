import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const EXPIRY_MS = 30 * 60 * 1000;

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  create(userId: string, pathId: string, pathTitle: string) {
    return this.prisma.notification.create({
      data: {
        userId,
        type: 'follow_approved',
        pathId,
        pathTitle,
        expiresAt: new Date(Date.now() + EXPIRY_MS),
      },
    });
  }

  findForUser(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
  }

  dismiss(id: string, userId: string) {
    return this.prisma.notification.deleteMany({
      where: { id, userId },
    });
  }
}
