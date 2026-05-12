import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { PathsService } from './paths.service';
import { CreatePathDto } from './dto/create-path.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('paths')
export class PathsController {
  constructor(private readonly pathsService: PathsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async createPath(@Request() req: any, @Body() createPathDto: CreatePathDto) {
    return this.pathsService.createPath(req.user.id, createPathDto);
  }

  @Get()
  async getAllPaths() {
    return this.pathsService.getAllPaths();
  }

  @Get('published/my-paths')
  @UseGuards(JwtAuthGuard)
  async getMyPublishedPaths(@Request() req: any) {
    return this.pathsService.getPublishedPathsByUser(req.user.id);
  }

  @Get('followed/my-paths')
  @UseGuards(JwtAuthGuard)
  async getMyFollowedPaths(@Request() req: any) {
    return this.pathsService.getFollowedPathsByUser(req.user.id);
  }

  @Get(':id')
  async getPathById(@Param('id') pathId: string) {
    return this.pathsService.getPathById(pathId);
  }

  @Post(':id/follow')
  @UseGuards(JwtAuthGuard)
  async followPath(@Request() req: any, @Param('id') pathId: string) {
    return this.pathsService.followPath(req.user.id, pathId);
  }

  @Post(':id/unfollow')
  @UseGuards(JwtAuthGuard)
  async unfollowPath(@Request() req: any, @Param('id') pathId: string) {
    return this.pathsService.unfollowPath(req.user.id, pathId);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  async updatePath(
    @Param('id') pathId: string,
    @Body() updatePathDto: CreatePathDto,
  ) {
    return this.pathsService.updatePath(pathId, updatePathDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async deletePath(@Param('id') pathId: string) {
    return this.pathsService.deletePath(pathId);
  }

  @Get(':id/followers')
  async getFollowers(@Param('id') pathId: string) {
    return this.pathsService.getFollowersWithDetails(pathId);
  }

  @Delete(':id/followers/:followerId')
  @UseGuards(JwtAuthGuard)
  async removeFollower(
    @Request() req: any,
    @Param('id') pathId: string,
    @Param('followerId') followerId: string,
  ) {
    await this.pathsService.assertPublisherCanManageFollowers(
      pathId,
      req.user.id,
    );
    return this.pathsService.removeFollower(pathId, followerId);
  }
}
