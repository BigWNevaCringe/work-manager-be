import { DataSource } from 'typeorm';
import { validateEnvironment } from '../config/env.validation';
import { User } from '../users/entities/user.entity';
import { Project } from '../projects/entities/project.entity';
import { ProjectMember } from '../project-members/project-member.entity';
import { Task } from '../tasks/entities/task.entity';
import { TaskChecklistItem } from '../tasks/entities/task-checklist-item.entity';
import { TaskAssignee } from '../task-assignees/task-assignee.entity';
import { Notification } from '../notifications/entities/notification.entity';

const config = validateEnvironment(process.env);

export default new DataSource({
  type: 'postgres',
  host: config.DB_HOST as string,
  port: config.DB_PORT as number,
  username: config.DB_USERNAME as string,
  password: config.DB_PASSWORD as string,
  database: config.DB_NAME as string,
  entities: [
    User,
    Project,
    ProjectMember,
    Task,
    TaskChecklistItem,
    TaskAssignee,
    Notification,
  ],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: true,
});
