import { Controller, Get } from '@nestjs/common';
import { UsersService } from './users.service';
import { CurrentUserId } from '../common/current-user.decorator';

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  /** GET /users — list all users with isOnline status */
  @Get()
  async getAllUsers(@CurrentUserId() _userId: string) {
    // _userId enforces that the gateway authenticated the caller
    return this.usersService.findAll();
  }

  /** GET /users/me — current authenticated user (resolved via x-user-id) */
  @Get('me')
  async getMe(@CurrentUserId() userId: string) {
    return this.usersService.findByIdOrThrow(userId);
  }
}
