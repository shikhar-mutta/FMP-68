import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { UsersClientService } from '../users-client/users-client.service';
import { CreateFollowRequestDto } from './dto/create-follow-request.dto';
import {
  asStringList,
  withValueOnce,
  withoutValue,
} from '../paths/path.mapper';
import { PathsRepository } from '../paths/paths.repository';
import { NotificationsService } from '../notifications/notifications.service';
import { RabbitmqService } from '../rabbitmq/rabbitmq.service';

@Injectable()
export class FollowRequestsService {
  private readonly logger = new Logger(FollowRequestsService.name);

  constructor(
    private readonly pathsRepository: PathsRepository,
    private readonly usersClient: UsersClientService,
    private readonly notificationsService: NotificationsService,
    private readonly rabbitmq: RabbitmqService,
  ) {}

  async createFollowRequest(
    followerId: string,
    createFollowRequestDto: CreateFollowRequestDto,
  ) {
    const { pathId, publisherId } = createFollowRequestDto;

    const follower = await this.usersClient.findById(followerId);
    if (!follower) throw new NotFoundException('User not found');

    const path = await this.pathsRepository.findByIdWithPublisher(pathId);
    if (!path) throw new NotFoundException('Path not found');
    if (path.publisherId !== publisherId) {
      throw new Error('Publisher does not own this path');
    }

    const followRequests = asStringList(path.followRequests);
    const followerIds = asStringList(path.followerIds);

    if (followRequests.includes(followerId)) {
      throw new Error('Follow request already pending for this user');
    }
    if (followerIds.includes(followerId)) {
      throw new Error('User is already following this path');
    }

    const updatedPath = await this.pathsRepository.setFollowRequests(pathId, [
      ...followRequests,
      followerId,
    ]);

    // Fire-and-forget publish — we deliberately don't await the result.
    // Notifications are a "best-effort" side-channel: if RabbitMQ is
    // briefly down, the follow request itself still succeeds, and the
    // RabbitmqService's reconnect loop catches up. Errors are logged
    // for visibility but never bubble up to the HTTP response.
    try {
      this.rabbitmq.publish('follow-request.created', {
        type: 'follow-request.created',
        pathId,
        publisherId,
        followerId,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      this.logger.warn(`publish(follow-request.created) failed: ${err?.message ?? err}`);
    }

    return {
      pathId,
      publisherId,
      followerId,
      follower,
      message: 'Follow request created',
      path: updatedPath,
    };
  }

  async approveFollowRequest(
    pathId: string,
    userId: string,
    publisherId: string,
  ) {
    const path = await this.pathsRepository.findById(pathId);
    if (!path) throw new NotFoundException('Path not found');

    if (path.publisherId !== publisherId) {
      throw new ForbiddenException(
        'Unauthorized: Only the path publisher can approve follow requests',
      );
    }

    const followRequests = asStringList(path.followRequests);
    const followerIds = asStringList(path.followerIds);

    if (!followRequests.includes(userId)) {
      throw new Error('Follow request not found');
    }

    const [updatedPath] = await this.pathsRepository.approveFollowRequest(
      pathId,
      userId,
      withoutValue(followRequests, userId),
      withValueOnce(followerIds, userId),
    );

    void this.notificationsService.create(userId, pathId, updatedPath.title);

    return {
      message: 'Follow request approved',
      pathId,
      userId,
      path: updatedPath,
    };
  }

  async rejectFollowRequest(
    pathId: string,
    userId: string,
    publisherId: string,
  ) {
    const path = await this.pathsRepository.findById(pathId);
    if (!path) throw new NotFoundException('Path not found');

    if (path.publisherId !== publisherId) {
      throw new ForbiddenException(
        'Unauthorized: Only the path publisher can reject follow requests',
      );
    }

    const followRequests = asStringList(path.followRequests);
    if (!followRequests.includes(userId)) {
      throw new Error('Follow request not found');
    }

    const updatedPath = await this.pathsRepository.setFollowRequests(
      pathId,
      withoutValue(followRequests, userId),
    );

    return {
      message: 'Follow request rejected',
      pathId,
      userId,
      path: updatedPath,
    };
  }

  async cancelFollowRequest(pathId: string, userId: string) {
    const path = await this.pathsRepository.findById(pathId);
    if (!path) throw new NotFoundException('Path not found');

    const followRequests = asStringList(path.followRequests);
    if (!followRequests.includes(userId)) {
      throw new Error('Follow request not found');
    }

    const updatedPath = await this.pathsRepository.setFollowRequests(
      pathId,
      withoutValue(followRequests, userId),
    );

    return {
      message: 'Follow request cancelled',
      pathId,
      userId,
      path: updatedPath,
    };
  }

  async getPendingFollowRequestsForPublisher(publisherId: string) {
    const paths = await this.pathsRepository.findByPublisher(publisherId);

    const allFollowerIds = new Set<string>();
    for (const path of paths) {
      for (const id of asStringList(path.followRequests)) {
        allFollowerIds.add(id);
      }
    }

    const followers = await this.usersClient.findManyByIds(
      Array.from(allFollowerIds),
    );
    const followerMap = new Map<string, any>(
      followers.map((f: any) => [f.id, f]),
    );

    const allPendingRequests: any[] = [];

    for (const path of paths) {
      for (const userId of asStringList(path.followRequests)) {
        const follower = followerMap.get(userId);
        if (follower) {
          allPendingRequests.push({
            pathId: path.id,
            pathTitle: path.title,
            publisherId,
            publisher: (path as any).publisher,
            followerId: userId,
            follower,
          });
        }
      }
    }

    return allPendingRequests;
  }

  async getFollowRequestsForPath(pathId: string) {
    const path = await this.pathsRepository.findByIdWithPublisher(pathId);
    if (!path) throw new NotFoundException('Path not found');

    const followRequests = asStringList(path.followRequests);
    const followers =
      followRequests.length > 0
        ? await this.usersClient.findManyByIds(followRequests)
        : [];

    const followerMap = new Map<string, any>(
      followers.map((f: any) => [f.id, f]),
    );
    return followRequests.map((userId) => ({
      pathId,
      followerId: userId,
      follower: followerMap.get(userId),
    }));
  }

  async getFollowRequestsSentByUser(userId: string) {
    const paths = await this.pathsRepository.findAllWithPublisher();

    const sentRequests: any[] = [];
    for (const path of paths) {
      const followRequests = asStringList(path.followRequests);
      const followerIds = asStringList(path.followerIds);

      if (followRequests.includes(userId)) {
        sentRequests.push({
          pathId: path.id,
          pathTitle: path.title,
          publisherId: path.publisherId,
          publisher: (path as any).publisher,
          status: 'PENDING',
        });
      } else if (followerIds.includes(userId)) {
        sentRequests.push({
          pathId: path.id,
          pathTitle: path.title,
          publisherId: path.publisherId,
          publisher: (path as any).publisher,
          status: 'APPROVED',
        });
      }
    }

    return sentRequests;
  }
}
