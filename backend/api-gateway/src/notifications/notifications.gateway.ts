import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: (process.env.FRONTEND_URL || 'http://localhost:3000')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    credentials: true,
  },
  namespace: '/notifications',
})
export class NotificationsGateway {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger('NotificationsGateway');

  @SubscribeMessage('subscribe')
  handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string },
  ) {
    const { userId } = data;
    if (userId) {
      client.join(`user-${userId}`);
      this.logger.log(`User ${userId} subscribed to notifications`);
    }
    return { success: true };
  }

  emitToUser(userId: string, event: string, payload: Record<string, unknown>) {
    this.server.to(`user-${userId}`).emit(event, payload);
  }
}
