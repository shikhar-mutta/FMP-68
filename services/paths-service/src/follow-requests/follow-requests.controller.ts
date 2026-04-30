import {
  Controller, Get, Post, Delete, Param, Body, UseGuards, Request, Query,
  HttpException, HttpStatus, Logger,
} from '@nestjs/common';
import { FollowRequestsService } from './follow-requests.service';
import { CreateFollowRequestDto } from './dto/create-follow-request.dto';
import { ApproveFollowRequestDto } from './dto/approve-follow-request.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('follow-requests')
export class FollowRequestsController {
  private logger = new Logger(FollowRequestsController.name);

  constructor(private followRequestsService: FollowRequestsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async createFollowRequest(@Request() req: any, @Body() dto: CreateFollowRequestDto) {
    try {
      return await this.followRequestsService.createFollowRequest(req.user.id, dto);
    } catch (error: any) {
      throw new HttpException({ statusCode: 400, message: error.message }, HttpStatus.BAD_REQUEST);
    }
  }

  @Get('pending')
  @UseGuards(JwtAuthGuard)
  async getPendingFollowRequests(@Request() req: any) {
    try {
      return await this.followRequestsService.getPendingFollowRequestsForPublisher(req.user.id);
    } catch (error: any) {
      throw new HttpException({ statusCode: 400, message: error.message }, HttpStatus.BAD_REQUEST);
    }
  }

  @Get('sent')
  @UseGuards(JwtAuthGuard)
  async getSentFollowRequests(@Request() req: any) {
    try {
      return await this.followRequestsService.getFollowRequestsSentByUser(req.user.id);
    } catch (error: any) {
      throw new HttpException({ statusCode: 400, message: error.message }, HttpStatus.BAD_REQUEST);
    }
  }

  @Get('path/:pathId')
  async getFollowRequestsForPath(@Param('pathId') pathId: string) {
    try {
      return await this.followRequestsService.getFollowRequestsForPath(pathId);
    } catch (error: any) {
      throw new HttpException({ statusCode: 400, message: error.message }, HttpStatus.BAD_REQUEST);
    }
  }

  @Post('approve')
  @UseGuards(JwtAuthGuard)
  async approveFollowRequest(@Request() req: any, @Body() dto: ApproveFollowRequestDto) {
    try {
      return await this.followRequestsService.approveFollowRequest(dto.pathId, dto.userId, req.user.id);
    } catch (error: any) {
      throw new HttpException({ statusCode: 400, message: error.message }, HttpStatus.BAD_REQUEST);
    }
  }

  @Post('reject')
  @UseGuards(JwtAuthGuard)
  async rejectFollowRequest(@Request() req: any, @Body() dto: ApproveFollowRequestDto) {
    try {
      return await this.followRequestsService.rejectFollowRequest(dto.pathId, dto.userId, req.user.id);
    } catch (error: any) {
      throw new HttpException({ statusCode: 400, message: error.message }, HttpStatus.BAD_REQUEST);
    }
  }

  @Delete()
  @UseGuards(JwtAuthGuard)
  async cancelFollowRequest(@Request() req: any, @Query() query: { pathId: string }) {
    try {
      return await this.followRequestsService.cancelFollowRequest(query.pathId, req.user.id);
    } catch (error: any) {
      throw new HttpException({ statusCode: 400, message: error.message }, HttpStatus.BAD_REQUEST);
    }
  }
}
