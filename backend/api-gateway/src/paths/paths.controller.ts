import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
} from '@nestjs/common';
import { PathsService } from './paths.service';
import { CreatePathDto } from './dto/create-path.dto';
import { CurrentUserId } from '../common/current-user.decorator';

@Controller('paths')
export class PathsController {
  constructor(private readonly pathsService: PathsService) {}

  @Post()
  async createPath(
    @CurrentUserId() userId: string,
    @Body() createPathDto: CreatePathDto,
  ) {
    return this.pathsService.createPath(userId, createPathDto);
  }

  /** Publicly readable — list all paths */
  @Get()
  async getAllPaths() {
    return this.pathsService.getAllPaths();
  }

  @Get('published/my-paths')
  async getMyPublishedPaths(@CurrentUserId() userId: string) {
    return this.pathsService.getPublishedPathsByUser(userId);
  }

  @Get('followed/my-paths')
  async getMyFollowedPaths(@CurrentUserId() userId: string) {
    return this.pathsService.getFollowedPathsByUser(userId);
  }

  /** Publicly readable — sampled polyline + bbox for SVG thumbnail */
  @Get(':id/preview')
  async getPathPreview(@Param('id') pathId: string) {
    return this.pathsService.getPathPreview(pathId);
  }

  /** Publicly readable */
  @Get(':id')
  async getPathById(@Param('id') pathId: string) {
    return this.pathsService.getPathById(pathId);
  }

  @Post(':id/follow')
  async followPath(
    @CurrentUserId() userId: string,
    @Param('id') pathId: string,
  ) {
    return this.pathsService.followPath(userId, pathId);
  }

  @Post(':id/unfollow')
  async unfollowPath(
    @CurrentUserId() userId: string,
    @Param('id') pathId: string,
  ) {
    return this.pathsService.unfollowPath(userId, pathId);
  }

  @Put(':id')
  async updatePath(
    @Param('id') pathId: string,
    @Body() updatePathDto: CreatePathDto,
  ) {
    return this.pathsService.updatePath(pathId, updatePathDto);
  }

  @Delete(':id')
  async deletePath(@Param('id') pathId: string) {
    return this.pathsService.deletePath(pathId);
  }

  /** Publicly readable */
  @Get(':id/followers')
  async getFollowers(@Param('id') pathId: string) {
    return this.pathsService.getFollowersWithDetails(pathId);
  }

  @Delete(':id/followers/:followerId')
  async removeFollower(
    @CurrentUserId() userId: string,
    @Param('id') pathId: string,
    @Param('followerId') followerId: string,
  ) {
    await this.pathsService.assertPublisherCanManageFollowers(pathId, userId);
    return this.pathsService.removeFollower(pathId, followerId);
  }
}
