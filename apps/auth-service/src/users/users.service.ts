import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { User } from '@prisma/client';

export interface GoogleProfile {
  googleId: string;
  email: string;
  name: string;
  picture: string;
}

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  /** Create user on first login, or update lastSeen on subsequent logins */
  async findOrCreate(profile: GoogleProfile): Promise<User> {
    const existing = await this.prisma.user.findUnique({
      where: { googleId: profile.googleId },
    });

    if (!existing) {
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

    return this.prisma.user.update({
      where: { googleId: profile.googleId },
      data: {
        isOnline: true,
        lastSeen: new Date(),
        picture: profile.picture || existing.picture,
      },
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  /** Set isOnline to true or false, update lastSeen */
  async setOnlineStatus(userId: string, isOnline: boolean): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { isOnline, lastSeen: new Date() },
    });
  }

  /** Return all users sorted: online first, then alphabetically */
  async findAll(): Promise<User[]> {
    return this.prisma.user.findMany({
      orderBy: [{ isOnline: 'desc' }, { name: 'asc' }],
    });
  }
}
