import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { ProjectMember } from '../../project-members/project-member.entity';
import { TaskAssignee } from '../../task-assignees/task-assignee.entity';

export enum UserRoleEnum {
  ADMIN = 'admin',
  USER = 'user',
}

@Entity()
export class User {
  @PrimaryGeneratedColumn('uuid')
  user_id!: string;

  @Column({ unique: true })
  email!: string;

  @Column()
  name!: string;

  @Column({ type: 'varchar', nullable: true })
  avatar_url?: string;

  @Column({ type: 'enum', enum: UserRoleEnum, default: UserRoleEnum.USER })
  role!: UserRoleEnum;

  @Column({ type: 'varchar', nullable: true, select: false })
  password?: string | null;

  @OneToMany(() => ProjectMember, (pm) => pm.user)
  projectMembers!: ProjectMember[];

  @OneToMany(() => TaskAssignee, (ta) => ta.user)
  taskAssignees!: TaskAssignee[];

  @CreateDateColumn({ type: 'timestamptz', select: false })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz', select: false })
  updated_at!: Date;
}
