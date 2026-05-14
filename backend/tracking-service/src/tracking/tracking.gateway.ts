import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { TrackingService } from './tracking.service';
import { TrailCacheService } from './trail-cache.service';
import { LocationPayload } from './tracking.types';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
  namespace: '/tracking',
})
export class TrackingGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private logger = new Logger('TrackingGateway');

  private userRooms = new Map<string, Set<string>>();

  constructor(
    private readonly trackingService: TrackingService,
    private readonly trailCache: TrailCacheService,
  ) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    const rooms = this.userRooms.get(client.id);
    if (rooms) {
      rooms.forEach((room) => client.leave(room));
      this.userRooms.delete(client.id);
    }
  }

  @SubscribeMessage('start-tracking')
  async handleStartTracking(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { pathId: string; userId: string },
  ) {
    const { pathId, userId } = data;
    this.logger.log(`User ${userId} starting tracking for path ${pathId}`);

    try {
      await this.trackingService.startTracking(pathId, userId);

      const room = `path-${pathId}`;
      client.join(room);
      this.addRoom(client.id, room);

      this.server.to(room).emit('tracking-started', { pathId, userId });

      return { success: true, message: 'Tracking started' };
    } catch (error) {
      this.logger.error('Error starting tracking:', error);
      return { success: false, message: 'Failed to start tracking' };
    }
  }

  @SubscribeMessage('send-location')
  async handleSendLocation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: LocationPayload,
  ) {
    const { pathId, userId, coordinate, role } = data;
    const room = `path-${pathId}`;

    // Cache + broadcast first, persist second. The cache and the live
    // emit drive the user-visible feature; Mongo is the durable record
    // and must not block the broadcast if it's slow or misses a row.
    this.trailCache.appendCoord(pathId, coordinate).catch(() => {});
    client.to(room).emit('location-update', {
      pathId,
      userId,
      coordinate,
      role,
    });

    try {
      await this.trackingService.recordLocation(data);
      return { success: true };
    } catch (error) {
      this.logger.error('Error sending location:', error);
      return { success: false, cached: true };
    }
  }

  @SubscribeMessage('pause-tracking')
  async handlePauseTracking(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { pathId: string; userId: string },
  ) {
    const { pathId, userId } = data;
    try {
      await this.trackingService.pauseTracking(pathId);
      const room = `path-${pathId}`;
      this.server.to(room).emit('tracking-paused', { pathId, userId });
      return { success: true, message: 'Tracking paused' };
    } catch (error) {
      this.logger.error('Error pausing tracking:', error);
      return { success: false, message: 'Failed to pause tracking' };
    }
  }

  @SubscribeMessage('resume-tracking')
  async handleResumeTracking(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { pathId: string; userId: string },
  ) {
    const { pathId, userId } = data;
    try {
      await this.trackingService.resumeTracking(pathId);
      const room = `path-${pathId}`;
      this.server.to(room).emit('tracking-resumed', { pathId, userId });
      return { success: true, message: 'Tracking resumed' };
    } catch (error) {
      this.logger.error('Error resuming tracking:', error);
      return { success: false, message: 'Failed to resume tracking' };
    }
  }

  @SubscribeMessage('end-tracking')
  async handleEndTracking(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { pathId: string; userId: string },
  ) {
    const { pathId, userId } = data;
    try {
      await this.trackingService.endTracking(pathId);
      const room = `path-${pathId}`;
      this.server.to(room).emit('tracking-ended', { pathId, userId });
      return { success: true, message: 'Tracking ended' };
    } catch (error) {
      this.logger.error('Error ending tracking:', error);
      return { success: false, message: 'Failed to end tracking' };
    }
  }

  @SubscribeMessage('join-tracking')
  async handleJoinTracking(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { pathId: string; userId: string },
  ) {
    const { pathId, userId } = data;
    this.logger.log(`Follower ${userId} joining tracking for path ${pathId}`);

    try {
      const room = `path-${pathId}`;
      client.join(room);
      this.addRoom(client.id, room);

      const path = await this.trackingService.joinTracking(pathId, userId);

      client.to(room).emit('follower-joined', { pathId, userId });

      // Prefer the cached recent trail (newest-first, capped at 200) when
      // available; fall back to whatever Mongo returned. Cached entries
      // are reversed so the client receives oldest-first like Mongo.
      const cached = await this.trailCache.getRecentTrail(pathId);
      const publisherCoordinates =
        cached.length > 0 ? cached.slice().reverse() : path?.coordinates || [];

      return {
        success: true,
        message: 'Joined tracking',
        publisherCoordinates,
        pathStatus: path?.status || 'idle',
      };
    } catch (error) {
      this.logger.error('Error joining tracking:', error);
      return { success: false, message: 'Failed to join tracking' };
    }
  }

  @SubscribeMessage('leave-tracking')
  async handleLeaveTracking(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { pathId: string; userId: string },
  ) {
    const { pathId, userId } = data;
    const room = `path-${pathId}`;

    try {
      client.leave(room);
      this.removeRoom(client.id, room);

      await this.trackingService.leaveTracking(pathId, userId);

      client.to(room).emit('follower-left', { pathId, userId });

      return { success: true, message: 'Left tracking' };
    } catch (error) {
      this.logger.error('Error leaving tracking:', error);
      return { success: false, message: 'Failed to leave tracking' };
    }
  }

  @SubscribeMessage('get-tracking-data')
  async handleGetTrackingData(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { pathId: string },
  ) {
    const { pathId } = data;
    try {
      const { path, sessions } =
        await this.trackingService.getTrackingData(pathId);
      return { success: true, path, sessions };
    } catch (error) {
      this.logger.error('Error getting tracking data:', error);
      return { success: false };
    }
  }

  private addRoom(clientId: string, room: string) {
    if (!this.userRooms.has(clientId)) {
      this.userRooms.set(clientId, new Set());
    }
    this.userRooms.get(clientId)!.add(room);
  }

  private removeRoom(clientId: string, room: string) {
    const rooms = this.userRooms.get(clientId);
    if (rooms) {
      rooms.delete(room);
    }
  }
}
