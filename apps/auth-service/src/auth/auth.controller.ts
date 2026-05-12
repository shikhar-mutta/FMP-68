import {
  Controller,
  Get,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';

import type { Response } from 'express';

import { AuthGuard } from '@nestjs/passport';

import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
  ) {}

  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth() {}

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(
    @Req() req: any,
    @Res() res: Response,
  ) {
    const token = this.authService.generateJwt(
      req.user,
    );

    return res.redirect(
      `http://localhost:3000/auth/callback?token=${token}`,
    );
  }

  @Get('me')
  getMe() {
    return {
      id: 'mock-user-id',
      name: 'Harsha',
      email: 'demo@example.com',
    };
  }
}