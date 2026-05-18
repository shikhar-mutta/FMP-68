import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { CurrentUserId } from '../common/current-user.decorator';
import { UsersClientService } from './users-client.service';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private usersClient: UsersClientService,
    private config: ConfigService,
  ) {}

  /** GET /auth/google — redirect user to Google consent screen */
  @Get('google')
  @UseGuards(GoogleAuthGuard)
  googleLogin() {
    // Handled by Passport — redirects to Google
  }

  /** GET /auth/google/callback — Google redirects here after consent */
  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  async googleCallback(@Req() req: any, @Res() res: Response) {
    const { accessToken } = await this.authService.loginWithGoogle(req.user);
    // FRONTEND_URL may be a comma-separated list (multi-origin CORS); the
    // post-OAuth redirect needs a single URL — use the first entry.
    const frontendUrl = (
      this.config.get<string>('FRONTEND_URL') || 'http://localhost:3000'
    ).split(',').map((o) => o.trim()).filter(Boolean)[0];
    // Land on the SPA's /oauth/callback route — keep this off the /auth/*
    // prefix that the frontend nginx reserves for backend proxying.
    res.redirect(`${frontendUrl}/oauth/callback?token=${accessToken}`);
  }

  /** GET /auth/me — returns the authenticated user (resolved via x-user-id) */
  @Get('me')
  async getMe(@CurrentUserId() userId: string) {
    const user = await this.usersClient.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  /** POST /auth/signout — marks user offline and returns 200 */
  @Post('signout')
  @HttpCode(HttpStatus.OK)
  async signOut(@CurrentUserId() userId: string) {
    await this.usersClient.setOnlineStatus(userId, false);
    return { message: 'Signed out successfully' };
  }
}
