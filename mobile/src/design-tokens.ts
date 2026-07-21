export const colors = {
  brand: {
    primary: { light: '#7b9fff', dark: '#7b9fff' },
    primaryForeground: { light: '#0f1522', dark: '#0f1522' },
    rain: { light: '#74cfe0', dark: '#74cfe0' },
    rainForeground: { light: '#0f1522', dark: '#0f1522' },
    warning: { light: '#e0b15c', dark: '#e0b15c' },
    warningForeground: { light: '#1a1a1a', dark: '#1a1a1a' },
    success: { light: '#68c49b', dark: '#68c49b' },
    successForeground: { light: '#0f1522', dark: '#0f1522' },
    destructive: { light: '#ff7d75', dark: '#ff7d75' },
    destructiveForeground: { light: '#0f1522', dark: '#0f1522' },
  },

  light: {
    background: '#131824',
    foreground: '#eef2ff',
    card: '#1b2332',
    cardForeground: '#eef2ff',
    surface: '#182132',
    surfaceStrong: '#1f2a3f',
    surfaceMuted: '#121927',
    border: '#2f3b53',
    borderStrong: '#3d4d6b',
    muted: '#212c42',
    mutedForeground: '#9aa7bf',
    overlay: 'rgba(6, 10, 20, 0.6)',
    overlayStrong: 'rgba(6, 10, 20, 0.8)',
  },

  dark: {
    background: '#0b0f1a',
    foreground: '#f0f4ff',
    card: '#141c2e',
    cardForeground: '#f0f4ff',
    surface: '#10182a',
    surfaceStrong: '#182238',
    surfaceMuted: '#0a0f1a',
    border: '#28344a',
    borderStrong: '#344460',
    muted: '#1a2438',
    mutedForeground: '#8a98b8',
    overlay: 'rgba(0, 0, 0, 0.7)',
    overlayStrong: 'rgba(0, 0, 0, 0.9)',
  },

  semantic: {
    error: { light: '#ff7d75', dark: '#ff7d75' },
    errorForeground: { light: '#0f1522', dark: '#0f1522' },
    warning: { light: '#e0b15c', dark: '#e0b15c' },
    warningForeground: { light: '#1a1a1a', dark: '#1a1a1a' },
    success: { light: '#68c49b', dark: '#68c49b' },
    successForeground: { light: '#0f1522', dark: '#0f1522' },
    info: { light: '#74cfe0', dark: '#74cfe0' },
    infoForeground: { light: '#0f1522', dark: '#0f1522' },
  },

  state: {
    pressed: { light: 'rgba(255,255,255,0.08)', dark: 'rgba(255,255,255,0.06)' },
    hovered: { light: 'rgba(255,255,255,0.04)', dark: 'rgba(255,255,255,0.03)' },
    focused: { light: '#7b9fff', dark: '#7b9fff' },
    disabled: { light: 'rgba(255,255,255,0.06)', dark: 'rgba(255,255,255,0.04)' },
    disabledForeground: { light: 'rgba(238,242,255,0.3)', dark: 'rgba(240,244,255,0.3)' },
  },
} as const;

export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  9: 36,
  10: 40,
  11: 44,
  12: 48,
  14: 56,
  16: 64,
  20: 80,
  24: 96,
  28: 112,
  32: 128,
} as const;

export const radius = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 28,
  full: 9999,
  badge: 9999,
  card: 24,
  surface: 24,
  button: 18,
  input: 16,
  chip: 9999,
  avatar: 9999,
  fab: 28,
} as const;

export const typography = {
  fontFamily: {
    sans: 'System',
    mono: 'Menlo',
    heading: 'System',
  },
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    extrabold: '800',
  },
  lineHeight: {
    tight: 1.1,
    snug: 1.25,
    normal: 1.5,
    relaxed: 1.625,
  },
  letterSpacing: {
    tighter: -0.05,
    tight: -0.025,
    normal: 0,
    wide: 0.025,
    wider: 0.05,
    widest: 0.1,
  },
  scale: {
    display: { size: 40, lineHeight: 44, weight: '800', letterSpacing: -1.2 },
    h1: { size: 32, lineHeight: 36, weight: '800', letterSpacing: -1 },
    h2: { size: 28, lineHeight: 32, weight: '800', letterSpacing: -0.8 },
    h3: { size: 22, lineHeight: 26, weight: '700', letterSpacing: -0.6 },
    h4: { size: 20, lineHeight: 24, weight: '700', letterSpacing: -0.4 },
    title: { size: 18, lineHeight: 24, weight: '700', letterSpacing: -0.3 },
    subtitle: { size: 16, lineHeight: 22, weight: '600', letterSpacing: -0.2 },
    body: { size: 15, lineHeight: 22, weight: '400', letterSpacing: 0 },
    bodyStrong: { size: 15, lineHeight: 22, weight: '600', letterSpacing: 0 },
    label: { size: 13, lineHeight: 18, weight: '500', letterSpacing: 0 },
    labelStrong: { size: 13, lineHeight: 18, weight: '700', letterSpacing: 0.8 },
    caption: { size: 12, lineHeight: 16, weight: '400', letterSpacing: 0 },
    captionStrong: { size: 12, lineHeight: 16, weight: '600', letterSpacing: 0.3 },
    eyebrow: { size: 11, lineHeight: 14, weight: '700', letterSpacing: 1.6, textTransform: 'uppercase' },
    metric: { size: 30, lineHeight: 32, weight: '800', letterSpacing: -0.9 },
    metricLarge: { size: 42, lineHeight: 44, weight: '800', letterSpacing: -1.2 },
  },
} as const;

export const shadows = {
  none: { shadowOpacity: 0, elevation: 0 },
  xs: { shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2, elevation: 1 },
  sm: { shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 4, elevation: 2 },
  md: { shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 16, elevation: 4 },
  lg: { shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.18, shadowRadius: 30, elevation: 8 },
  xl: { shadowOffset: { width: 0, height: 24 }, shadowOpacity: 0.22, shadowRadius: 40, elevation: 12 },
  inner: { shadowOffset: { width: 0, height: -1 }, shadowOpacity: 0.06, shadowRadius: 2, elevation: 0 },
  card: { shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.18, shadowRadius: 30, elevation: 8 },
  surface: { shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.15, shadowRadius: 24, elevation: 6 },
  modal: { shadowOffset: { width: 0, height: 32 }, shadowOpacity: 0.25, shadowRadius: 60, elevation: 16 },
} as const;

export const motion = {
  duration: {
    instant: 0,
    fast: 120,
    normal: 200,
    slow: 300,
    slower: 450,
  },
  easing: {
    linear: 'linear',
    standard: 'cubic-bezier(0.4, 0, 0.2, 1)',
    accelerate: 'cubic-bezier(0.4, 0, 1, 1)',
    decelerate: 'cubic-bezier(0, 0, 0.2, 1)',
    spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
  },
  spring: {
    gentle: { damping: 20, stiffness: 120 },
    standard: { damping: 15, stiffness: 150 },
    stiff: { damping: 10, stiffness: 200 },
    bouncy: { damping: 8, stiffness: 180 },
  },
  skeleton: {
    pulseDuration: 1000,
    pulseEasing: 'ease-in-out',
  },
  toast: {
    slideDuration: 300,
    slideEasing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    fadeDuration: 200,
  },
  screen: {
    transitionDuration: 250,
    transitionEasing: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },
} as const;

export const breakpoints = {
  xs: 0,
  sm: 320,
  md: 375,
  lg: 428,
  xl: 768,
  '2xl': 1024,
} as const;

export const zIndex = {
  base: 0,
  dropdown: 100,
  sticky: 200,
  fixed: 300,
  modalBackdrop: 400,
  modal: 500,
  popover: 600,
  tooltip: 700,
  toast: 800,
  loading: 900,
} as const;

export const touchTargets = {
  minimum: 44,
  comfortable: 48,
  spacious: 56,
  fab: 56,
  iconButton: 44,
  listItem: 72,
  card: 88,
} as const;

export const opacity = {
  disabled: 0.38,
  pressed: 0.12,
  hovered: 0.08,
  overlay: 0.5,
  overlayStrong: 0.7,
} as const;

export type ColorScheme = 'light' | 'dark';
export type SpacingKey = keyof typeof spacing;
export type RadiusKey = keyof typeof radius;
export type TypographyScaleKey = keyof typeof typography.scale;
export type ShadowKey = keyof typeof shadows;
export type MotionDurationKey = keyof typeof motion.duration;
export type ZIndexKey = keyof typeof zIndex;