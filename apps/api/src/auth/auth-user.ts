import { Profile, User } from '@prisma/client';

export type AuthUser = User & {
  profile: Profile | null;
};
