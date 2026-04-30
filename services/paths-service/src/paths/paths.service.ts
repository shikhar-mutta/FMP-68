import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePathDto } from './dto/create-path.dto';

@Injectable()
export class PathsService {
  constructor(private prisma: PrismaService) {}

  async createPath(userId: string, dto: CreatePathDto) {
    return this.prisma.path.create({
      data: { title: dto.title, description: dto.description, publisherId: userId, followerIds: [] },
      include: { publisher: true },
    });
  }

  async getAllPaths() {
    const paths = await this.prisma.path.findMany({ include: { publisher: true } });
    return paths.map((p) => ({ ...p, followers: p.followerIds || [] }));
  }

  async getPathById(pathId: string) {
    const path = await this.prisma.path.findUnique({ where: { id: pathId }, include: { publisher: true } });
    if (path) return { ...path, followers: path.followerIds || [] };
    return null;
  }

  async getPublishedPathsByUser(userId: string) {
    const paths = await this.prisma.path.findMany({ where: { publisherId: userId }, include: { publisher: true } });
    return paths.map((p) => ({ ...p, followers: p.followerIds || [] }));
  }

  async followPath(userId: string, pathId: string) {
    const path = await this.prisma.path.findUnique({ where: { id: pathId } });
    if (!path) throw new Error('Path not found');
    if (path.followerIds?.includes(userId)) throw new Error('Already following this path');

    const [updatedPath] = await this.prisma.$transaction([
      this.prisma.path.update({ where: { id: pathId }, data: { followerIds: { push: userId } }, include: { publisher: true } }),
      this.prisma.user.update({ where: { id: userId }, data: { followedPathIds: { push: pathId } } }),
    ]);
    return { ...updatedPath, followers: updatedPath.followerIds ?? [] };
  }

  async unfollowPath(userId: string, pathId: string) {
    const path = await this.prisma.path.findUnique({ where: { id: pathId } });
    if (!path) throw new Error('Path not found');
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    const [updatedPath] = await this.prisma.$transaction([
      this.prisma.path.update({
        where: { id: pathId },
        data: { followerIds: (path.followerIds ?? []).filter((id) => id !== userId) },
        include: { publisher: true },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { followedPathIds: (user.followedPathIds ?? []).filter((id) => id !== pathId) },
      }),
    ]);
    return { ...updatedPath, followers: updatedPath.followerIds ?? [] };
  }

  async getFollowedPathsByUser(userId: string) {
    const paths = await this.prisma.path.findMany({
      where: { followerIds: { has: userId } },
      include: { publisher: true },
    });
    return paths.map((p) => ({ ...p, followers: p.followerIds || [] }));
  }

  async deletePath(pathId: string) {
    return this.prisma.path.delete({ where: { id: pathId } });
  }

  async updatePath(pathId: string, dto: CreatePathDto) {
    const updated = await this.prisma.path.update({
      where: { id: pathId },
      data: { title: dto.title, description: dto.description },
      include: { publisher: true },
    });
    return { ...updated, followers: updated.followerIds || [] };
  }

  async getFollowersWithDetails(pathId: string) {
    const path = await this.prisma.path.findUnique({ where: { id: pathId } });
    if (!path) throw new Error('Path not found');
    const followerIds = path.followerIds || [];
    if (followerIds.length === 0) return [];
    return this.prisma.user.findMany({
      where: { id: { in: followerIds } },
      select: { id: true, name: true, email: true, picture: true },
    });
  }

  async removeFollower(pathId: string, followerId: string) {
    const path = await this.prisma.path.findUnique({ where: { id: pathId } });
    if (!path) throw new Error('Path not found');
    const user = await this.prisma.user.findUnique({ where: { id: followerId } });
    if (!user) throw new Error('Follower not found');

    const [updatedPath] = await this.prisma.$transaction([
      this.prisma.path.update({
        where: { id: pathId },
        data: { followerIds: (path.followerIds ?? []).filter((id) => id !== followerId) },
        include: { publisher: true },
      }),
      this.prisma.user.update({
        where: { id: followerId },
        data: { followedPathIds: (user.followedPathIds ?? []).filter((id) => id !== pathId) },
      }),
    ]);
    return { ...updatedPath, followers: updatedPath.followerIds ?? [] };
  }
}
