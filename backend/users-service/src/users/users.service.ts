// ci-test-1778755724
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
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

  async findByIdOrThrow(id: string): Promise<User> {
    const user = await this.usersRepository.findById(id);
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  async findManyByIds(ids: string[]) {
    return this.usersRepository.findManyByIds(ids);
  }

  async findFollowerProfilesByIds(ids: string[]) {
    return this.usersRepository.findFollowerProfilesByIds(ids);
  }

  async setOnlineStatus(userId: string, isOnline: boolean): Promise<User> {
    return this.usersRepository.updateOnlineStatus(userId, isOnline);
  }

  async updateUsername(userId: string, username: string): Promise<User> {
    const taken = await this.usersRepository.findByUsername(username);
    if (taken && taken.id !== userId) {
      throw new ConflictException('Username is already taken');
    }
    return this.usersRepository.updateUsername(userId, username);
  }

  async findAll(): Promise<User[]> {
    return this.usersRepository.findAll();
  }
}
