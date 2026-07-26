import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ChallengeKind, EventRsvpStatus } from '@prisma/client';
import { CurrentUser, FirebaseAuthGuard } from '../auth/auth.decorators';
import type { AuthUser } from '../auth/auth-user';
import { TENANT_HEADER } from '../tenants/tenant-context';
import { CommunityService } from './community.service';

type CreateChallengeBody = {
  title: string;
  description?: string;
  kind?: ChallengeKind;
  targetValue?: number;
  startAt: string;
  endAt: string;
};

@ApiTags('community')
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard)
@Controller('community')
export class CommunityController {
  constructor(private readonly community: CommunityService) {}

  @Get('challenges')
  listChallenges(
    @CurrentUser() user: AuthUser,
    @Headers(TENANT_HEADER) tenant?: string,
  ) {
    return this.community.listChallenges(user, tenant);
  }

  @Post('challenges')
  createChallenge(
    @CurrentUser() user: AuthUser,
    @Headers(TENANT_HEADER) tenant: string | undefined,
    @Body() body: CreateChallengeBody,
  ) {
    return this.community.createChallenge(user, body, tenant);
  }

  @Patch('challenges/:id/close')
  closeChallenge(
    @CurrentUser() user: AuthUser,
    @Headers(TENANT_HEADER) tenant: string | undefined,
    @Param('id') id: string,
  ) {
    return this.community.closeChallenge(user, id, tenant);
  }

  @Post('challenges/:id/join')
  join(
    @CurrentUser() user: AuthUser,
    @Headers(TENANT_HEADER) tenant: string | undefined,
    @Param('id') id: string,
  ) {
    return this.community.join(user, id, tenant);
  }

  @Post('challenges/:id/progress')
  logProgress(
    @CurrentUser() user: AuthUser,
    @Headers(TENANT_HEADER) tenant: string | undefined,
    @Param('id') id: string,
    @Body() body: { delta: number },
  ) {
    return this.community.logProgress(user, id, body.delta, tenant);
  }

  @Get('challenges/:id/leaderboard')
  leaderboard(
    @CurrentUser() user: AuthUser,
    @Headers(TENANT_HEADER) tenant: string | undefined,
    @Param('id') id: string,
  ) {
    return this.community.leaderboard(user, id, tenant);
  }

  @Get('achievements')
  achievements(
    @CurrentUser() user: AuthUser,
    @Headers(TENANT_HEADER) tenant?: string,
  ) {
    return this.community.achievements(user, tenant);
  }

  @Get('streak')
  streak(
    @CurrentUser() user: AuthUser,
    @Headers(TENANT_HEADER) tenant?: string,
  ) {
    return this.community.streak(user, tenant);
  }

  @Get('members')
  listTenantMembers(
    @CurrentUser() user: AuthUser,
    @Headers(TENANT_HEADER) tenant?: string,
  ) {
    return this.community.listTenantMembers(user, tenant);
  }

  @Get('friends')
  listFriends(
    @CurrentUser() user: AuthUser,
    @Headers(TENANT_HEADER) tenant?: string,
  ) {
    return this.community.listFriends(user, tenant);
  }

  @Post('friends/requests')
  sendFriendRequest(
    @CurrentUser() user: AuthUser,
    @Headers(TENANT_HEADER) tenant: string | undefined,
    @Body() body: { toUserId: string },
  ) {
    return this.community.sendFriendRequest(user, body.toUserId, tenant);
  }

  @Post('friends/requests/:id/accept')
  acceptFriendRequest(
    @CurrentUser() user: AuthUser,
    @Headers(TENANT_HEADER) tenant: string | undefined,
    @Param('id') id: string,
  ) {
    return this.community.respondToFriendRequest(user, id, true, tenant);
  }

  @Post('friends/requests/:id/decline')
  declineFriendRequest(
    @CurrentUser() user: AuthUser,
    @Headers(TENANT_HEADER) tenant: string | undefined,
    @Param('id') id: string,
  ) {
    return this.community.respondToFriendRequest(user, id, false, tenant);
  }

  @Delete('friends/:userId')
  removeFriend(
    @CurrentUser() user: AuthUser,
    @Headers(TENANT_HEADER) tenant: string | undefined,
    @Param('userId') userId: string,
  ) {
    return this.community.removeFriend(user, userId, tenant);
  }

  @Get('events')
  listEvents(
    @CurrentUser() user: AuthUser,
    @Headers(TENANT_HEADER) tenant?: string,
  ) {
    return this.community.listEvents(user, tenant);
  }

  @Post('events')
  createEvent(
    @CurrentUser() user: AuthUser,
    @Headers(TENANT_HEADER) tenant: string | undefined,
    @Body()
    body: {
      title: string;
      description?: string;
      location?: string;
      startAt: string;
      endAt?: string;
    },
  ) {
    return this.community.createEvent(user, body, tenant);
  }

  @Patch('events/:id/cancel')
  cancelEvent(
    @CurrentUser() user: AuthUser,
    @Headers(TENANT_HEADER) tenant: string | undefined,
    @Param('id') id: string,
  ) {
    return this.community.cancelEvent(user, id, tenant);
  }

  @Post('events/:id/rsvp')
  rsvp(
    @CurrentUser() user: AuthUser,
    @Headers(TENANT_HEADER) tenant: string | undefined,
    @Param('id') id: string,
    @Body() body: { status: EventRsvpStatus },
  ) {
    return this.community.rsvp(user, id, body.status, tenant);
  }

  @Get('events/:id/attendees')
  listAttendees(
    @CurrentUser() user: AuthUser,
    @Headers(TENANT_HEADER) tenant: string | undefined,
    @Param('id') id: string,
  ) {
    return this.community.listAttendees(user, id, tenant);
  }

  @Get('stories')
  listStories(
    @CurrentUser() user: AuthUser,
    @Headers(TENANT_HEADER) tenant?: string,
  ) {
    return this.community.listStories(user, tenant);
  }

  @Post('stories')
  createStory(
    @CurrentUser() user: AuthUser,
    @Headers(TENANT_HEADER) tenant: string | undefined,
    @Body()
    body: { caption?: string; beforePhotoId?: string; afterPhotoId?: string },
  ) {
    return this.community.createStory(user, body, tenant);
  }

  @Delete('stories/:id')
  removeStory(
    @CurrentUser() user: AuthUser,
    @Headers(TENANT_HEADER) tenant: string | undefined,
    @Param('id') id: string,
  ) {
    return this.community.removeStory(user, id, tenant);
  }

  @Post('stories/:id/cheer')
  cheerStory(
    @CurrentUser() user: AuthUser,
    @Headers(TENANT_HEADER) tenant: string | undefined,
    @Param('id') id: string,
  ) {
    return this.community.cheerStory(user, id, tenant);
  }
}
