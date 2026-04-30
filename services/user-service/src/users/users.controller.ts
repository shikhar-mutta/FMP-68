import { Controller, Get, Param, Request, UseGuards, Put, Body } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  findAll() { return this.usersService.findAll(); }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMe(@Request() req: any) { return this.usersService.findById(req.user.id); }

  @Get(':id')
  findById(@Param('id') id: string) { return this.usersService.findById(id); }

  @Get(':id/followed-paths')
  getFollowedPaths(@Param('id') id: string) { return this.usersService.getFollowedPaths(id); }

  @Put('online-status')
  @UseGuards(JwtAuthGuard)
  setOnlineStatus(@Request() req: any, @Body() body: { isOnline: boolean }) {
    return this.usersService.setOnlineStatus(req.user.id, body.isOnline);
  }
}
