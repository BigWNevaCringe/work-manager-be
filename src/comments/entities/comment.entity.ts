import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('comments')
export class Comment {
  @PrimaryGeneratedColumn('uuid')
  comment_id!: string;

  @Column()
  project_id!: string;

  @Column({ type: 'uuid', nullable: true })
  task_id?: string | null;

  @Column()
  user_id!: string;

  @Column({ type: 'text' })
  content!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  edited_at?: Date | null;
}
