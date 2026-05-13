import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LocationPayload } from './tracking.types';

@Injectable()
export class TrackingService {
  constructor(private readonly prisma: PrismaService) {}

  async startTracking(pathId: string, userId: string) {
    await this.prisma.path.update({
      where: { id: pathId },
      data: { status: 'recording', isLive: true, coordinates: [] },
    });

    await this.prisma.trackingSession.create({
      data: {
        pathId,
        userId,
        role: 'publisher',
        coordinates: [],
        isActive: true,
      },
    });
  }

  async recordLocation({ pathId, userId, coordinate, role }: LocationPayload) {
    if (role === 'publisher') {
      await this.prisma.path.update({
        where: { id: pathId },
        data: {
          coordinates: { push: coordinate as any },
        },
      });

      await this.prisma.trackingSession.updateMany({
        where: { pathId, userId, role: 'publisher', isActive: true },
        data: {
          coordinates: { push: coordinate as any },
        },
      });
      return;
    }

    await this.prisma.trackingSession.updateMany({
      where: { pathId, userId, role: 'follower', isActive: true },
      data: {
        coordinates: { push: coordinate as any },
      },
    });
  }

  pauseTracking(pathId: string) {
    return this.prisma.path.update({
      where: { id: pathId },
      data: { status: 'paused' },
    });
  }

  resumeTracking(pathId: string) {
    return this.prisma.path.update({
      where: { id: pathId },
      data: { status: 'recording', isLive: true },
    });
  }

  async endTracking(pathId: string) {
    await this.prisma.path.update({
      where: { id: pathId },
      data: { status: 'ended', isLive: false },
    });

    await this.prisma.trackingSession.updateMany({
      where: { pathId, isActive: true },
      data: { isActive: false, endedAt: new Date() },
    });
  }

  async joinTracking(pathId: string, userId: string) {
    const existingSession = await this.prisma.trackingSession.findFirst({
      where: { pathId, userId, role: 'follower', isActive: true },
    });

    if (!existingSession) {
      await this.prisma.trackingSession.create({
        data: {
          pathId,
          userId,
          role: 'follower',
          coordinates: [],
          isActive: true,
        },
      });
    }

    return this.prisma.path.findUnique({
      where: { id: pathId },
    });
  }

  leaveTracking(pathId: string, userId: string) {
    return this.prisma.trackingSession.updateMany({
      where: { pathId, userId, role: 'follower', isActive: true },
      data: { isActive: false, endedAt: new Date() },
    });
  }

  async getTrackingData(pathId: string) {
    const [path, sessions] = await Promise.all([
      this.prisma.path.findUnique({
        where: { id: pathId },
        include: { publisher: true },
      }),
      this.prisma.trackingSession.findMany({
        where: { pathId, isActive: true },
      }),
    ]);

    return { path, sessions };
  }
}
