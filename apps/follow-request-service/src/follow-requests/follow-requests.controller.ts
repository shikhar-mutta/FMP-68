import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Query,
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
    @Headers('x-user-id') userId: string,
    @Body() dto: CreateFollowRequestDto,
  ) {
    return this.followRequestsService.createFollowRequest(
      userId,
      dto,
    );
  }

  @Post('approve')
  approve(
    @Headers('x-user-id') publisherId: string,
    @Body() dto: ApproveFollowRequestDto,
  ) {
    return this.followRequestsService.approveFollowRequest(
      dto.pathId,
      dto.requesterId,
      publisherId,
    );
  }

  @Post('reject')
  reject(
    @Headers('x-user-id') publisherId: string,
    @Body() dto: ApproveFollowRequestDto,
  ) {
    return this.followRequestsService.rejectFollowRequest(
      dto.pathId,
      dto.requesterId,
      publisherId,
    );
  }

  @Delete()
  cancel(
    @Headers('x-user-id') requesterId: string,
    @Query('pathId') pathId: string,
  ) {
    return this.followRequestsService.cancelFollowRequest(
      pathId,
      requesterId,
    );
  }

  @Get('pending')
  getPending(
    @Headers('x-user-id') publisherId: string,
  ) {
    return this.followRequestsService.getPendingRequestsForPublisher(
      publisherId,
    );
  }

  @Get('sent')
  getSent(
    @Headers('x-user-id') requesterId: string,
  ) {
    return this.followRequestsService.getSentRequests(
      requesterId,
    );
  }

  @Get('path/:pathId')
  getRequestsForPath(
    @Param('pathId') pathId: string,
  ) {
    return this.followRequestsService.getRequestsForPath(
      pathId,
    );
  }

  @Get(':pathId/followers')
  getFollowers(
    @Param('pathId') pathId: string,
  ) {
    return this.followRequestsService.getFollowers(pathId);
  }
}