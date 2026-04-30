import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqplib from 'amqplib';

export const EXCHANGE = 'fmp68.events';
export const FOLLOW_APPROVED = 'follow.request.approved';
export const FOLLOW_REJECTED = 'follow.request.rejected';
export const FOLLOW_CREATED  = 'follow.request.created';

@Injectable()
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMQService.name);
  private model: amqplib.ChannelModel | null = null;
  private channel: amqplib.Channel | null = null;
  private readonly url: string;

  constructor(private config: ConfigService) {
    this.url = config.get<string>('RABBITMQ_URL') || 'amqp://fmp68:fmp68pass@localhost:5672';
  }

  async onModuleInit() {
    const maxRetries = 5;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.model   = await amqplib.connect(this.url) as unknown as amqplib.ChannelModel;
        this.channel = await (this.model as any).createChannel();
        await this.channel!.assertExchange(EXCHANGE, 'topic', { durable: true });
        this.logger.log(`📨 RabbitMQ connected (attempt ${attempt}) — exchange: ${EXCHANGE}`);
        return;
      } catch (err) {
        this.logger.warn(`RabbitMQ attempt ${attempt}/${maxRetries} failed: ${(err as Error).message}`);
        if (attempt < maxRetries) await new Promise(r => setTimeout(r, 5000));
      }
    }
    this.logger.warn('RabbitMQ unavailable after retries — continuing without message broker');
  }

  async publish(routingKey: string, payload: object): Promise<void> {
    if (!this.channel) {
      this.logger.warn(`RabbitMQ not ready, skipping publish [${routingKey}]`);
      return;
    }
    try {
      const msg = Buffer.from(JSON.stringify({ routingKey, payload, ts: Date.now() }));
      this.channel.publish(EXCHANGE, routingKey, msg, { persistent: true });
      this.logger.log(`📤 Published [${routingKey}]`);
    } catch (err) {
      this.logger.error(`Publish failed: ${(err as Error).message}`);
    }
  }

  async onModuleDestroy() {
    try { await this.channel?.close(); } catch {}
    try { await (this.model as any)?.close(); } catch {}
  }
}
