import { Injectable } from '@nestjs/common';
import { User } from '@prisma/client';
import { UsersRepository } from './users.repository';
import { GoogleProfile } from './users.types';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async findOrCreate(profile: GoogleProfile): Promise<User> {
    const existing = await this.usersRepository.findByGoogleId(
      profile.googleId,
    );

    if (!existing) {
      return this.usersRepository.createFromGoogleProfile(profile);
    }

    return this.usersRepository.markSeenOnline(
      profile.googleId,
      profile.picture || existing.picture,
    );
  }

  async findById(id: string): Promise<User | null> {
    return this.usersRepository.findById(id);
  }

  async setOnlineStatus(userId: string, isOnline: boolean): Promise<User> {
    return this.usersRepository.updateOnlineStatus(userId, isOnline);
  }

  async findAll(): Promise<User[]> {
    return this.usersRepository.findAll();
  }
}
