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
      // Sparse unique index on username — Prisma doesn't support sparse natively,
      // so we ensure it exists at startup. createIndex is idempotent.
      await this.$runCommandRaw({
        createIndexes: 'users',
        indexes: [
          {
            key: { username: 1 },
            name: 'users_username_unique_sparse',
            unique: true,
            sparse: true,
          },
        ],
      });
    } catch (err) {
      // Log but don't crash — Prisma reconnects lazily on first query.
      // Common cause: DB unreachable at startup (e.g. IP not yet whitelisted).
      console.warn('[PrismaService] startup connect failed (will retry on first query):', err?.message);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
