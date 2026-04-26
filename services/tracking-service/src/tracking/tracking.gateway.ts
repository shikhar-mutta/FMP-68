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
    origin: '*',
    credentials: true,
  },
  namespace: '/tracking',
})
export class TrackingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private logger = new Logger('TrackingGateway');
  private userRooms = new Map<string, Set<string>>();

  constructor(private prisma: PrismaService) {}

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
  async handleStartTracking(@ConnectedSocket() client: Socket, @MessageBody() data: { pathId: string; userId: string }) {
    const { pathId, userId } = data;
    this.logger.log(`User ${userId} starting tracking for path ${pathId}`);
    try {
      await this.prisma.path.update({ where: { id: pathId }, data: { status: 'recording', isLive: true, coordinates: [] } });
      await this.prisma.trackingSession.create({ data: { pathId, userId, role: 'publisher', coordinates: [], isActive: true } });
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
    @MessageBody() data: { pathId: string; userId: string; coordinate: Coordinate; role: string },
  ) {
    const { pathId, userId, coordinate, role } = data;
    const room = `path-${pathId}`;
    try {
      if (role === 'publisher') {
        await this.prisma.path.update({ where: { id: pathId }, data: { coordinates: { push: coordinate as any } } });
        await this.prisma.trackingSession.updateMany({ where: { pathId, userId, role: 'publisher', isActive: true }, data: { coordinates: { push: coordinate as any } } });
      } else {
        await this.prisma.trackingSession.updateMany({ where: { pathId, userId, role: 'follower', isActive: true }, data: { coordinates: { push: coordinate as any } } });
      }
      client.to(room).emit('location-update', { pathId, userId, coordinate, role });
      return { success: true };
    } catch (error) {
      this.logger.error('Error sending location:', error);
      return { success: false };
    }
  }

  @SubscribeMessage('pause-tracking')
  async handlePauseTracking(@ConnectedSocket() client: Socket, @MessageBody() data: { pathId: string; userId: string }) {
    const { pathId, userId } = data;
    try {
      await this.prisma.path.update({ where: { id: pathId }, data: { status: 'paused' } });
      const room = `path-${pathId}`;
      this.server.to(room).emit('tracking-paused', { pathId, userId });
      return { success: true, message: 'Tracking paused' };
    } catch (error) {
      return { success: false, message: 'Failed to pause tracking' };
    }
  }

  @SubscribeMessage('resume-tracking')
  async handleResumeTracking(@ConnectedSocket() client: Socket, @MessageBody() data: { pathId: string; userId: string }) {
    const { pathId, userId } = data;
    try {
      await this.prisma.path.update({ where: { id: pathId }, data: { status: 'recording', isLive: true } });
      const room = `path-${pathId}`;
      this.server.to(room).emit('tracking-resumed', { pathId, userId });
      return { success: true, message: 'Tracking resumed' };
    } catch (error) {
      return { success: false, message: 'Failed to resume tracking' };
    }
  }

  @SubscribeMessage('end-tracking')
  async handleEndTracking(@ConnectedSocket() client: Socket, @MessageBody() data: { pathId: string; userId: string }) {
    const { pathId, userId } = data;
    try {
      await this.prisma.path.update({ where: { id: pathId }, data: { status: 'ended', isLive: false } });
      await this.prisma.trackingSession.updateMany({ where: { pathId, isActive: true }, data: { isActive: false, endedAt: new Date() } });
      const room = `path-${pathId}`;
      this.server.to(room).emit('tracking-ended', { pathId, userId });
      return { success: true, message: 'Tracking ended' };
    } catch (error) {
      return { success: false, message: 'Failed to end tracking' };
    }
  }

  @SubscribeMessage('join-tracking')
  async handleJoinTracking(@ConnectedSocket() client: Socket, @MessageBody() data: { pathId: string; userId: string }) {
    const { pathId, userId } = data;
    try {
      const room = `path-${pathId}`;
      client.join(room);
      this.addRoom(client.id, room);
      const existing = await this.prisma.trackingSession.findFirst({ where: { pathId, userId, role: 'follower', isActive: true } });
      if (!existing) {
        await this.prisma.trackingSession.create({ data: { pathId, userId, role: 'follower', coordinates: [], isActive: true } });
      }
      const path = await this.prisma.path.findUnique({ where: { id: pathId } });
      client.to(room).emit('follower-joined', { pathId, userId });
      return { success: true, message: 'Joined tracking', publisherCoordinates: path?.coordinates || [], pathStatus: path?.status || 'idle' };
    } catch (error) {
      return { success: false, message: 'Failed to join tracking' };
    }
  }

  @SubscribeMessage('leave-tracking')
  async handleLeaveTracking(@ConnectedSocket() client: Socket, @MessageBody() data: { pathId: string; userId: string }) {
    const { pathId, userId } = data;
    const room = `path-${pathId}`;
    client.leave(room);
    this.removeRoom(client.id, room);
    await this.prisma.trackingSession.updateMany({ where: { pathId, userId, role: 'follower', isActive: true }, data: { isActive: false, endedAt: new Date() } });
    client.to(room).emit('follower-left', { pathId, userId });
    return { success: true, message: 'Left tracking' };
  }

  @SubscribeMessage('get-tracking-data')
  async handleGetTrackingData(@ConnectedSocket() client: Socket, @MessageBody() data: { pathId: string }) {
    const { pathId } = data;
    try {
      const path = await this.prisma.path.findUnique({ where: { id: pathId } });
      const sessions = await this.prisma.trackingSession.findMany({ where: { pathId, isActive: true } });
      return { success: true, path, sessions };
    } catch (error) {
      return { success: false };
    }
  }

  private addRoom(clientId: string, room: string) {
    if (!this.userRooms.has(clientId)) this.userRooms.set(clientId, new Set());
    this.userRooms.get(clientId)!.add(room);
  }

  private removeRoom(clientId: string, room: string) {
    this.userRooms.get(clientId)?.delete(room);
  }
}
