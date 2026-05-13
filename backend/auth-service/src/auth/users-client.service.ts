import { HttpService } from '@nestjs/axios';
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

interface GoogleProfile {
  googleId: string;
  email: string;
  name: string;
  picture: string;
}

@Injectable()
export class UsersClientService {
  private readonly logger = new Logger(UsersClientService.name);
  private readonly baseUrl: string;

  constructor(
    private readonly http: HttpService,
    config: ConfigService,
  ) {
    this.baseUrl =
      config.get<string>('USERS_SERVICE_URL') || 'http://localhost:4002';
  }

  async findOrCreate(profile: GoogleProfile) {
    try {
      const { data } = await firstValueFrom(
        this.http.post(
          `${this.baseUrl}/internal/users/find-or-create`,
          profile,
        ),
      );
      return data;
    } catch (err: any) {
      this.logger.error(`findOrCreate failed: ${err?.message ?? err}`);
      throw new ServiceUnavailableException(
        'users-service unreachable from auth-service',
      );
    }
  }

  async findById(id: string) {
    try {
      const { data } = await firstValueFrom(
        this.http.get(`${this.baseUrl}/internal/users/${id}`),
      );
      return data;
    } catch (err: any) {
      this.logger.error(`findById(${id}) failed: ${err?.message ?? err}`);
      return null;
    }
  }

  async setOnlineStatus(id: string, isOnline: boolean) {
    try {
      const { data } = await firstValueFrom(
        this.http.post(`${this.baseUrl}/internal/users/${id}/online-status`, {
          isOnline,
        }),
      );
      return data;
    } catch (err: any) {
      this.logger.error(
        `setOnlineStatus(${id}, ${isOnline}) failed: ${err?.message ?? err}`,
      );
      return null;
    }
  }
}
