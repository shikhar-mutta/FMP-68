import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    try {
      await this.$connect();
    } catch (err) {
      console.warn('[PrismaService] startup connect failed (will retry on first query):', err?.message);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
