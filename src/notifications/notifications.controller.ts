import { Controller, Get, Param, ParseUUIDPipe, Patch, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../common/guards/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';

@UseGuards(AuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  findMine(@CurrentUser('sub') userId: string) {
    return this.notificationsService.findMine(userId);
  }

  @Patch('project/:id/seen')
  markProjectSeen(
    @Param('id', ParseUUIDPipe) projectId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.notificationsService.markProjectSeen(projectId, userId);
  }
}
