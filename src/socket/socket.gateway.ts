import {
  WebSocketGateway,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';

interface ChatSocket extends Socket {
  isAdmin: boolean;
  calleeId: string;
}

@WebSocketGateway()
export class SocketsController implements OnGatewayConnection, OnGatewayDisconnect {

  adminToken = 'op9eeftt345d34d';

  users: ChatSocket[] = [];

  private sendTo(connection: ChatSocket, event: string, data?: any) {
    data ? connection.emit(event, JSON.stringify(data)) : connection.emit(event);
  }

  @SubscribeMessage('rtcevent')
  sendMessageByUserId(connection: ChatSocket, eventJson: string) {
    let data: any;
    try {
      data = JSON.parse(eventJson);
    } catch (error) {
      console.warn(`Invalid JSON: ${error}`);
      return;
    }

    const callee = this.users.find(user => user.id === data.calleeId);

    switch (data.type) {
      case 'offer':
        connection.calleeId = data.calleeId;
        this.sendTo(callee, 'offer', {
            offer: data.offer,
            callerId: connection.id
        });
        break;
      case 'answer':
        connection.calleeId = data.calleeId;
        this.sendTo(callee, 'answer', {
            answer: data.answer
        });
        break;
      case 'candidate':
        this.sendTo(callee, 'candidate', {
            candidate: data.candidate
        });
        break;
      case "leave":
        delete connection.calleeId;
        this.sendTo(callee, 'leave');
        break;
      }
  }

  async handleConnection(client: ChatSocket) {
    if (client.handshake.query.adminToken === this.adminToken) {
      client.isAdmin = true;
    }

    this.users.push(client);

    this.users.forEach(user => {
      if (client.id === user.id) {
        client.emit('init_users',
          this.users
            .filter(_user => client.isAdmin ? !_user.isAdmin : _user.isAdmin)
            .map(_user => _user.id)
        );
      } else if ((client.isAdmin && !user.isAdmin) || (!client.isAdmin && user.isAdmin)) {
        user.emit('user_connected', client.id);
      }
    });
  }

  async handleDisconnect(client: ChatSocket) {
    if (client.calleeId) {
      const callee = this.users.find(user => user.id === client.calleeId);
      if (callee) {
        delete callee.calleeId;
      }
    }

    this.users.splice(this.users.indexOf(client), 1);

    this.users.forEach(user => {
      if ((client.isAdmin && !user.isAdmin) || (!client.isAdmin && user.isAdmin)) {
        user.emit('user_disconnected', client.id);
      }
    });
  }
}
