/** Shared brand tokens — keep Flutter AppColors + coach-web CSS in sync. */
export const colors = {
  forest: '#0B3D2E',
  forestMid: '#145C43',
  lime: '#B8F205',
  sand: '#E8EDE6',
  ink: '#102018',
  mist: '#F3F7F2',
  danger: '#C62828',
  muted: '#5C7268',
} as const;

export const typography = {
  displayFamily: 'Bebas Neue',
  bodyFamily: 'DM Sans',
  radiusMd: 14,
  radiusLg: 18,
} as const;

export const tokens = { colors, typography } as const;
export type BrandColors = typeof colors;
