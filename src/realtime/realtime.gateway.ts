import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { InjectRepository } from '@nestjs/typeorm';
import { Server, Socket } from 'socket.io';
import { Repository } from 'typeorm';
import { ProjectMember } from '../project-members/project-member.entity';
import { User, UserRoleEnum } from '../users/entities/user.entity';
import { JwtPayload } from '../common/types/types';

type ProjectEventName =
  | 'comment.created'
  | 'comment.updated'
  | 'comment.deleted'
  | 'task.assigned'
  | 'task.unassigned'
  | 'task.updated'
  | 'task.rejected';

@WebSocketGateway({
  namespace: 'work-manager',
  cors: {
    origin: true,
    credentials: true,
  },
})
export class RealtimeGateway implements OnGatewayConnection {
  @WebSocketServer()
  private readonly server!: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectRepository(ProjectMember)
    private readonly projectMemberRepository: Repository<ProjectMember>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async handleConnection(client: Socket) {
    try {
      client.data.user = await this.getUserFromClient(client);
    } catch {
      client.disconnect(true);
    }
  }

  @SubscribeMessage('project.join')
  async joinProject(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { projectId?: string },
  ) {
    const projectId = payload?.projectId;
    const userId = client.data.user?.sub;
    if (!projectId || !userId) return { ok: false };

    const canAccess = await this.canAccessProject(projectId, userId);
    if (!canAccess) return { ok: false };

    await client.join(this.getProjectRoom(projectId));
    return { ok: true, projectId };
  }

  @SubscribeMessage('project.leave')
  async leaveProject(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { projectId?: string },
  ) {
    if (payload?.projectId) {
      await client.leave(this.getProjectRoom(payload.projectId));
    }
    return { ok: true };
  }

  emitProjectEvent(
    projectId: string,
    event: ProjectEventName,
    payload: Record<string, unknown>,
  ) {
    this.server.to(this.getProjectRoom(projectId)).emit(event, {
      ...payload,
      project_id: projectId,
    });
  }

  private getProjectRoom(projectId: string) {
    return `project:${projectId}`;
  }

  private async canAccessProject(projectId: string, userId: string) {
    const user = await this.userRepository.findOne({ where: { user_id: userId } });
    if (user?.role === UserRoleEnum.ADMIN) return true;

    return Boolean(
      await this.projectMemberRepository.findOne({
        where: { project_id: projectId, user_id: userId },
      }),
    );
  }

  private async getUserFromClient(client: Socket) {
    const token =
      this.extractTokenFromCookie(client.handshake.headers.cookie) ??
      this.extractTokenFromAuth(client);
    if (!token) throw new Error('Missing socket token');

    try {
      return (await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      })) as JwtPayload;
    } catch (error) {
      this.logger.debug(`Socket auth failed: ${(error as Error).message}`);
      throw error;
    }
  }

  private extractTokenFromAuth(client: Socket) {
    const token = client.handshake.auth?.token;
    return typeof token === 'string' && token ? token : undefined;
  }

  private extractTokenFromCookie(cookieHeader?: string) {
    if (!cookieHeader) return undefined;

    const cookies = cookieHeader.split(';').map((cookie) => cookie.trim());
    const tokenCookie = cookies.find((cookie) =>
      cookie.startsWith('wm_access_token='),
    );
    if (!tokenCookie) return undefined;

    const token = tokenCookie.slice('wm_access_token='.length);
    return token ? decodeURIComponent(token) : undefined;
  }
}
