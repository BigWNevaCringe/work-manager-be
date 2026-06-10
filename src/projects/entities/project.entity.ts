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
  ACTIVE = 'active',
  ARCHIVED = 'archived',
  COMPLETED = 'completed',
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

  @Column({ type: 'enum', enum: StatusEnum, default: StatusEnum.ACTIVE })
  status!: StatusEnum;

  @Column({ type: 'timestamptz', nullable: true })
  archived_at?: Date;

  @OneToMany(() => ProjectMember, (pm) => pm.project)
  members!: ProjectMember[];

  @OneToMany(() => Task, (task) => task.project)
  tasks!: Task[];

  @CreateDateColumn({ type: 'timestamptz', select: false })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz', select: false })
  updated_at!: Date;
}
