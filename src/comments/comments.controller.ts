import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../common/guards/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';

@UseGuards(AuthGuard)
@Controller('comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Get('project/:id')
  findByProject(
    @Param('id', ParseUUIDPipe) projectId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.commentsService.findByProject(projectId, userId);
  }

  @Post('project/:id')
  create(
    @Param('id', ParseUUIDPipe) projectId: string,
    @Body() dto: CreateCommentDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.commentsService.create(projectId, dto, userId);
  }

  @Delete(':id')
  remove(
    @Param('id', ParseUUIDPipe) commentId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.commentsService.remove(commentId, userId);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) commentId: string,
    @Body() dto: UpdateCommentDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.commentsService.update(commentId, dto, userId);
  }
}
