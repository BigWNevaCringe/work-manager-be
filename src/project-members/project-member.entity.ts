
import { Entity, Column, ManyToOne, JoinColumn, CreateDateColumn, PrimaryColumn } from "typeorm";
import { Project } from "../projects/entities/project.entity";
import { User } from "../users/entities/user.entity";

export enum MemberRoleEnum {
  OWNER = 'owner',
  MEMBER = 'member'
}

@Entity('project_members')
export class ProjectMember {
  @PrimaryColumn()
  project_id!: string;

  @PrimaryColumn()
  user_id!: string;

  @ManyToOne(() => Project, (project) => project.members)
  @JoinColumn({ name: 'project_id' })
  project!: Project;

  @ManyToOne(() => User, (user) => user.projectMembers)
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'enum', enum: MemberRoleEnum, default: MemberRoleEnum.MEMBER })
  role!: MemberRoleEnum;

  @CreateDateColumn({ type: 'timestamptz' })
  joined_at!: Date;
}