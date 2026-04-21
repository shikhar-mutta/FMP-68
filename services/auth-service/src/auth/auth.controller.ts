import {
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private config: ConfigService,
  ) {}

  /**
   * GET /auth/google
   * Redirect user to Google consent screen
   */
  @Get('google')
  @UseGuards(GoogleAuthGuard)
  googleLogin() {
    // Handled by Passport — redirects to Google
  }

  /**
   * GET /auth/google/callback
   * Google redirects back here after user consents
   */
  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  async googleCallback(@Req() req: any, @Res() res: Response) {
    const { accessToken } = await this.authService.loginWithGoogle(req.user);
    const frontendUrl = this.config.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/auth/callback?token=${accessToken}`);
  }

  /**
   * POST /auth/signout
   */
  @Post('signout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async signOut(@Req() req: any) {
    return this.authService.signOut(req.user.id);
  }

  /**
   * GET /auth/me
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMe(@Req() req: any) {
    return req.user;
  }
}
