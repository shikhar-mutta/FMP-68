// ci-test-1778755724
import { Injectable } from '@nestjs/common';
import { CreatePathDto } from './dto/create-path.dto';
import { PathFollowersService } from './path-followers.service';
import { toPathResponse, toPathResponses } from './path.mapper';
import { PathsRepository } from './paths.repository';

@Injectable()
export class PathsService {
  constructor(
    private readonly pathsRepository: PathsRepository,
    private readonly pathFollowersService: PathFollowersService,
  ) {}

  async createPath(userId: string, createPathDto: CreatePathDto) {
    return this.pathsRepository.create(userId, createPathDto);
  }

  async getAllPaths() {
    const paths = await this.pathsRepository.findAllWithPublisher();
    return toPathResponses(paths);
  }

  async getPathById(pathId: string) {
    const path = await this.pathsRepository.findByIdWithPublisher(pathId);
    return path ? toPathResponse(path) : null;
  }

  async getPublishedPathsByUser(userId: string) {
    const paths = await this.pathsRepository.findByPublisher(userId);
    return toPathResponses(paths);
  }

  async followPath(userId: string, pathId: string) {
    return this.pathFollowersService.followPath(userId, pathId);
  }

  async unfollowPath(userId: string, pathId: string) {
    return this.pathFollowersService.unfollowPath(userId, pathId);
  }

  async getFollowedPathsByUser(userId: string) {
    const paths = await this.pathsRepository.findFollowedByUser(userId);
    return toPathResponses(paths);
  }

  async deletePath(pathId: string) {
    return this.pathsRepository.delete(pathId);
  }

  async updatePath(pathId: string, updateData: CreatePathDto) {
    const updated = await this.pathsRepository.update(pathId, updateData);
    return toPathResponse(updated);
  }

  async getFollowersWithDetails(pathId: string) {
    return this.pathFollowersService.getFollowersWithDetails(pathId);
  }

  async removeFollower(pathId: string, followerId: string) {
    return this.pathFollowersService.removeFollower(pathId, followerId);
  }

  async getPathPreview(pathId: string) {
    const all = await this.pathsRepository.getCoordinates(pathId);
    if (!all.length) return null;

    const step = Math.max(1, Math.floor(all.length / 60));
    const pts = all.filter((_, i) => i % step === 0);

    const lats = pts.map((p) => p.lat);
    const lngs = pts.map((p) => p.lng);

    return {
      points: pts.map((p) => ({ lat: p.lat, lng: p.lng })),
      bbox: {
        minLat: Math.min(...lats),
        maxLat: Math.max(...lats),
        minLng: Math.min(...lngs),
        maxLng: Math.max(...lngs),
      },
    };
  }

  async assertPublisherCanManageFollowers(pathId: string, publisherId: string) {
    await this.pathFollowersService.assertPublisherCanManageFollowers(
      pathId,
      publisherId,
    );
  }
}
