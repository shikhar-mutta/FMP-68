import {
  Controller, Get, Post, Put, Delete, Param, Body, UseGuards, Request,
} from '@nestjs/common';
import { PathsService } from './paths.service';
import { CreatePathDto } from './dto/create-path.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('paths')
export class PathsController {
  constructor(private pathsService: PathsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  createPath(@Request() req: any, @Body() dto: CreatePathDto) {
    return this.pathsService.createPath(req.user.id, dto);
  }

  @Get()
  getAllPaths() { return this.pathsService.getAllPaths(); }

  @Get('published/my-paths')
  @UseGuards(JwtAuthGuard)
  getMyPublishedPaths(@Request() req: any) {
    return this.pathsService.getPublishedPathsByUser(req.user.id);
  }

  @Get('followed/my-paths')
  @UseGuards(JwtAuthGuard)
  getMyFollowedPaths(@Request() req: any) {
    return this.pathsService.getFollowedPathsByUser(req.user.id);
  }

  @Get(':id')
  getPathById(@Param('id') pathId: string) {
    return this.pathsService.getPathById(pathId);
  }

  @Post(':id/follow')
  @UseGuards(JwtAuthGuard)
  followPath(@Request() req: any, @Param('id') pathId: string) {
    return this.pathsService.followPath(req.user.id, pathId);
  }

  @Post(':id/unfollow')
  @UseGuards(JwtAuthGuard)
  unfollowPath(@Request() req: any, @Param('id') pathId: string) {
    return this.pathsService.unfollowPath(req.user.id, pathId);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  updatePath(@Param('id') pathId: string, @Body() dto: CreatePathDto) {
    return this.pathsService.updatePath(pathId, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  deletePath(@Param('id') pathId: string) {
    return this.pathsService.deletePath(pathId);
  }

  @Get(':id/followers')
  getFollowers(@Param('id') pathId: string) {
    return this.pathsService.getFollowersWithDetails(pathId);
  }

  @Delete(':id/followers/:followerId')
  @UseGuards(JwtAuthGuard)
  async removeFollower(@Request() req: any, @Param('id') pathId: string, @Param('followerId') followerId: string) {
    const path = await this.pathsService.getPathById(pathId);
    if (!path) throw new Error('Path not found');
    if (path.publisherId !== req.user.id) throw new Error('Only the publisher can remove followers');
    return this.pathsService.removeFollower(pathId, followerId);
  }
}
