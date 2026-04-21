import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { User } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async loginWithGoogle(googleUser: any): Promise<{ accessToken: string; user: User }> {
    const user = await this.usersService.findOrCreate({
      googleId: googleUser.googleId,
      email: googleUser.email,
      name: googleUser.name,
      picture: googleUser.picture,
    });

    const accessToken = this.jwtService.sign({
      sub: user.id,
      email: user.email,
    });

    return { accessToken, user };
  }

  async signOut(userId: string): Promise<{ message: string }> {
    await this.usersService.setOnlineStatus(userId, false);
    return { message: 'Signed out successfully' };
  }

  validateToken(token: string): any {
    try {
      return this.jwtService.verify(token);
    } catch {
      return null;
    }
  }
}
