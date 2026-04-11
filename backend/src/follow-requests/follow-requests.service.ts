import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFollowRequestDto } from './dto/create-follow-request.dto';

@Injectable()
export class FollowRequestsService {
  constructor(private prisma: PrismaService) {}

  // ─── Send a follow request ───────────────────────────────────────────────────
  // Adds followerId to Path.followRequests
  async createFollowRequest(
    followerId: string,
    createFollowRequestDto: CreateFollowRequestDto,
  ) {
    const { pathId, publisherId } = createFollowRequestDto;

    const follower = await this.prisma.user.findUnique({
      where: { id: followerId },
    });
    if (!follower) throw new Error('User not found');

    const path = await this.prisma.path.findUnique({
      where: { id: pathId },
      include: { publisher: true },
    });
    if (!path) throw new Error('Path not found');
    if (path.publisherId !== publisherId)
      throw new Error('Publisher does not own this path');

    const followRequests = (path.followRequests as string[]) ?? [];
    const followerIds = (path.followerIds as string[]) ?? [];

    if (followRequests.includes(followerId))
      throw new Error('Follow request already pending for this user');
    if (followerIds.includes(followerId))
      throw new Error('User is already following this path');

    // Single atomic write — only Path side changes at this step
    const updatedPath = await this.prisma.path.update({
      where: { id: pathId },
      data: { followRequests: [...followRequests, followerId] },
      include: { publisher: true },
    });

    return {
      pathId,
      publisherId,
      followerId,
      follower,
      message: 'Follow request created',
      path: updatedPath,
    };
  }

  // ─── Approve a follow request ────────────────────────────────────────────────
  // Removes followerId from Path.followRequests
  // Adds followerId to Path.followerIds
  // Adds pathId to User.followedPathIds
  async approveFollowRequest(pathId: string, userId: string, publisherId: string) {
    const path = await this.prisma.path.findUnique({ where: { id: pathId } });
    if (!path) throw new Error('Path not found');

    // SECURITY FIX: Verify that the requester is the path publisher
    if (path.publisherId !== publisherId) {
      throw new Error('Unauthorized: Only the path publisher can approve follow requests');
    }

    const followRequests = (path.followRequests as string[]) ?? [];
    const followerIds = (path.followerIds as string[]) ?? [];

    if (!followRequests.includes(userId))
      throw new Error('Follow request not found');

    const [updatedPath] = await this.prisma.$transaction([
      // 1. Update Path: move userId out of followRequests, into followerIds
      this.prisma.path.update({
        where: { id: pathId },
        data: {
          followRequests: followRequests.filter((id) => id !== userId),
          followerIds: followerIds.includes(userId)
            ? followerIds
            : [...followerIds, userId],
        },
        include: { publisher: true },
      }),
      // 2. Update User: add pathId to followedPathIds
      this.prisma.user.update({
        where: { id: userId },
        data: {
          followedPathIds: { push: pathId },
        },
      }),
    ]);

    return {
      message: 'Follow request approved',
      pathId,
      userId,
      path: updatedPath,
    };
  }

  // ─── Reject a follow request (publisher action) ───────────────────────────
  // Removes followerId from Path.followRequests only
  async rejectFollowRequest(pathId: string, userId: string, publisherId: string) {
    const path = await this.prisma.path.findUnique({ where: { id: pathId } });
    if (!path) throw new Error('Path not found');

    // SECURITY FIX: Verify that the requester is the path publisher
    if (path.publisherId !== publisherId) {
      throw new Error('Unauthorized: Only the path publisher can reject follow requests');
    }

    const followRequests = (path.followRequests as string[]) ?? [];
    if (!followRequests.includes(userId))
      throw new Error('Follow request not found');

    const updatedPath = await this.prisma.path.update({
      where: { id: pathId },
      data: {
        followRequests: followRequests.filter((id) => id !== userId),
      },
      include: { publisher: true },
    });

    return {
      message: 'Follow request rejected',
      pathId,
      userId,
      path: updatedPath,
    };
  }

  // ─── Cancel a follow request (requester action) ───────────────────────────
  // Removes followerId from Path.followRequests only
  async cancelFollowRequest(pathId: string, userId: string) {
    const path = await this.prisma.path.findUnique({ where: { id: pathId } });
    if (!path) throw new Error('Path not found');

    const followRequests = (path.followRequests as string[]) ?? [];
    if (!followRequests.includes(userId))
      throw new Error('Follow request not found');

    const updatedPath = await this.prisma.path.update({
      where: { id: pathId },
      data: {
        followRequests: followRequests.filter((id) => id !== userId),
      },
      include: { publisher: true },
    });

    return {
      message: 'Follow request cancelled',
      pathId,
      userId,
      path: updatedPath,
    };
  }

  // ─── Get pending requests for a publisher's paths ─────────────────────────
  async getPendingFollowRequestsForPublisher(publisherId: string) {
    const paths = await this.prisma.path.findMany({
      where: { publisherId },
      include: { publisher: true },
    });

    // PERFORMANCE FIX: Collect all follow requester IDs
    const allFollowerIds = new Set<string>();
    for (const path of paths) {
      const followRequests = (path.followRequests as string[]) ?? [];
      followRequests.forEach(id => allFollowerIds.add(id));
    }

    // Batch fetch all users in one query instead of N queries
    const followers = await this.prisma.user.findMany({
      where: {
        id: { in: Array.from(allFollowerIds) }
      }
    });

    // Create map for O(1) lookups
    const followerMap = new Map(followers.map(f => [f.id, f]));

    const allPendingRequests = [];

    for (const path of paths) {
      const followRequests = (path.followRequests as string[]) ?? [];

      for (const userId of followRequests) {
        const follower = followerMap.get(userId);
        if (follower) {
          allPendingRequests.push({
            pathId: path.id,
            pathTitle: path.title,
            publisherId,
            publisher: path.publisher,
            followerId: userId,
            follower,
          });
        }
      }
    }

    return allPendingRequests;
  }

  // ─── Get pending requests for a specific path ─────────────────────────────
  async getFollowRequestsForPath(pathId: string) {
    const path = await this.prisma.path.findUnique({
      where: { id: pathId },
      include: { publisher: true },
    });
    if (!path) throw new Error('Path not found');

    const followRequests = (path.followRequests as string[]) ?? [];
    
    // PERFORMANCE FIX: Batch fetch users instead of individual queries
    const followers = await this.prisma.user.findMany({
      where: {
        id: { in: followRequests.length > 0 ? followRequests : undefined }
      }
    });

    const followerMap = new Map(followers.map(f => [f.id, f]));
    const requestsWithDetails = followRequests.map(userId => ({
      pathId,
      followerId: userId,
      follower: followerMap.get(userId)
    }));

    return requestsWithDetails;
  }

  // ─── Get requests sent by a user ─────────────────────────────────────────
  async getFollowRequestsSentByUser(userId: string) {
    const paths = await this.prisma.path.findMany({
      include: { publisher: true },
    });

    const sentRequests = [];
    for (const path of paths) {
      const followRequests = (path.followRequests as string[]) ?? [];
      const followerIds = (path.followerIds as string[]) ?? [];

      if (followRequests.includes(userId)) {
        sentRequests.push({
          pathId: path.id,
          pathTitle: path.title,
          publisherId: path.publisherId,
          publisher: path.publisher,
          status: 'PENDING',
        });
      } else if (followerIds.includes(userId)) {
        sentRequests.push({
          pathId: path.id,
          pathTitle: path.title,
          publisherId: path.publisherId,
          publisher: path.publisher,
          status: 'APPROVED',
        });
      }
    }

    return sentRequests;
  }
}
