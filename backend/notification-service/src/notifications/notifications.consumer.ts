import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import * as amqplib from 'amqplib';

export const FMP_NOTIFICATIONS_EXCHANGE = 'fmp.notifications';
export const NOTIFICATIONS_QUEUE = 'notification-service.consumer';

/**
 * AMQP consumer. Asserts the exchange + durable queue + catch-all binding
 * on connect and logs every received event. Self-heals on connection loss.
 */
@Injectable()
export class NotificationsConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationsConsumer.name);
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
      await this.channel.assertQueue(NOTIFICATIONS_QUEUE, { durable: true });
      await this.channel.bindQueue(
        NOTIFICATIONS_QUEUE,
        FMP_NOTIFICATIONS_EXCHANGE,
        '#',
      );
      await this.channel.consume(NOTIFICATIONS_QUEUE, (msg: any) => {
        if (!msg) return;
        try {
          const payload = JSON.parse(msg.content.toString('utf8'));
          this.logger.log(
            `[${msg.fields.routingKey}] ${JSON.stringify(payload)}`,
          );
          this.channel.ack(msg);
        } catch (err: any) {
          this.logger.warn(
            `Failed to handle message: ${err?.message ?? err}`,
          );
          this.channel.nack(msg, false, false);
        }
      });
      this.logger.log(
        `Consuming from "${NOTIFICATIONS_QUEUE}" bound to "${FMP_NOTIFICATIONS_EXCHANGE}"`,
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
}
