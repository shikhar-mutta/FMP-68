import { Injectable } from '@nestjs/common';

import { CreatePathDto } from './dto/create-path.dto';

@Injectable()
export class PathsService {
  private paths: any[] = [];

  async createPath(
    userId: string,
    createPathDto: CreatePathDto,
  ) {
    const path = {
      id: Date.now().toString(),
      title: createPathDto.title,
      description: createPathDto.description || '',
      publisherId: userId,
      coordinates: [],
      status: 'idle',
      createdAt: new Date(),
    };

    this.paths.push(path);

    return path;
  }

  async getAllPaths() {
    return this.paths;
  }

  async getPathById(pathId: string) {
    return this.paths.find((p) => p.id === pathId);
  }

  async getPublishedPathsByUser(userId: string) {
    return this.paths.filter(
      (p) => p.publisherId === userId,
    );
  }

  async updatePath(
    pathId: string,
    updateData: CreatePathDto,
  ) {
    const path = this.paths.find(
      (p) => p.id === pathId,
    );

    if (!path) {
      throw new Error('Path not found');
    }

    path.title = updateData.title;
    path.description =
      updateData.description || '';

    return path;
  }

  async deletePath(pathId: string) {
    this.paths = this.paths.filter(
      (p) => p.id !== pathId,
    );

    return {
      message: 'Path deleted',
    };
  }

  async resetPath(
    pathId: string,
    publisherId: string,
  ) {
    const path = this.paths.find(
      (p) => p.id === pathId,
    );

    if (!path) {
      throw new Error('Path not found');
    }

    if (path.publisherId !== publisherId) {
      throw new Error(
        'Only publisher can reset path',
      );
    }

    path.coordinates = [];
    path.status = 'idle';

    return path;
  }
}