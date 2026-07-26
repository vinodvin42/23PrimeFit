import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, FirebaseAuthGuard } from '../auth/auth.decorators';
import type { AuthUser } from '../auth/auth-user';
import { ChatService } from './chat.service';
import { StreamAdapter } from '../integrations/stream.adapter';

@ApiTags('chat')
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(
    private readonly chat: ChatService,
    private readonly stream: StreamAdapter,
  ) {}

  @Get('threads')
  threads(@CurrentUser() user: AuthUser) {
    return this.chat.listThreads(user);
  }

  @Post('threads')
  ensure(@CurrentUser() user: AuthUser, @Body() body: { clientId?: string }) {
    return this.chat.ensureThread(user, body.clientId);
  }

  @Get('threads/:id/messages')
  messages(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.chat.getMessages(user, id);
  }

  @Post('threads/:id/messages')
  send(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { body: string },
  ) {
    return this.chat.sendMessage(user, id, body.body);
  }

  @Get('stream-token')
  streamToken(@CurrentUser() user: AuthUser) {
    return this.stream.userToken(user.id, user.displayName);
  }
}
