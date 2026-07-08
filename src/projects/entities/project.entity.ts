import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { ProjectMember } from '../../project-members/project-member.entity';
import { Task } from '../../tasks/entities/task.entity';

export enum StatusEnum {
  NEW = 'new', // Project mới tạo
  IN_PROGRESS = 'in_progress', // Project đang làm
  PAUSED = 'paused', // Project tạm dừng
  COMPLETED = 'completed', // Project đã hoàn thành
  CANCELED = 'canceled', // Project đã hủy
}

export enum ProjectPriorityEnum {
  HIGHEST = 'highest',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  LOWEST = 'lowest',
}

@Entity()
export class Project {
  @PrimaryGeneratedColumn('uuid')
  project_id!: string;

  @Column()
  project_name!: string;

  @Column()
  project_description!: string;

  @Column()
  owner_id!: string;

  @Column({ type: 'enum', enum: StatusEnum, default: StatusEnum.NEW })
  status!: StatusEnum;

  @Column({
    type: 'enum',
    enum: ProjectPriorityEnum,
    default: ProjectPriorityEnum.MEDIUM,
  })
  priority!: ProjectPriorityEnum;

  @Column({ type: 'float', default: 0 })
  position!: number;

  @Column({ type: 'timestamptz', nullable: true, default: () => 'CURRENT_TIMESTAMP' })
  start_date?: Date | null;

  @Column({ type: 'timestamptz', nullable: true, default: () => 'CURRENT_TIMESTAMP' })
  end_date?: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  archived_at?: Date | null;

  @OneToMany(() => ProjectMember, (pm) => pm.project)
  members!: ProjectMember[];

  @OneToMany(() => Task, (task) => task.project)
  tasks!: Task[];

  @CreateDateColumn({ type: 'timestamptz', select: false })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz', select: false })
  updated_at!: Date;
}
