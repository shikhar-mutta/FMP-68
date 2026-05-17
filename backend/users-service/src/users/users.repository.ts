import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleProfile } from './users.types';

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByGoogleId(googleId: string) {
    return this.prisma.user.findUnique({ where: { googleId } });
  }

  createFromGoogleProfile(profile: GoogleProfile) {
    return this.prisma.user.create({
      data: {
        googleId: profile.googleId,
        email: profile.email,
        name: profile.name,
        picture: profile.picture || '',
        isOnline: true,
        lastSeen: new Date(),
      },
    });
  }

  markSeenOnline(googleId: string, picture: string) {
    return this.prisma.user.update({
      where: { googleId },
      data: {
        isOnline: true,
        lastSeen: new Date(),
        picture,
      },
    });
  }

  findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  findManyByIds(ids: string[]) {
    return this.prisma.user.findMany({
      where: { id: { in: ids } },
    });
  }

  findFollowerProfilesByIds(ids: string[]) {
    return this.prisma.user.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        name: true,
        email: true,
        picture: true,
      },
    });
  }

  findByUsername(username: string) {
    return this.prisma.user.findFirst({ where: { username } });
  }

  updateUsername(userId: string, username: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { username },
    });
  }

  updateOnlineStatus(userId: string, isOnline: boolean) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { isOnline, lastSeen: new Date() },
    });
  }

  findAll() {
    return this.prisma.user.findMany({
      orderBy: [{ isOnline: 'desc' }, { name: 'asc' }],
    });
  }
}
