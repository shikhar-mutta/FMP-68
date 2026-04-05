import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFollowRequestDto } from './dto/create-follow-request.dto';

@Injectable()
export class FollowRequestsService {
  constructor(private prisma: PrismaService) {}

  // Create a follow request - add user ID to Path.followRequests array
  async createFollowRequest(
    followerId: string,
    createFollowRequestDto: CreateFollowRequestDto,
  ) {
    const { pathId, publisherId } = createFollowRequestDto;

    try {
      // Get follower details
      const follower = await this.prisma.user.findUnique({
        where: { id: followerId },
      });

      if (!follower) {
        throw new Error('User not found');
      }

      // Check if path exists and belongs to publisher
      const path = await this.prisma.path.findUnique({
        where: { id: pathId },
        include: { publisher: true },
      });

      if (!path) {
        throw new Error('Path not found');
      }

      if (path.publisherId !== publisherId) {
        throw new Error('Publisher does not own this path');
      }

      // Check if user already has a follow request
      const followRequests = (path.followRequests as string[]) || [];
      if (followRequests.includes(followerId)) {
        throw new Error('Follow request already pending for this user');
      }

      // Check if user already following
      const followerIds = (path.followerIds as string[]) || [];
      if (followerIds.includes(followerId)) {
        throw new Error('User is already following this path');
      }

      // Add user ID to followRequests array
      const updatedFollowRequests = [...followRequests, followerId];

      const updatedPath = await this.prisma.path.update({
        where: { id: pathId },
        data: {
          followRequests: updatedFollowRequests,
        },
        include: {
          publisher: true,
        },
      });

      return {
        pathId,
        publisherId,
        followerId,
        follower,
        message: 'Follow request created',
        path: updatedPath,
      };
    } catch (error) {
      console.error('Error in createFollowRequest:', error);
      throw error;
    }
  }

  // Get all pending follow requests for a publisher's paths
  async getPendingFollowRequestsForPublisher(publisherId: string) {
    const paths = await this.prisma.path.findMany({
      where: { publisherId },
      include: { publisher: true },
    });

    const allPendingRequests = [];

    for (const path of paths) {
      const followRequests = path.followRequests || [];

      for (const userId of followRequests) {
        const follower = await this.prisma.user.findUnique({
          where: { id: userId },
        });

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

    return allPendingRequests;
  }

  // Get follow requests for a specific path
  async getFollowRequestsForPath(pathId: string) {
    const path = await this.prisma.path.findUnique({
      where: { id: pathId },
      include: { publisher: true },
    });

    if (!path) {
      throw new Error('Path not found');
    }

    const followRequests = path.followRequests || [];
    const requestsWithDetails = [];

    for (const userId of followRequests) {
      const follower = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      requestsWithDetails.push({
        pathId,
        followerId: userId,
        follower,
      });
    }

    return requestsWithDetails;
  }

  // Approve a follow request - move from followRequests to followerIds
  async approveFollowRequest(pathId: string, userId: string) {
    const path = await this.prisma.path.findUnique({
      where: { id: pathId },
    });

    if (!path) {
      throw new Error('Path not found');
    }

    const followRequests = path.followRequests || [];
    const followerIds = path.followerIds || [];

    if (!followRequests.includes(userId)) {
      throw new Error('Follow request not found');
    }

    // Remove from followRequests array
    const updatedFollowRequests = followRequests.filter((id) => id !== userId);

    // Add to followerIds array if not already there
    if (!followerIds.includes(userId)) {
      followerIds.push(userId);
    }

    const updatedPath = await this.prisma.path.update({
      where: { id: pathId },
      data: {
        followRequests: updatedFollowRequests,
        followerIds: followerIds,
      },
      include: { publisher: true },
    });

    return {
      message: 'Follow request approved',
      pathId,
      userId,
      path: updatedPath,
    };
  }

  // Reject a follow request - remove from followRequests array
  async rejectFollowRequest(pathId: string, userId: string) {
    const path = await this.prisma.path.findUnique({
      where: { id: pathId },
    });

    if (!path) {
      throw new Error('Path not found');
    }

    const followRequests = path.followRequests || [];

    if (!followRequests.includes(userId)) {
      throw new Error('Follow request not found');
    }

    // Remove from followRequests array
    const updatedFollowRequests = followRequests.filter((id) => id !== userId);

    const updatedPath = await this.prisma.path.update({
      where: { id: pathId },
      data: {
        followRequests: updatedFollowRequests,
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

  // Get follow requests sent by a user across all paths
  async getFollowRequestsSentByUser(userId: string) {
    const paths = await this.prisma.path.findMany({
      include: { publisher: true },
    });

    const sentRequests = [];

    for (const path of paths) {
      const followRequests = path.followRequests || [];

      if (followRequests.includes(userId)) {
        sentRequests.push({
          pathId: path.id,
          pathTitle: path.title,
          publisherId: path.publisherId,
          publisher: path.publisher,
        });
      }
    }

    return sentRequests;
  }

  // Cancel a pending follow request (by the requester)
  async cancelFollowRequest(pathId: string, userId: string) {
    const path = await this.prisma.path.findUnique({
      where: { id: pathId },
    });

    if (!path) {
      throw new Error('Path not found');
    }

    const followRequests = path.followRequests || [];

    if (!followRequests.includes(userId)) {
      throw new Error('Follow request not found');
    }

    // Remove from followRequests array
    const updatedFollowRequests = followRequests.filter((id) => id !== userId);

    const updatedPath = await this.prisma.path.update({
      where: { id: pathId },
      data: {
        followRequests: updatedFollowRequests,
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
}
