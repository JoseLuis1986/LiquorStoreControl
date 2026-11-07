import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';

@Injectable()
export class RealtimeService {
  private server: Server | null = null;

  setServer(server: Server) {
    this.server = server;
  }

  emitToTenant(tenantId: string, event: string, payload: unknown) {
    if (!this.server) return;
    this.server.to(`tenant:${tenantId}`).emit(event, {
      at: new Date().toISOString(),
      ...(typeof payload === 'object' && payload ? payload : { data: payload }),
    });
  }
}
