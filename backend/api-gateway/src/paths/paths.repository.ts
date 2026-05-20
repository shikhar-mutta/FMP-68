import { Injectable } from '@nestjs/common';
import { CreatePathDto } from './dto/create-path.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PathsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(publisherId: string, createPathDto: CreatePathDto) {
    return this.prisma.path.create({
      data: {
        title: createPathDto.title,
        description: createPathDto.description,
        publisherId,
        followerIds: [],
      },
      include: { publisher: true },
    });
  }

  findAllWithPublisher() {
    return this.prisma.path.findMany({
      include: { publisher: true },
    });
  }

  findById(pathId: string) {
    return this.prisma.path.findUnique({
      where: { id: pathId },
    });
  }

  findByIdWithPublisher(pathId: string) {
    return this.prisma.path.findUnique({
      where: { id: pathId },
      include: { publisher: true },
    });
  }

  findByPublisher(publisherId: string) {
    return this.prisma.path.findMany({
      where: { publisherId },
      include: { publisher: true },
    });
  }

  findFollowedByUser(userId: string) {
    return this.prisma.path.findMany({
      where: {
        followerIds: {
          has: userId,
        },
      },
      include: { publisher: true },
    });
  }

  update(pathId: string, updateData: CreatePathDto) {
    return this.prisma.path.update({
      where: { id: pathId },
      data: {
        title: updateData.title,
        description: updateData.description,
      },
      include: { publisher: true },
    });
  }

  delete(pathId: string) {
    return this.prisma.path.delete({
      where: { id: pathId },
    });
  }

  setFollowRequests(pathId: string, followRequests: string[]) {
    return this.prisma.path.update({
      where: { id: pathId },
      data: { followRequests },
      include: { publisher: true },
    });
  }

  addFollower(pathId: string, userId: string) {
    return this.prisma.$transaction([
      this.prisma.path.update({
        where: { id: pathId },
        data: { followerIds: { push: userId } },
        include: { publisher: true },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { followedPathIds: { push: pathId } },
      }),
    ]);
  }

  removeFollower(
    pathId: string,
    followerId: string,
    followerIds: string[],
    followedPathIds: string[],
  ) {
    return this.prisma.$transaction([
      this.prisma.path.update({
        where: { id: pathId },
        data: { followerIds },
        include: { publisher: true },
      }),
      this.prisma.user.update({
        where: { id: followerId },
        data: { followedPathIds },
      }),
    ]);
  }

  approveFollowRequest(
    pathId: string,
    userId: string,
    followRequests: string[],
    followerIds: string[],
  ) {
    return this.prisma.$transaction([
      this.prisma.path.update({
        where: { id: pathId },
        data: {
          followRequests,
          followerIds,
        },
        include: { publisher: true },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { followedPathIds: { push: pathId } },
      }),
    ]);
  }
}
