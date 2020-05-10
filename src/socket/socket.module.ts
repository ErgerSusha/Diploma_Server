import { Module } from '@nestjs/common';
import { SocketsController } from './socket.gateway';

@Module({
    providers: [SocketsController]
})
export class SocketModule { }