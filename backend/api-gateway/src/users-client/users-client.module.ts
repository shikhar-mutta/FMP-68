import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { UsersClientService } from './users-client.service';

@Module({
  imports: [HttpModule.register({ timeout: 5000 })],
  providers: [UsersClientService],
  exports: [UsersClientService],
})
export class UsersClientModule {}
