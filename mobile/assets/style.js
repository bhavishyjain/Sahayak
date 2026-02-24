// Shadow utility styles - theme-aware shadows
// Usage: import { getShadows } from '../assets/style';
//        const shadows = getShadows(colorScheme);
//        style={[styles.container, shadows.md]}

export const getShadows = (colorScheme = "dark") => {
  const isDark = colorScheme === "dark";

  return {
    // Small shadow - barely visible
    sm: {
      shadowColor: isDark ? "#ffffff" : "#444444",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0.2 : 0.01,
      shadowRadius: isDark ? 21 : 10,
      elevation: 2,
    },
    // Medium shadow - very subtle
    md: {
      shadowColor: isDark ? "#ffffff" : "#444444",
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: isDark ? 0.23 : 0.015,
      shadowRadius: isDark ? 23 : 12,
      elevation: 3,
    },
    // Large shadow - still subtle
    lg: {
      shadowColor: isDark ? "#ffffff" : "#444444",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0.29 : 0.02,
      shadowRadius: isDark ? 26 : 14,
      elevation: 4,
    },
  };
};

// Legacy export for backward compatibility (defaults to dark theme)
export const shadows = getShadows("dark");

// Colored shadows for special emphasis
export const getColoredShadow = (
  color,
  elevation = "md",
  colorScheme = "dark",
) => {
  const shadows = getShadows(colorScheme);
  const base = shadows[elevation] || shadows.md;
  return {
    ...base,
    shadowColor: color,
  };
};

// Legacy export for backward compatibility
export const coloredShadow = (color, elevation = "md") => {
  return getColoredShadow(color, elevation, "dark");
};
