import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { Project } from '../../projects/entities/project.entity';
import { TaskAssignee } from '../../task-assignees/task-assignee.entity';

export enum TaskPriorityEnum {
  HIGHEST = 'highest',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  LOWEST = 'lowest',
}

export enum TaskStatus {
  TODO = 'todo',
  PROGRESS = 'progress',
  REVIEW = 'review',
  DONE = 'done',
}

@Entity()
export class Task {
  @PrimaryGeneratedColumn('uuid')
  task_id!: string;

  @Column()
  project_id!: string;

  @Column({ nullable: true })
  parent_task_id?: string;

  @Column()
  title!: string;

  @Column()
  description!: string;

  @Column({ type: 'enum', enum: TaskStatus, default: TaskStatus.TODO })
  status!: TaskStatus;

  @Column({
    type: 'enum',
    enum: TaskPriorityEnum,
    default: TaskPriorityEnum.MEDIUM,
  })
  priority!: TaskPriorityEnum;

  @Column({ type: 'float', default: 0 })
  progress!: number;

  @Column({ type: 'float', default: 0 })
  position!: number;

  @Column({ type: 'timestamptz', nullable: true })
  start_date!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  due_date!: Date;

  @Column()
  created_by!: string;

  @ManyToOne(() => Project, (project) => project.tasks)
  @JoinColumn({ name: 'project_id' })
  project!: Project;

  @ManyToOne(() => Task, (task) => task.subtasks, { nullable: true })
  @JoinColumn({ name: 'parent_task_id' })
  parentTask?: Task;

  @OneToMany(() => Task, (task) => task.parentTask)
  subtasks!: Task[];

  @OneToMany(() => TaskAssignee, (ta) => ta.task)
  assignees!: TaskAssignee[];

  @CreateDateColumn({ type: 'timestamptz', select: false })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz', select: false })
  updated_at!: Date;
}
