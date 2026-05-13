import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

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

  async findManyByIds(ids: string[]) {
    if (ids.length === 0) return [];
    try {
      const { data } = await firstValueFrom(
        this.http.post(`${this.baseUrl}/internal/users/by-ids`, { ids }),
      );
      return data ?? [];
    } catch (err: any) {
      this.logger.error(`findManyByIds failed: ${err?.message ?? err}`);
      return [];
    }
  }

  async findFollowerProfilesByIds(ids: string[]) {
    if (ids.length === 0) return [];
    try {
      const { data } = await firstValueFrom(
        this.http.post(`${this.baseUrl}/internal/users/follower-profiles`, {
          ids,
        }),
      );
      return data ?? [];
    } catch (err: any) {
      this.logger.error(
        `findFollowerProfilesByIds failed: ${err?.message ?? err}`,
      );
      return [];
    }
  }
}
