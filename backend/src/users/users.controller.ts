import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  /** GET /users — all users with isOnline status (auth required) */
  @Get()
  @UseGuards(JwtAuthGuard)
  async getAllUsers() {
    return this.usersService.findAll();
  }

  /** GET /users/me — current authenticated user */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@Req() req: any) {
    return req.user;
  }
}
