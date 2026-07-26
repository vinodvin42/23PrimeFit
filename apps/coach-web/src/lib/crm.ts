export type Lead = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  stage: string;
  packageName?: string | null;
  notes?: string | null;
  updatedAt?: string;
};

export type Invoice = {
  id: string;
  packageName: string;
  amountInr: number;
  status: string;
  createdAt: string;
  paidAt?: string | null;
};

export type Contract = {
  id: string;
  title: string;
  kind: string;
  createdAt: string;
  acceptedAt?: string | null;
};

export type LeadDetail = Lead & {
  invoices: Invoice[];
  contracts: Contract[];
};

export type Coupon = {
  id: string;
  code: string;
  discountType: 'PERCENT' | 'FIXED';
  discountValue: number;
  maxRedemptions?: number | null;
  redemptionCount: number;
  expiresAt?: string | null;
  active: boolean;
};

export type MembershipPlan = {
  id: string;
  name: string;
  description?: string | null;
  priceInr: number;
  durationDays?: number | null;
  sessionCount?: number | null;
  active: boolean;
};

export const CRM_STAGES = [
  'lead',
  'qualified',
  'proposal',
  'active',
  'paused',
] as const;

export function stageLabel(stage: string) {
  return stage.charAt(0).toUpperCase() + stage.slice(1);
}

export function leadInitials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function formatInr(amount: number) {
  return `₹${amount.toLocaleString('en-IN')}`;
}
