import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UsersRepository } from '../users/users.repository';
import { asStringList, toPathResponse, withoutValue } from './path.mapper';
import { PathsRepository } from './paths.repository';

@Injectable()
export class PathFollowersService {
  constructor(
    private readonly pathsRepository: PathsRepository,
    private readonly usersRepository: UsersRepository,
  ) {}

  async followPath(userId: string, pathId: string) {
    const path = await this.pathsRepository.findById(pathId);
    if (!path) throw new NotFoundException('Path not found');

    if (asStringList(path.followerIds).includes(userId)) {
      throw new Error('Already following this path');
    }

    const [updatedPath] = await this.pathsRepository.addFollower(
      pathId,
      userId,
    );
    return toPathResponse(updatedPath);
  }

  async unfollowPath(userId: string, pathId: string) {
    const path = await this.pathsRepository.findById(pathId);
    if (!path) throw new NotFoundException('Path not found');

    const user = await this.usersRepository.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    const [updatedPath] = await this.pathsRepository.removeFollower(
      pathId,
      userId,
      withoutValue(asStringList(path.followerIds), userId),
      withoutValue(asStringList(user.followedPathIds), pathId),
    );

    return toPathResponse(updatedPath);
  }

  async getFollowersWithDetails(pathId: string) {
    const path = await this.pathsRepository.findById(pathId);
    if (!path) throw new NotFoundException('Path not found');

    const followerIds = asStringList(path.followerIds);
    if (followerIds.length === 0) return [];

    return this.usersRepository.findFollowerProfilesByIds(followerIds);
  }

  async removeFollower(pathId: string, followerId: string) {
    const path = await this.pathsRepository.findById(pathId);
    if (!path) throw new NotFoundException('Path not found');

    const follower = await this.usersRepository.findById(followerId);
    if (!follower) throw new NotFoundException('Follower not found');

    const [updatedPath] = await this.pathsRepository.removeFollower(
      pathId,
      followerId,
      withoutValue(asStringList(path.followerIds), followerId),
      withoutValue(asStringList(follower.followedPathIds), pathId),
    );

    return toPathResponse(updatedPath);
  }

  async assertPublisherCanManageFollowers(pathId: string, publisherId: string) {
    const path = await this.pathsRepository.findById(pathId);
    if (!path) throw new NotFoundException('Path not found');
    if (path.publisherId !== publisherId) {
      throw new ForbiddenException('Only the publisher can remove followers');
    }
  }
}
