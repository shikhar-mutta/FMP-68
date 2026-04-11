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
import { PrismaService } from '../prisma/prisma.service';

interface Coordinate {
  lat: number;
  lng: number;
  timestamp: number;
}

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

  // Track which users are in which rooms
  private userRooms = new Map<string, Set<string>>();

  constructor(private prisma: PrismaService) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    // Clean up rooms
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
      // Update path status
      await this.prisma.path.update({
        where: { id: pathId },
        data: { status: 'recording', isLive: true, coordinates: [] },
      });

      // Create tracking session
      await this.prisma.trackingSession.create({
        data: {
          pathId,
          userId,
          role: 'publisher',
          coordinates: [],
          isActive: true,
        },
      });

      // Join the path's room
      const room = `path-${pathId}`;
      client.join(room);
      this.addRoom(client.id, room);

      // Notify all followers in this room
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
    @MessageBody()
    data: {
      pathId: string;
      userId: string;
      coordinate: Coordinate;
      role: string;
    },
  ) {
    const { pathId, userId, coordinate, role } = data;
    const room = `path-${pathId}`;

    try {
      if (role === 'publisher') {
        // Save coordinate to path
        await this.prisma.path.update({
          where: { id: pathId },
          data: {
            coordinates: { push: coordinate as any },
          },
        });

        // Also save to tracking session
        await this.prisma.trackingSession.updateMany({
          where: { pathId, userId, role: 'publisher', isActive: true },
          data: {
            coordinates: { push: coordinate as any },
          },
        });
      } else {
        // Save follower's coordinate to their tracking session
        await this.prisma.trackingSession.updateMany({
          where: { pathId, userId, role: 'follower', isActive: true },
          data: {
            coordinates: { push: coordinate as any },
          },
        });
      }

      // Broadcast to entire room (other users see this)
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
      await this.prisma.path.update({
        where: { id: pathId },
        data: { status: 'paused' },
      });

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
      await this.prisma.path.update({
        where: { id: pathId },
        data: { status: 'recording', isLive: true },
      });

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
      await this.prisma.path.update({
        where: { id: pathId },
        data: { status: 'ended', isLive: false },
      });

      // End all active tracking sessions for this path
      await this.prisma.trackingSession.updateMany({
        where: { pathId, isActive: true },
        data: { isActive: false, endedAt: new Date() },
      });

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

      // Create follower tracking session
      const existingSession = await this.prisma.trackingSession.findFirst({
        where: { pathId, userId, role: 'follower', isActive: true },
      });

      if (!existingSession) {
        await this.prisma.trackingSession.create({
          data: {
            pathId,
            userId,
            role: 'follower',
            coordinates: [],
            isActive: true,
          },
        });
      }

      // Get the publisher's current coordinates
      const path = await this.prisma.path.findUnique({
        where: { id: pathId },
      });

      // Notify the room that a follower joined
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

    client.leave(room);
    this.removeRoom(client.id, room);

    // End follower's tracking session
    await this.prisma.trackingSession.updateMany({
      where: { pathId, userId, role: 'follower', isActive: true },
      data: { isActive: false, endedAt: new Date() },
    });

    client.to(room).emit('follower-left', { pathId, userId });

    return { success: true, message: 'Left tracking' };
  }

  // ─── Get path tracking data ─────────────────────────────────────────
  @SubscribeMessage('get-tracking-data')
  async handleGetTrackingData(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { pathId: string },
  ) {
    const { pathId } = data;

    try {
      const path = await this.prisma.path.findUnique({
        where: { id: pathId },
        include: { publisher: true },
      });

      const sessions = await this.prisma.trackingSession.findMany({
        where: { pathId, isActive: true },
      });

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

  // ─── Helpers ────────────────────────────────────────────────────────
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
