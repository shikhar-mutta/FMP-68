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
  constructor(private pathsService: PathsService) {}

  // Create a new path
  @Post()
  @UseGuards(JwtAuthGuard)
  async createPath(@Request() req: any, @Body() createPathDto: CreatePathDto) {
    return this.pathsService.createPath(req.user.id, createPathDto);
  }

  // Get all paths
  @Get()
  async getAllPaths() {
    return this.pathsService.getAllPaths();
  }

  // Get path by ID
  @Get(':id')
  async getPathById(@Param('id') pathId: string) {
    return this.pathsService.getPathById(pathId);
  }

  // Get paths published by current user
  @Get('published/my-paths')
  @UseGuards(JwtAuthGuard)
  async getMyPublishedPaths(@Request() req: any) {
    return this.pathsService.getPublishedPathsByUser(req.user.id);
  }

  // Get paths followed by current user
  @Get('followed/my-paths')
  @UseGuards(JwtAuthGuard)
  async getMyFollowedPaths(@Request() req: any) {
    return this.pathsService.getFollowedPathsByUser(req.user.id);
  }

  // Follow a path (Use /follow-requests endpoint instead for requesting to follow)
  // This endpoint is used internally after a follow request is approved
  @Post(':id/follow')
  @UseGuards(JwtAuthGuard)
  async followPath(@Request() req: any, @Param('id') pathId: string) {
    return this.pathsService.followPath(req.user.id, pathId);
  }

  // Unfollow a path
  @Post(':id/unfollow')
  @UseGuards(JwtAuthGuard)
  async unfollowPath(@Request() req: any, @Param('id') pathId: string) {
    return this.pathsService.unfollowPath(req.user.id, pathId);
  }

  // Update a path
  @Put(':id')
  @UseGuards(JwtAuthGuard)
  async updatePath(
    @Param('id') pathId: string,
    @Body() updatePathDto: CreatePathDto,
  ) {
    return this.pathsService.updatePath(pathId, updatePathDto);
  }

  // Delete a path
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async deletePath(@Param('id') pathId: string) {
    return this.pathsService.deletePath(pathId);
  }
}
