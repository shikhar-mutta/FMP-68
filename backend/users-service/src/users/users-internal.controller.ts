import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { UsersService } from './users.service';
import { GoogleProfile } from './users.types';

/**
 * Internal HTTP API for service-to-service calls (auth-service, paths-service).
 * These routes are NOT proxied by the api-gateway — they must be called
 * directly via internal service DNS (in K8s/docker-compose).
 */
@Controller('internal/users')
export class UsersInternalController {
  constructor(private readonly usersService: UsersService) {}

  /** POST /internal/users/find-or-create  — called by auth-service after Google OAuth */
  @Post('find-or-create')
  findOrCreate(@Body() profile: GoogleProfile) {
    return this.usersService.findOrCreate(profile);
  }

  /** GET /internal/users/:id  — single-user lookup */
  @Get(':id')
  findById(@Param('id') id: string) {
    return this.usersService.findByIdOrThrow(id);
  }

  /** POST /internal/users/by-ids  — batch lookup, full user records */
  @Post('by-ids')
  findManyByIds(@Body() body: { ids: string[] }) {
    return this.usersService.findManyByIds(body.ids ?? []);
  }

  /** POST /internal/users/follower-profiles  — batch lookup, limited fields */
  @Post('follower-profiles')
  findFollowerProfilesByIds(@Body() body: { ids: string[] }) {
    return this.usersService.findFollowerProfilesByIds(body.ids ?? []);
  }

  /** POST /internal/users/:id/online-status  — called by auth-service on signout */
  @Post(':id/online-status')
  setOnlineStatus(
    @Param('id') id: string,
    @Body() body: { isOnline: boolean },
  ) {
    return this.usersService.setOnlineStatus(id, Boolean(body?.isOnline));
  }
}
