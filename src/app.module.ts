import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UsersModule } from './users/users.module';
import { ProjectsModule } from './projects/projects.module';
import { TasksModule } from './tasks/tasks.module';
import { AuthModule } from './auth/auth.module';
import { validateEnvironment } from './config/env.validation';
import { RealtimeModule } from './realtime/realtime.module';
import { NotificationsModule } from './notifications/notifications.module';
import { User } from './users/entities/user.entity';
import { Project } from './projects/entities/project.entity';
import { ProjectMember } from './project-members/project-member.entity';
import { Task } from './tasks/entities/task.entity';
import { TaskChecklistItem } from './tasks/entities/task-checklist-item.entity';
import { TaskAssignee } from './task-assignees/task-assignee.entity';
import { Notification } from './notifications/entities/notification.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnvironment,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.getOrThrow<string>('DB_HOST'),
        port: configService.getOrThrow<number>('DB_PORT'),
        username: configService.getOrThrow<string>('DB_USERNAME'),
        password: configService.getOrThrow<string>('DB_PASSWORD'),
        database: configService.getOrThrow<string>('DB_NAME'),
        entities: [
          User,
          Project,
          ProjectMember,
          Task,
          TaskChecklistItem,
          TaskAssignee,
          Notification,
        ],
        migrations: [__dirname + '/database/migrations/*{.ts,.js}'],
        synchronize: configService.getOrThrow<boolean>('DB_SYNC'),
      }),
      inject: [ConfigService],
    }),
    UsersModule,
    ProjectsModule,
    TasksModule,
    AuthModule,
    RealtimeModule,
    NotificationsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
