import { Module } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Project } from './entities/project.entity';
import { ProjectMember } from '../project-members/project-member.entity';
import { User } from '../users/entities/user.entity';
import { Task } from '../tasks/entities/task.entity';
import { TaskAssignee } from '../task-assignees/task-assignee.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Project,
      ProjectMember,
      User,
      Task,
      TaskAssignee,
    ]),
  ],
  controllers: [ProjectsController],
  providers: [ProjectsService],
})
export class ProjectsModule {}
