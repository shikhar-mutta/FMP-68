import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
  Query,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { FollowRequestsService } from './follow-requests.service';
import { CreateFollowRequestDto } from './dto/create-follow-request.dto';
import { ApproveFollowRequestDto } from './dto/approve-follow-request.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('follow-requests')
export class FollowRequestsController {
  private logger = new Logger(FollowRequestsController.name);

  constructor(private followRequestsService: FollowRequestsService) {}

  // Create a new follow request
  @Post()
  @UseGuards(JwtAuthGuard)
  async createFollowRequest(
    @Request() req: any,
    @Body() createFollowRequestDto: CreateFollowRequestDto,
  ) {
    try {
      this.logger.log(
        `Creating follow request for user ${req.user.id} to path ${createFollowRequestDto.pathId}`,
      );
      const result = await this.followRequestsService.createFollowRequest(
        req.user.id,
        createFollowRequestDto,
      );
      this.logger.log('Follow request created successfully');
      return result;
    } catch (error: unknown) {
      this.logger.error('Error creating follow request:', error);
      const message = error instanceof Error ? error.message : 'Failed to create follow request';
      throw new HttpException(
        {
          statusCode: HttpStatus.BAD_REQUEST,
          message: message,
          error: 'Bad Request',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // Get pending follow requests for current user's paths (as publisher)
  @Get('pending')
  @UseGuards(JwtAuthGuard)
  async getPendingFollowRequests(@Request() req: any) {
    try {
      return this.followRequestsService.getPendingFollowRequestsForPublisher(
        req.user.id,
      );
    } catch (error: unknown) {
      this.logger.error('Error getting pending requests:', error);
      const message = error instanceof Error ? error.message : 'Failed to get pending requests';
      throw new HttpException(
        {
          statusCode: HttpStatus.BAD_REQUEST,
          message: message,
          error: 'Bad Request',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // Get follow requests sent by current user
  @Get('sent')
  @UseGuards(JwtAuthGuard)
  async getSentFollowRequests(@Request() req: any) {
    try {
      return this.followRequestsService.getFollowRequestsSentByUser(req.user.id);
    } catch (error: unknown) {
      this.logger.error('Error getting sent requests:', error);
      const message = error instanceof Error ? error.message : 'Failed to get sent requests';
      throw new HttpException(
        {
          statusCode: HttpStatus.BAD_REQUEST,
          message: message,
          error: 'Bad Request',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // Get follow requests for a specific path
  @Get('path/:pathId')
  async getFollowRequestsForPath(@Param('pathId') pathId: string) {
    try {
      return this.followRequestsService.getFollowRequestsForPath(pathId);
    } catch (error: unknown) {
      this.logger.error('Error getting requests for path:', error);
      const message = error instanceof Error ? error.message : 'Failed to get requests for path';
      throw new HttpException(
        {
          statusCode: HttpStatus.BAD_REQUEST,
          message: message,
          error: 'Bad Request',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // Approve a follow request
  @Post('approve')
  @UseGuards(JwtAuthGuard)
  async approveFollowRequest(
    @Request() req: any,
    @Body() dto: ApproveFollowRequestDto,
  ) {
    try {
      this.logger.log(`Approving follow request for user ${dto.userId} to path ${dto.pathId}`);
      // Security: Verify that req.user is the path publisher
      const result = await this.followRequestsService.approveFollowRequest(
        dto.pathId,
        dto.userId,
        req.user.id, // Pass publisher ID for authorization check
      );
      this.logger.log('Follow request approved successfully');
      return result;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to approve follow request';
      this.logger.error(`Error approving follow request: ${message}`);
      throw new HttpException(
        {
          statusCode: HttpStatus.BAD_REQUEST,
          message: message,
          error: 'Bad Request',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // Reject a follow request
  @Post('reject')
  @UseGuards(JwtAuthGuard)
  async rejectFollowRequest(
    @Request() req: any,
    @Body() dto: ApproveFollowRequestDto,
  ) {
    try {
      this.logger.log(`Rejecting follow request for user ${dto.userId} to path ${dto.pathId}`);
      // Security: Verify that req.user is the path publisher
      const result = await this.followRequestsService.rejectFollowRequest(
        dto.pathId,
        dto.userId,
        req.user.id, // Pass publisher ID for authorization check
      );
      this.logger.log('Follow request rejected successfully');
      return result;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to reject follow request';
      this.logger.error(`Error rejecting follow request: ${message}`);
      throw new HttpException(
        {
          statusCode: HttpStatus.BAD_REQUEST,
          message: message,
          error: 'Bad Request',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // Cancel a follow request (by the requester)
  @Delete()
  @UseGuards(JwtAuthGuard)
  async cancelFollowRequest(
    @Request() req: any,
    @Query() query: { pathId: string },
  ) {
    try {
      this.logger.log(`Cancelling follow request for user ${req.user.id} to path ${query.pathId}`);
      const result = await this.followRequestsService.cancelFollowRequest(
        query.pathId,
        req.user.id,
      );
      this.logger.log('Follow request cancelled successfully');
      return result;
    } catch (error: unknown) {
      this.logger.error('Error cancelling follow request:', error);
      const message = error instanceof Error ? error.message : 'Failed to cancel follow request';
      throw new HttpException(
        {
          statusCode: HttpStatus.BAD_REQUEST,
          message: message,
          error: 'Bad Request',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
