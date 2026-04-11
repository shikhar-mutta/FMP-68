import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePathDto } from './dto/create-path.dto';

@Injectable()
export class PathsService {
  constructor(private prisma: PrismaService) {}

  // Create a new path
  async createPath(userId: string, createPathDto: CreatePathDto) {
    return this.prisma.path.create({
      data: {
        title: createPathDto.title,
        description: createPathDto.description,
        publisherId: userId,
        followerIds: [],
      },
      include: {
        publisher: true,
      },
    });
  }

  // Get all paths with follower count
  async getAllPaths() {
    const paths = await this.prisma.path.findMany({
      include: {
        publisher: true,
      },
    });
    
    // Add follower count to response
    return paths.map((path) => ({
      ...path,
      followers: path.followerIds || [],
    }));
  }

  // Get path by ID
  async getPathById(pathId: string) {
    const path = await this.prisma.path.findUnique({
      where: { id: pathId },
      include: {
        publisher: true,
      },
    });

    if (path) {
      return {
        ...path,
        followers: path.followerIds || [],
      };
    }
    return null;
  }

  // Get paths published by a user
  async getPublishedPathsByUser(userId: string) {
    const paths = await this.prisma.path.findMany({
      where: { publisherId: userId },
      include: {
        publisher: true,
      },
    });

    return paths.map((path) => ({
      ...path,
      followers: path.followerIds || [],
    }));
  }

  // Follow a path — syncs both Path.followerIds and User.followedPathIds
  async followPath(userId: string, pathId: string) {
    const path = await this.prisma.path.findUnique({ where: { id: pathId } });
    if (!path) throw new Error('Path not found');

    if (path.followerIds?.includes(userId))
      throw new Error('Already following this path');

    const [updatedPath] = await this.prisma.$transaction([
      // 1. Add userId to Path.followerIds
      this.prisma.path.update({
        where: { id: pathId },
        data: { followerIds: { push: userId } },
        include: { publisher: true },
      }),
      // 2. Add pathId to User.followedPathIds
      this.prisma.user.update({
        where: { id: userId },
        data: { followedPathIds: { push: pathId } },
      }),
    ]);

    return {
      ...updatedPath,
      followers: updatedPath.followerIds ?? [],
    };
  }

  // Unfollow a path — syncs both Path.followerIds and User.followedPathIds
  async unfollowPath(userId: string, pathId: string) {
    const path = await this.prisma.path.findUnique({ where: { id: pathId } });
    if (!path) throw new Error('Path not found');

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    const [updatedPath] = await this.prisma.$transaction([
      // 1. Remove userId from Path.followerIds
      this.prisma.path.update({
        where: { id: pathId },
        data: {
          followerIds: (path.followerIds ?? []).filter((id) => id !== userId),
        },
        include: { publisher: true },
      }),
      // 2. Remove pathId from User.followedPathIds
      this.prisma.user.update({
        where: { id: userId },
        data: {
          followedPathIds: (user.followedPathIds ?? []).filter(
            (id) => id !== pathId,
          ),
        },
      }),
    ]);

    return {
      ...updatedPath,
      followers: updatedPath.followerIds ?? [],
    };
  }

  // Get paths followed by a user
  async getFollowedPathsByUser(userId: string) {
    const paths = await this.prisma.path.findMany({
      where: {
        followerIds: {
          has: userId,
        },
      },
      include: {
        publisher: true,
      },
    });

    return paths.map((path) => ({
      ...path,
      followers: path.followerIds || [],
    }));
  }

  // Delete a path
  async deletePath(pathId: string) {
    return this.prisma.path.delete({
      where: { id: pathId },
    });
  }

  // Update a path
  async updatePath(pathId: string, updateData: CreatePathDto) {
    const updated = await this.prisma.path.update({
      where: { id: pathId },
      data: {
        title: updateData.title,
        description: updateData.description,
      },
      include: {
        publisher: true,
      },
    });

    return {
      ...updated,
      followers: updated.followerIds || [],
    };
  }

  // Get followers of a path with their details
  async getFollowersWithDetails(pathId: string) {
    const path = await this.prisma.path.findUnique({
      where: { id: pathId },
    });

    if (!path) throw new Error('Path not found');

    const followerIds = path.followerIds || [];
    if (followerIds.length === 0) return [];

    const followers = await this.prisma.user.findMany({
      where: {
        id: {
          in: followerIds,
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        picture: true,
      },
    });

    return followers;
  }

  // Remove a follower from a path
  async removeFollower(pathId: string, followerId: string) {
    const path = await this.prisma.path.findUnique({ where: { id: pathId } });
    if (!path) throw new Error('Path not found');

    const user = await this.prisma.user.findUnique({ where: { id: followerId } });
    if (!user) throw new Error('Follower not found');

    const [updatedPath] = await this.prisma.$transaction([
      // 1. Remove followerId from Path.followerIds
      this.prisma.path.update({
        where: { id: pathId },
        data: {
          followerIds: (path.followerIds ?? []).filter((id) => id !== followerId),
        },
        include: { publisher: true },
      }),
      // 2. Remove pathId from User.followedPathIds
      this.prisma.user.update({
        where: { id: followerId },
        data: {
          followedPathIds: (user.followedPathIds ?? []).filter(
            (id) => id !== pathId,
          ),
        },
      }),
    ]);

    return {
      ...updatedPath,
      followers: updatedPath.followerIds ?? [],
    };
  }
}
