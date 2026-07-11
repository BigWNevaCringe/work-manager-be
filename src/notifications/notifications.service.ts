import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import {
  Notification,
  NotificationType,
} from './entities/notification.entity';

type CreateNotificationInput = {
  userId: string;
  projectId: string;
  taskId?: string | null;
  type: NotificationType;
  title: string;
  message: string;
  metadata?: Record<string, unknown> | null;
};

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
  ) {}

  findMine(userId: string, limit = 100) {
    return this.notificationRepository.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
      take: Math.min(Math.max(limit, 1), 100),
    });
  }

  async markProjectSeen(projectId: string, userId: string) {
    await this.notificationRepository.update(
      { project_id: projectId, user_id: userId, seen_at: IsNull() },
      { seen_at: new Date() },
    );

    return { message: 'Đã đánh dấu thông báo là đã đọc', project_id: projectId };
  }

  async markSeen(userId: string, notificationIds?: string[]) {
    const uniqueIds = [...new Set(notificationIds?.filter(Boolean) ?? [])];
    const where =
      uniqueIds.length > 0
        ? { notification_id: In(uniqueIds), user_id: userId, seen_at: IsNull() }
        : { user_id: userId, seen_at: IsNull() };

    await this.notificationRepository.update(where, { seen_at: new Date() });

    return {
      message: 'Đã đánh dấu thông báo là đã đọc',
      notification_ids: uniqueIds,
    };
  }

  async markOneSeen(notificationId: string, userId: string) {
    await this.notificationRepository.update(
      { notification_id: notificationId, user_id: userId, seen_at: IsNull() },
      { seen_at: new Date() },
    );

    return {
      message: 'Đã đánh dấu thông báo là đã đọc',
      notification_id: notificationId,
    };
  }

  async createMany(inputs: CreateNotificationInput[]) {
    if (inputs.length === 0) return [];

    const notifications = this.notificationRepository.create(
      inputs.map((input) => ({
        user_id: input.userId,
        project_id: input.projectId,
        task_id: input.taskId ?? null,
        type: input.type,
        title: input.title,
        message: input.message,
        metadata: input.metadata ?? null,
      })),
    );

    return this.notificationRepository.save(notifications);
  }
}
