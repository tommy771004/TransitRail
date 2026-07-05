/**
 * Utility for triggering haptic feedback using the Web Vibration API.
 * Safely checks for support to prevent errors on unsupported browsers/devices (e.g. iOS Safari).
 */

export const HapticType = {
  LIGHT: "light",
  MEDIUM: "medium",
  HEAVY: "heavy",
  SUCCESS: "success",
  WARNING: "warning",
  ERROR: "error",
} as const;

export type HapticFeedbackType = typeof HapticType[keyof typeof HapticType];

const PATTERNS: Record<HapticFeedbackType, number | number[]> = {
  light: 12,
  medium: 25,
  heavy: 45,
  success: [15, 30, 15],
  warning: [30, 50, 30],
  error: [60, 60, 60, 60],
};

/**
 * Triggers a vibration pattern on supported devices.
 * 
 * @param type The type of haptic response to simulate
 */
export function triggerHaptic(type: HapticFeedbackType = "light"): void {
  if (
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    typeof navigator.vibrate === "function"
  ) {
    try {
      navigator.vibrate(PATTERNS[type]);
    } catch (error) {
      console.warn("Haptic feedback was blocked or failed:", error);
    }
  }
}
