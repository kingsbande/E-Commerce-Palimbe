export const colors = {
  primary: "#E62E04",
  primaryDark: "#B92403",
  primarySoft: "#FFF1EE",
  accent: "#FFC20E",
  orange: "#FF6A00",
  success: "#1B7F4B",
  background: "#F5F5F5",
  surface: "#FFF1EE",
  card: "#FFFFFF",
  text: "#1A1A1A",
  muted: "#6B7280",
  border: "#EFE7E5",
  danger: "#B3261E",
  star: "#FFB800",
} as const;

/** Marketplace-style radii: soft, rounded, dense. */
export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

/** Elevation used by cards and sticky bars. */
export const shadow = {
  card: {
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  bar: {
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -2 },
    elevation: 12,
  },
} as const;

/** The warm red→orange wash used on the app header, like a market awning. */
export const brandGradient = ["#E62E04", "#FF6A00"] as const;
