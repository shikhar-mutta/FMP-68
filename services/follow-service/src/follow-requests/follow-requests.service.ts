import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RabbitMQService, FOLLOW_APPROVED, FOLLOW_REJECTED, FOLLOW_CREATED } from '../messaging/rabbitmq.service';
import { CreateFollowRequestDto } from './dto/create-follow-request.dto';

@Injectable()
export class FollowRequestsService {
  constructor(private prisma: PrismaService, private mq: RabbitMQService) {}

  async createFollowRequest(followerId: string, dto: CreateFollowRequestDto) {
    const { pathId, publisherId } = dto;
    const path = await this.prisma.path.findUnique({ where: { id: pathId } });
    if (!path) throw new Error('Path not found');
    if (path.publisherId !== publisherId) throw new Error('Publisher mismatch');
    const followRequests = (path.followRequests as string[]) ?? [];
    const followerIds    = (path.followerIds as string[]) ?? [];
    if (followRequests.includes(followerId)) throw new Error('Follow request already pending');
    if (followerIds.includes(followerId))    throw new Error('Already following this path');
    const updated = await this.prisma.path.update({
      where: { id: pathId },
      data: { followRequests: [...followRequests, followerId] },
    });
    await this.mq.publish(FOLLOW_CREATED, { pathId, publisherId, followerId });
    return { pathId, publisherId, followerId, message: 'Follow request created', path: updated };
  }

  async approveFollowRequest(pathId: string, userId: string, publisherId: string) {
    const path = await this.prisma.path.findUnique({ where: { id: pathId } });
    if (!path) throw new Error('Path not found');
    if (path.publisherId !== publisherId) throw new Error('Unauthorized');
    const followRequests = (path.followRequests as string[]) ?? [];
    const followerIds    = (path.followerIds as string[]) ?? [];
    if (!followRequests.includes(userId)) throw new Error('Follow request not found');
    const [updatedPath] = await this.prisma.$transaction([
      this.prisma.path.update({
        where: { id: pathId },
        data: {
          followRequests: followRequests.filter(id => id !== userId),
          followerIds: followerIds.includes(userId) ? followerIds : [...followerIds, userId],
        },
      }),
      this.prisma.user.update({ where: { id: userId }, data: { followedPathIds: { push: pathId } } }),
    ]);
    await this.mq.publish(FOLLOW_APPROVED, { pathId, publisherId, userId });
    return { message: 'Follow request approved', pathId, userId, path: updatedPath };
  }

  async rejectFollowRequest(pathId: string, userId: string, publisherId: string) {
    const path = await this.prisma.path.findUnique({ where: { id: pathId } });
    if (!path) throw new Error('Path not found');
    if (path.publisherId !== publisherId) throw new Error('Unauthorized');
    const followRequests = (path.followRequests as string[]) ?? [];
    if (!followRequests.includes(userId)) throw new Error('Follow request not found');
    const updated = await this.prisma.path.update({
      where: { id: pathId },
      data: { followRequests: followRequests.filter(id => id !== userId) },
    });
    await this.mq.publish(FOLLOW_REJECTED, { pathId, publisherId, userId });
    return { message: 'Follow request rejected', pathId, userId, path: updated };
  }

  async cancelFollowRequest(pathId: string, userId: string) {
    const path = await this.prisma.path.findUnique({ where: { id: pathId } });
    if (!path) throw new Error('Path not found');
    const followRequests = (path.followRequests as string[]) ?? [];
    if (!followRequests.includes(userId)) throw new Error('Follow request not found');
    const updated = await this.prisma.path.update({
      where: { id: pathId },
      data: { followRequests: followRequests.filter(id => id !== userId) },
    });
    return { message: 'Follow request cancelled', pathId, userId, path: updated };
  }

  async getPendingFollowRequestsForPublisher(publisherId: string) {
    const paths = await this.prisma.path.findMany({ where: { publisherId } });
    const allFollowerIds = [...new Set(paths.flatMap(p => (p.followRequests as string[]) ?? []))];
    const followers = await this.prisma.user.findMany({ where: { id: { in: allFollowerIds } } });
    const followerMap = new Map(followers.map(f => [f.id, f]));
    return paths.flatMap(path =>
      ((path.followRequests as string[]) ?? []).map(uid => ({
        pathId: path.id, pathTitle: path.title, publisherId, followerId: uid, follower: followerMap.get(uid),
      })),
    );
  }

  async getFollowRequestsForPath(pathId: string) {
    const path = await this.prisma.path.findUnique({ where: { id: pathId } });
    if (!path) throw new Error('Path not found');
    const followRequests = (path.followRequests as string[]) ?? [];
    const followers = await this.prisma.user.findMany({ where: { id: { in: followRequests.length ? followRequests : ['__none__'] } } });
    const followerMap = new Map(followers.map(f => [f.id, f]));
    return followRequests.map(uid => ({ pathId, followerId: uid, follower: followerMap.get(uid) }));
  }

  async getFollowRequestsSentByUser(userId: string) {
    const paths = await this.prisma.path.findMany();
    return paths.flatMap(path => {
      const fr = (path.followRequests as string[]) ?? [];
      const fl = (path.followerIds as string[]) ?? [];
      if (fr.includes(userId)) return [{ pathId: path.id, pathTitle: path.title, publisherId: path.publisherId, status: 'PENDING' }];
      if (fl.includes(userId)) return [{ pathId: path.id, pathTitle: path.title, publisherId: path.publisherId, status: 'APPROVED' }];
      return [];
    });
  }
}
