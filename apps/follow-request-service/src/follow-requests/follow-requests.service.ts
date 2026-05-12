import { Injectable } from '@nestjs/common';
import {
  FollowRequestStatus,
  Prisma,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { CreateFollowRequestDto } from './dto/create-follow-request.dto';

@Injectable()
export class FollowRequestsService {
  constructor(private readonly prisma: PrismaService) {}

  async createFollowRequest(
    requesterId: string,
    dto: CreateFollowRequestDto,
  ) {
    const existing = await this.prisma.followRequest.findFirst({
      where: {
        pathId: dto.pathId,
        requesterId,
        status: 'PENDING',
      },
    });

    if (existing) {
      throw new Error('Follow request already exists');
    }

    const request = await this.prisma.followRequest.create({
      data: {
        pathId: dto.pathId,
        publisherId: dto.publisherId,
        requesterId,
        status: FollowRequestStatus.PENDING,
      },
    });

    return request;
  }

  async approveFollowRequest(
    pathId: string,
    requesterId: string,
  ) {
    const request = await this.prisma.followRequest.findFirst({
      where: {
        pathId,
        requesterId,
        status: 'PENDING',
      },
    });

    if (!request) {
      throw new Error('Follow request not found');
    }

    await this.prisma.followRequest.update({
    where: {
        id: request.id,
    },
    data: {
        status: FollowRequestStatus.APPROVED,
    },
    });

    await this.prisma.pathFollower.create({
    data: {
        pathId,
        followerId: requesterId,
    },
    });

    return {
      message: 'Follow request approved',
    };
  }

  async rejectFollowRequest(
    pathId: string,
    requesterId: string,
  ) {
    const request = await this.prisma.followRequest.findFirst({
      where: {
        pathId,
        requesterId,
        status: 'PENDING',
      },
    });

    if (!request) {
      throw new Error('Follow request not found');
    }

    await this.prisma.followRequest.update({
      where: {
        id: request.id,
      },
      data: {
        status: FollowRequestStatus.REJECTED,
      },
    });

    return {
      message: 'Follow request rejected',
    };
  }

  async getFollowers(pathId: string) {
    return this.prisma.pathFollower.findMany({
      where: {
        pathId,
      },
    });
  }
}