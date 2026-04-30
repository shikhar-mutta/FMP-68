import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cache: Cache,
  ) {}

  async findAll() {
    const cached = await this.cache.get('users:all');
    if (cached) return cached;
    const users = await this.prisma.user.findMany({
      select: { id: true, name: true, email: true, picture: true, isOnline: true, lastSeen: true },
    });
    await this.cache.set('users:all', users, 60); // 1 min TTL
    return users;
  }

  async findById(id: string) {
    const cacheKey = `user:${id}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (user) await this.cache.set(cacheKey, user, 300);
    return user;
  }

  async setOnlineStatus(userId: string, isOnline: boolean) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { isOnline, lastSeen: isOnline ? undefined : new Date() },
    });
    // Invalidate cache
    await this.cache.del(`user:${userId}`);
    await this.cache.del('users:all');
    return user;
  }

  async getFollowedPaths(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    return user?.followedPathIds ?? [];
  }
}
