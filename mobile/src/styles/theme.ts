export const colors = {
  background: '#eef4fb',
  backgroundElevated: '#f7fbff',
  surface: '#ffffff',
  surfaceMuted: '#f3f7fc',
  surfaceTinted: '#e8f1ff',
  border: '#d8e2f0',
  borderStrong: '#b8c6d9',
  text: '#102033',
  textMuted: '#5e728c',
  textSoft: '#7d8fa7',
  primary: '#0f4c81',
  primaryStrong: '#0a3d69',
  primarySoft: '#dbeafe',
  accent: '#16a34a',
  accentSoft: '#dcfce7',
  info: '#0284c7',
  success: '#10b981',
  danger: '#ef4444',
  warning: '#f59e0b',
  cockpit: '#142235',
  cockpitMuted: '#20344e',
  radar: '#0ea5e9',
  terrainSafe: '#22c55e',
  terrainCaution: '#f59e0b',
  terrainDanger: '#ef4444',
  flightBackground: '#0A0E14',
  flightSurface: '#111820',
  flightSurfaceElevated: '#1A2332',
  flightBorder: '#1E2D42',
  flightText: '#E8EDF4',
  flightTextMuted: '#7A9BB8',
  flightTextSoft: '#3D5A78',
  flightNominal: '#00D4A0',
  flightAdvisory: '#4A9FD4',
  flightCaution: '#F5A623',
  flightWarning: '#E8453C',
  flightAccent: '#C8922A',
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
    shadowColor: '#102033',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 3,
  },
  floating: {
    shadowColor: '#102033',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 20,
    elevation: 6,
  },
  flightGlass: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.24,
    shadowRadius: 18,
    elevation: 8,
  },
};

export const typography = {
  display: { fontSize: 30, fontWeight: '800' as const, color: colors.text, letterSpacing: -0.6 },
  h1: { fontSize: 26, fontWeight: '800' as const, color: colors.text, letterSpacing: -0.4 },
  h2: { fontSize: 20, fontWeight: '700' as const, color: colors.text, letterSpacing: -0.2 },
  h3: { fontSize: 16, fontWeight: '700' as const, color: colors.text },
  metric: { fontSize: 24, fontWeight: '800' as const, color: colors.text, letterSpacing: -0.4 },
  body: { fontSize: 14, color: colors.text, lineHeight: 20 },
  muted: { fontSize: 12, color: colors.textMuted, lineHeight: 18 },
};
