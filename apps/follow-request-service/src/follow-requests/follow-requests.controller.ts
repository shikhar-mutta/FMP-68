import {
  Body,
  Controller,
  Get,
  Param,
  Post,
} from '@nestjs/common';

import { FollowRequestsService } from './follow-requests.service';
import { CreateFollowRequestDto } from './dto/create-follow-request.dto';
import { ApproveFollowRequestDto } from './dto/approve-follow-request.dto';

@Controller('follow-requests')
export class FollowRequestsController {
  constructor(
    private readonly followRequestsService: FollowRequestsService,
  ) {}

  @Post()
  create(
    @Body() dto: CreateFollowRequestDto,
  ) {
    return this.followRequestsService.createFollowRequest(
      'mock-user-id',
      dto,
    );
  }

  @Post('approve')
  approve(
    @Body() dto: ApproveFollowRequestDto,
  ) {
    return this.followRequestsService.approveFollowRequest(
      dto.pathId,
      dto.requesterId,
    );
  }

  @Post('reject')
  reject(
    @Body() dto: ApproveFollowRequestDto,
  ) {
    return this.followRequestsService.rejectFollowRequest(
      dto.pathId,
      dto.requesterId,
    );
  }

  @Get(':pathId/followers')
  getFollowers(
    @Param('pathId') pathId: string,
  ) {
    return this.followRequestsService.getFollowers(pathId);
  }
}