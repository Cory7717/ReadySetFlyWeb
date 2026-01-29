export const colors = {
  background: '#f5f7fb',
  surface: '#ffffff',
  surfaceMuted: '#f8fafc',
  border: '#e5e7eb',
  text: '#0f172a',
  textMuted: '#64748b',
  primary: '#1e40af',
  primarySoft: '#e0e7ff',
  success: '#10b981',
  danger: '#ef4444',
  warning: '#f59e0b',
};

export const spacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 20,
  xl: 28,
};

export const radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
};

export const shadow = {
  card: {
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
};

export const typography = {
  h1: { fontSize: 26, fontWeight: '700' as const, color: colors.text },
  h2: { fontSize: 20, fontWeight: '700' as const, color: colors.text },
  h3: { fontSize: 16, fontWeight: '600' as const, color: colors.text },
  body: { fontSize: 14, color: colors.text },
  muted: { fontSize: 12, color: colors.textMuted },
};
