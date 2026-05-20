import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import * as amqplib from 'amqplib';

export const FMP_NOTIFICATIONS_EXCHANGE = 'fmp.notifications';

@Injectable()
export class RabbitmqService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitmqService.name);
  private readonly url =
    process.env.RABBITMQ_URL || 'amqp://guest:guest@rabbitmq:5672';
  private connection: any = null;
  private channel: any = null;
  private connecting = false;
  private destroyed = false;

  async onModuleInit() {
    void this.connect();
  }

  async onModuleDestroy() {
    this.destroyed = true;
    try {
      await this.channel?.close();
    } catch {
      /* ignore */
    }
    try {
      await this.connection?.close();
    } catch {
      /* ignore */
    }
  }

  private async connect(): Promise<void> {
    if (this.destroyed || this.connecting || this.channel) return;
    this.connecting = true;
    try {
      this.connection = await amqplib.connect(this.url);
      this.connection.on('error', (e: any) =>
        this.logger.warn(`AMQP connection error: ${e?.message ?? e}`),
      );
      this.connection.on('close', () => {
        this.channel = null;
        this.connection = null;
        if (!this.destroyed) {
          this.logger.warn('AMQP connection closed; reconnecting in 5s');
          setTimeout(() => void this.connect(), 5000);
        }
      });
      this.channel = await this.connection.createChannel();
      await this.channel.assertExchange(FMP_NOTIFICATIONS_EXCHANGE, 'topic', {
        durable: true,
      });
      this.logger.log(
        `Connected to RabbitMQ; exchange "${FMP_NOTIFICATIONS_EXCHANGE}" asserted`,
      );
    } catch (err: any) {
      this.channel = null;
      this.connection = null;
      this.logger.warn(
        `RabbitMQ unavailable (${err?.message ?? err}); retrying in 5s`,
      );
      if (!this.destroyed) setTimeout(() => void this.connect(), 5000);
    } finally {
      this.connecting = false;
    }
  }

  publish(routingKey: string, payload: unknown): void {
    if (!this.channel) {
      this.logger.debug(
        `Dropping "${routingKey}" — broker channel not ready yet`,
      );
      return;
    }
    try {
      const buf = Buffer.from(JSON.stringify(payload));
      this.channel.publish(FMP_NOTIFICATIONS_EXCHANGE, routingKey, buf, {
        contentType: 'application/json',
        persistent: true,
        timestamp: Date.now(),
      });
    } catch (err: any) {
      this.logger.warn(
        `Publish failed for "${routingKey}": ${err?.message ?? err}`,
      );
    }
  }
}
