import { Logger } from '@nestjs/common';
import { OnGatewayInit, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: '*'
  }
})
export class PropertiesUpdatesGateway implements OnGatewayInit {
  private readonly logger = new Logger(PropertiesUpdatesGateway.name);

  @WebSocketServer()
  server!: Server;

  afterInit(): void {
    this.logger.log('WebSocket gateway initialized.');
  }

  emitPropertiesCountUpdated(count: number): void {
    this.server.emit('properties-count-updated', { count });
  }
}
