import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { FollowRequestsService } from './follow-requests.service';
import { CreateFollowRequestDto } from './dto/create-follow-request.dto';
import { ApproveFollowRequestDto } from './dto/approve-follow-request.dto';
import { CurrentUserId } from '../common/current-user.decorator';

@Controller('follow-requests')
export class FollowRequestsController {
  private logger = new Logger(FollowRequestsController.name);

  constructor(private followRequestsService: FollowRequestsService) {}

  @Post()
  async createFollowRequest(
    @CurrentUserId() userId: string,
    @Body() createFollowRequestDto: CreateFollowRequestDto,
  ) {
    try {
      const result = await this.followRequestsService.createFollowRequest(
        userId,
        createFollowRequestDto,
      );
      return result;
    } catch (error: unknown) {
      this.logger.error('Error creating follow request:', error);
      throw this.toBadRequest(error, 'Failed to create follow request');
    }
  }

  @Get('pending')
  async getPendingFollowRequests(@CurrentUserId() userId: string) {
    try {
      return await this.followRequestsService.getPendingFollowRequestsForPublisher(
        userId,
      );
    } catch (error: unknown) {
      this.logger.error('Error getting pending requests:', error);
      throw this.toBadRequest(error, 'Failed to get pending requests');
    }
  }

  @Get('sent')
  async getSentFollowRequests(@CurrentUserId() userId: string) {
    try {
      return await this.followRequestsService.getFollowRequestsSentByUser(
        userId,
      );
    } catch (error: unknown) {
      this.logger.error('Error getting sent requests:', error);
      throw this.toBadRequest(error, 'Failed to get sent requests');
    }
  }

  /** Publicly readable */
  @Get('path/:pathId')
  async getFollowRequestsForPath(@Param('pathId') pathId: string) {
    try {
      return await this.followRequestsService.getFollowRequestsForPath(pathId);
    } catch (error: unknown) {
      this.logger.error('Error getting requests for path:', error);
      throw this.toBadRequest(error, 'Failed to get requests for path');
    }
  }

  @Post('approve')
  async approveFollowRequest(
    @CurrentUserId() userId: string,
    @Body() dto: ApproveFollowRequestDto,
  ) {
    try {
      return await this.followRequestsService.approveFollowRequest(
        dto.pathId,
        dto.userId,
        userId,
      );
    } catch (error: unknown) {
      this.logger.error('Error approving follow request:', error);
      throw this.toBadRequest(error, 'Failed to approve follow request');
    }
  }

  @Post('reject')
  async rejectFollowRequest(
    @CurrentUserId() userId: string,
    @Body() dto: ApproveFollowRequestDto,
  ) {
    try {
      return await this.followRequestsService.rejectFollowRequest(
        dto.pathId,
        dto.userId,
        userId,
      );
    } catch (error: unknown) {
      this.logger.error('Error rejecting follow request:', error);
      throw this.toBadRequest(error, 'Failed to reject follow request');
    }
  }

  @Delete()
  async cancelFollowRequest(
    @CurrentUserId() userId: string,
    @Query() query: { pathId: string },
  ) {
    try {
      return await this.followRequestsService.cancelFollowRequest(
        query.pathId,
        userId,
      );
    } catch (error: unknown) {
      this.logger.error('Error cancelling follow request:', error);
      throw this.toBadRequest(error, 'Failed to cancel follow request');
    }
  }

  private toBadRequest(error: unknown, fallback: string) {
    const message = error instanceof Error ? error.message : fallback;
    return new HttpException(
      { statusCode: HttpStatus.BAD_REQUEST, message, error: 'Bad Request' },
      HttpStatus.BAD_REQUEST,
    );
  }
}
