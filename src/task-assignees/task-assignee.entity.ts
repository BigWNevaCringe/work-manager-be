import { Entity, PrimaryColumn, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Task } from '../tasks/entities/task.entity';
import { User } from '../users/entities/user.entity';

@Entity('task_assignees')
export class TaskAssignee {
  @PrimaryColumn()
  task_id!: string;

  @PrimaryColumn()
  user_id!: string;

  @ManyToOne(() => Task, (task) => task.assignees)
  @JoinColumn({ name: 'task_id' })
  task!: Task;

  @ManyToOne(() => User, (user) => user.taskAssignees)
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @CreateDateColumn({ type: 'timestamptz' })
  assigned_at!: Date;
}