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
import { Coordinate, LocationPayload } from './tracking.types';

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

  constructor(private readonly trackingService: TrackingService) {}

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

  // ─── Publisher starts tracking ──────────────────────────────────────
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

  // ─── Publisher sends GPS coordinate ─────────────────────────────────
  @SubscribeMessage('send-location')
  async handleSendLocation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: LocationPayload,
  ) {
    const { pathId, userId, coordinate, role } = data;
    const room = `path-${pathId}`;

    try {
      await this.trackingService.recordLocation(data);

      client.to(room).emit('location-update', {
        pathId,
        userId,
        coordinate,
        role,
      });

      return { success: true };
    } catch (error) {
      this.logger.error('Error sending location:', error);
      return { success: false };
    }
  }

  // ─── Pause tracking ─────────────────────────────────────────────────
  @SubscribeMessage('pause-tracking')
  async handlePauseTracking(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { pathId: string; userId: string },
  ) {
    const { pathId, userId } = data;
    this.logger.log(`User ${userId} pausing tracking for path ${pathId}`);

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

  // ─── Resume tracking ────────────────────────────────────────────────
  @SubscribeMessage('resume-tracking')
  async handleResumeTracking(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { pathId: string; userId: string },
  ) {
    const { pathId, userId } = data;
    this.logger.log(`User ${userId} resuming tracking for path ${pathId}`);

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

  // ─── End tracking ───────────────────────────────────────────────────
  @SubscribeMessage('end-tracking')
  async handleEndTracking(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { pathId: string; userId: string },
  ) {
    const { pathId, userId } = data;
    this.logger.log(`User ${userId} ending tracking for path ${pathId}`);

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

  // ─── Follower joins a path's live tracking ──────────────────────────
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

      return {
        success: true,
        message: 'Joined tracking',
        publisherCoordinates: path?.coordinates || [],
        pathStatus: path?.status || 'idle',
      };
    } catch (error) {
      this.logger.error('Error joining tracking:', error);
      return { success: false, message: 'Failed to join tracking' };
    }
  }

  // ─── Leave tracking room ────────────────────────────────────────────
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

  // ─── Get path tracking data ─────────────────────────────────────────
  @SubscribeMessage('get-tracking-data')
  async handleGetTrackingData(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { pathId: string },
  ) {
    const { pathId } = data;

    try {
      const { path, sessions } =
        await this.trackingService.getTrackingData(pathId);

      return {
        success: true,
        path,
        sessions,
      };
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
