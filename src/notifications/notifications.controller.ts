import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../common/guards/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';

type MarkNotificationsSeenBody = {
  notification_ids?: string[];
};

@UseGuards(AuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  findMine(
    @CurrentUser('sub') userId: string,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.notificationsService.findMine(userId, limit);
  }

  @Patch('project/:id/seen')
  markProjectSeen(
    @Param('id', ParseUUIDPipe) projectId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.notificationsService.markProjectSeen(projectId, userId);
  }

  @Patch('seen')
  markSeen(
    @CurrentUser('sub') userId: string,
    @Body() body: MarkNotificationsSeenBody = {},
  ) {
    return this.notificationsService.markSeen(userId, body.notification_ids);
  }

  @Patch(':id/seen')
  markOneSeen(
    @Param('id', ParseUUIDPipe) notificationId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.notificationsService.markOneSeen(notificationId, userId);
  }
}
