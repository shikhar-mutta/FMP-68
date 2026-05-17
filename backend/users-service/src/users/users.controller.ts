import { BadRequestException, Body, Controller, Get, Patch } from '@nestjs/common';
import { UsersService } from './users.service';
import { CurrentUserId } from '../common/current-user.decorator';

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  /** GET /users — list all users with isOnline status */
  @Get()
  async getAllUsers(@CurrentUserId() _userId: string) {
    return this.usersService.findAll();
  }

  /** GET /users/me — current authenticated user (resolved via x-user-id) */
  @Get('me')
  async getMe(@CurrentUserId() userId: string) {
    return this.usersService.findByIdOrThrow(userId);
  }

  /** PATCH /users/me/username — set or update unique username */
  @Patch('me/username')
  async updateUsername(
    @CurrentUserId() userId: string,
    @Body() body: { username: string },
  ) {
    const { username } = body;
    if (!username || typeof username !== 'string') {
      throw new BadRequestException('username is required');
    }
    const clean = username.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(clean)) {
      throw new BadRequestException(
        'Username must be 3–20 characters, letters, numbers or underscores only',
      );
    }
    return this.usersService.updateUsername(userId, clean);
  }
}
