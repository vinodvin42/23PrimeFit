/** Shared DTO shapes mirrored by OpenAPI / Flutter models (Phase 1). */

export type Role = 'CLIENT' | 'COACH' | 'ADMIN';

export type FitnessGoal =
  | 'WEIGHT_LOSS'
  | 'MUSCLE_GAIN'
  | 'GENERAL_FITNESS'
  | 'ATHLETIC_PERFORMANCE'
  | 'CRICKET_PERFORMANCE'
  | 'METABOLIC_HEALTH'
  | 'STRENGTH'
  | 'ENDURANCE';

export interface ProfileDto {
  id: string;
  dateOfBirth?: string | null;
  sex?: string | null;
  heightCm?: number | null;
  weightKg?: number | null;
  goals: FitnessGoal[];
  lifestyleDisorders: string[];
  activityLevel?: string | null;
  onboardingComplete: boolean;
}

export interface UserDto {
  id: string;
  firebaseUid: string;
  email?: string | null;
  displayName?: string | null;
  role: Role;
  profile?: ProfileDto | null;
}

export interface DashboardCardDto {
  id: string;
  title: string;
  subtitle: string;
  status: string;
  phase: number;
}

export interface DashboardTodayDto {
  greeting: string;
  date: string;
  profileComplete: boolean;
  cards: DashboardCardDto[];
  goals: FitnessGoal[];
  weightKg?: number | null;
}
