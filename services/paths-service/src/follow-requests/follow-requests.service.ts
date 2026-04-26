import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFollowRequestDto } from './dto/create-follow-request.dto';

@Injectable()
export class FollowRequestsService {
  constructor(private prisma: PrismaService) {}

  async createFollowRequest(followerId: string, dto: CreateFollowRequestDto) {
    const { pathId, publisherId } = dto;
    const follower = await this.prisma.user.findUnique({ where: { id: followerId } });
    if (!follower) throw new Error('User not found');
    const path = await this.prisma.path.findUnique({ where: { id: pathId }, include: { publisher: true } });
    if (!path) throw new Error('Path not found');
    if (path.publisherId !== publisherId) throw new Error('Publisher does not own this path');
    const followRequests = (path.followRequests as string[]) ?? [];
    const followerIds = (path.followerIds as string[]) ?? [];
    if (followRequests.includes(followerId)) throw new Error('Follow request already pending');
    if (followerIds.includes(followerId)) throw new Error('Already following this path');
    const updatedPath = await this.prisma.path.update({
      where: { id: pathId },
      data: { followRequests: [...followRequests, followerId] },
      include: { publisher: true },
    });
    return { pathId, publisherId, followerId, follower, message: 'Follow request created', path: updatedPath };
  }

  async approveFollowRequest(pathId: string, userId: string, publisherId: string) {
    const path = await this.prisma.path.findUnique({ where: { id: pathId } });
    if (!path) throw new Error('Path not found');
    if (path.publisherId !== publisherId) throw new Error('Unauthorized');
    const followRequests = (path.followRequests as string[]) ?? [];
    const followerIds = (path.followerIds as string[]) ?? [];
    if (!followRequests.includes(userId)) throw new Error('Follow request not found');
    const [updatedPath] = await this.prisma.$transaction([
      this.prisma.path.update({
        where: { id: pathId },
        data: {
          followRequests: followRequests.filter((id) => id !== userId),
          followerIds: followerIds.includes(userId) ? followerIds : [...followerIds, userId],
        },
        include: { publisher: true },
      }),
      this.prisma.user.update({ where: { id: userId }, data: { followedPathIds: { push: pathId } } }),
    ]);
    return { message: 'Follow request approved', pathId, userId, path: updatedPath };
  }

  async rejectFollowRequest(pathId: string, userId: string, publisherId: string) {
    const path = await this.prisma.path.findUnique({ where: { id: pathId } });
    if (!path) throw new Error('Path not found');
    if (path.publisherId !== publisherId) throw new Error('Unauthorized');
    const followRequests = (path.followRequests as string[]) ?? [];
    if (!followRequests.includes(userId)) throw new Error('Follow request not found');
    const updatedPath = await this.prisma.path.update({
      where: { id: pathId },
      data: { followRequests: followRequests.filter((id) => id !== userId) },
      include: { publisher: true },
    });
    return { message: 'Follow request rejected', pathId, userId, path: updatedPath };
  }

  async cancelFollowRequest(pathId: string, userId: string) {
    const path = await this.prisma.path.findUnique({ where: { id: pathId } });
    if (!path) throw new Error('Path not found');
    const followRequests = (path.followRequests as string[]) ?? [];
    if (!followRequests.includes(userId)) throw new Error('Follow request not found');
    const updatedPath = await this.prisma.path.update({
      where: { id: pathId },
      data: { followRequests: followRequests.filter((id) => id !== userId) },
      include: { publisher: true },
    });
    return { message: 'Follow request cancelled', pathId, userId, path: updatedPath };
  }

  async getPendingFollowRequestsForPublisher(publisherId: string) {
    const paths = await this.prisma.path.findMany({ where: { publisherId }, include: { publisher: true } });
    const allFollowerIds = new Set<string>();
    for (const path of paths) {
      ((path.followRequests as string[]) ?? []).forEach((id) => allFollowerIds.add(id));
    }
    const followers = await this.prisma.user.findMany({ where: { id: { in: Array.from(allFollowerIds) } } });
    const followerMap = new Map(followers.map((f) => [f.id, f]));
    const result = [];
    for (const path of paths) {
      for (const userId of (path.followRequests as string[]) ?? []) {
        const follower = followerMap.get(userId);
        if (follower) result.push({ pathId: path.id, pathTitle: path.title, publisherId, publisher: path.publisher, followerId: userId, follower });
      }
    }
    return result;
  }

  async getFollowRequestsForPath(pathId: string) {
    const path = await this.prisma.path.findUnique({ where: { id: pathId }, include: { publisher: true } });
    if (!path) throw new Error('Path not found');
    const followRequests = (path.followRequests as string[]) ?? [];
    const followers = await this.prisma.user.findMany({ where: { id: { in: followRequests.length > 0 ? followRequests : ['__none__'] } } });
    const followerMap = new Map(followers.map((f) => [f.id, f]));
    return followRequests.map((userId) => ({ pathId, followerId: userId, follower: followerMap.get(userId) }));
  }

  async getFollowRequestsSentByUser(userId: string) {
    const paths = await this.prisma.path.findMany({ include: { publisher: true } });
    const result = [];
    for (const path of paths) {
      const followRequests = (path.followRequests as string[]) ?? [];
      const followerIds = (path.followerIds as string[]) ?? [];
      if (followRequests.includes(userId)) {
        result.push({ pathId: path.id, pathTitle: path.title, publisherId: path.publisherId, publisher: path.publisher, status: 'PENDING' });
      } else if (followerIds.includes(userId)) {
        result.push({ pathId: path.id, pathTitle: path.title, publisherId: path.publisherId, publisher: path.publisher, status: 'APPROVED' });
      }
    }
    return result;
  }
}
