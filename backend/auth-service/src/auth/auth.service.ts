import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersClientService } from './users-client.service';

@Injectable()
export class AuthService {
  constructor(
    private usersClient: UsersClientService,
    private jwtService: JwtService,
  ) {}

  /** Called after Google OAuth callback — find/create user via users-service, issue JWT */
  async loginWithGoogle(
    googleUser: any,
  ): Promise<{ accessToken: string; user: any }> {
    const user = await this.usersClient.findOrCreate({
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
}
