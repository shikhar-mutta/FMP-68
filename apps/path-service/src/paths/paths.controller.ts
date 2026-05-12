import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
} from '@nestjs/common';

import { CreatePathDto } from './dto/create-path.dto';
import { PathsService } from './paths.service';

@Controller('paths')
export class PathsController {
  constructor(
    private readonly pathsService: PathsService,
  ) {}

  @Post()
  createPath(
    @Body() createPathDto: CreatePathDto,
  ) {
    return this.pathsService.createPath(
      'mock-user-id',
      createPathDto,
    );
  }

  @Get()
  getAllPaths() {
    return this.pathsService.getAllPaths();
  }

  @Get(':id')
  getPathById(
    @Param('id') pathId: string,
  ) {
    return this.pathsService.getPathById(pathId);
  }

  @Get('published/my-paths')
  getMyPublishedPaths() {
    return this.pathsService.getPublishedPathsByUser(
      'mock-user-id',
    );
  }

  @Put(':id')
  updatePath(
    @Param('id') pathId: string,
    @Body() dto: CreatePathDto,
  ) {
    return this.pathsService.updatePath(
      pathId,
      dto,
    );
  }

  @Delete(':id')
  deletePath(
    @Param('id') pathId: string,
  ) {
    return this.pathsService.deletePath(pathId);
  }

  @Post(':id/reset')
  resetPath(
    @Param('id') pathId: string,
  ) {
    return this.pathsService.resetPath(
      pathId,
      'mock-user-id',
    );
  }
}