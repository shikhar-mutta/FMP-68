import { Controller, Get, Post, Delete, Body, Param, Query, Request, UseGuards, HttpException, HttpStatus } from '@nestjs/common';
import { FollowRequestsService } from './follow-requests.service';
import { CreateFollowRequestDto } from './dto/create-follow-request.dto';
import { ApproveFollowRequestDto } from './dto/approve-follow-request.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('follow-requests')
export class FollowRequestsController {
  constructor(private svc: FollowRequestsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Request() req: any, @Body() dto: CreateFollowRequestDto) {
    try { return await this.svc.createFollowRequest(req.user.id, dto); }
    catch (e: any) { throw new HttpException(e.message, HttpStatus.BAD_REQUEST); }
  }

  @Get('pending')
  @UseGuards(JwtAuthGuard)
  async getPending(@Request() req: any) {
    try { return await this.svc.getPendingFollowRequestsForPublisher(req.user.id); }
    catch (e: any) { throw new HttpException(e.message, HttpStatus.BAD_REQUEST); }
  }

  @Get('sent')
  @UseGuards(JwtAuthGuard)
  async getSent(@Request() req: any) {
    try { return await this.svc.getFollowRequestsSentByUser(req.user.id); }
    catch (e: any) { throw new HttpException(e.message, HttpStatus.BAD_REQUEST); }
  }

  @Get('path/:pathId')
  async getForPath(@Param('pathId') pathId: string) {
    try { return await this.svc.getFollowRequestsForPath(pathId); }
    catch (e: any) { throw new HttpException(e.message, HttpStatus.BAD_REQUEST); }
  }

  @Post('approve')
  @UseGuards(JwtAuthGuard)
  async approve(@Request() req: any, @Body() dto: ApproveFollowRequestDto) {
    try { return await this.svc.approveFollowRequest(dto.pathId, dto.userId, req.user.id); }
    catch (e: any) { throw new HttpException(e.message, HttpStatus.BAD_REQUEST); }
  }

  @Post('reject')
  @UseGuards(JwtAuthGuard)
  async reject(@Request() req: any, @Body() dto: ApproveFollowRequestDto) {
    try { return await this.svc.rejectFollowRequest(dto.pathId, dto.userId, req.user.id); }
    catch (e: any) { throw new HttpException(e.message, HttpStatus.BAD_REQUEST); }
  }

  @Delete()
  @UseGuards(JwtAuthGuard)
  async cancel(@Request() req: any, @Query('pathId') pathId: string) {
    try { return await this.svc.cancelFollowRequest(pathId, req.user.id); }
    catch (e: any) { throw new HttpException(e.message, HttpStatus.BAD_REQUEST); }
  }
}
