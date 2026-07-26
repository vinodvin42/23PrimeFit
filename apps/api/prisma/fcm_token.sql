-- Wave B: FCM device token on profile
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "fcmToken" TEXT;
