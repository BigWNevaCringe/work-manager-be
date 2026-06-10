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


@Entity()
export class User {
  @PrimaryGeneratedColumn('uuid')
  user_id!: string;

  @Column({ unique: true })
  email!: string;

  @Column()
  name!: string;

  @Column({ nullable: true })
  avatar_url?: string;

  @Column({ select: false })
  password!: string;

  @OneToMany(() => ProjectMember, (pm) => pm.user)
  projectMembers!: ProjectMember[];

  @OneToMany(() => TaskAssignee, (ta) => ta.user)
  taskAssignees!: TaskAssignee[];

  @CreateDateColumn({ type: 'timestamptz', select: false })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz', select: false })
  updated_at!: Date;
}
