import { 
  ImpactFeedbackStyle, 
  NotificationFeedbackType,
  impactAsync,
  notificationAsync,
  selectionAsync 
} from 'expo-haptics';
import { useAccessibility } from './hooks/useAccessibility';

type HapticType = 'light' | 'medium' | 'heavy' | 'selection' | 'notification';
type NotificationType = 'success' | 'warning' | 'error';

export const haptics = {
  light: async () => {
    try {
      await impactAsync(ImpactFeedbackStyle.Light);
    } catch {
      // Haptics not available
    }
  },

  medium: async () => {
    try {
      await impactAsync(ImpactFeedbackStyle.Medium);
    } catch {
      // Haptics not available
    }
  },

  heavy: async () => {
    try {
      await impactAsync(ImpactFeedbackStyle.Heavy);
    } catch {
      // Haptics not available
    }
  },

  selection: async () => {
    try {
      await selectionAsync();
    } catch {
      // Haptics not available
    }
  },

  success: async () => {
    try {
      await notificationAsync(NotificationFeedbackType.Success);
    } catch {
      // Haptics not available
    }
  },

  warning: async () => {
    try {
      await notificationAsync(NotificationFeedbackType.Warning);
    } catch {
      // Haptics not available
    }
  },

  error: async () => {
    try {
      await notificationAsync(NotificationFeedbackType.Error);
    } catch {
      // Haptics not available
    }
  },

  trigger: async (type: HapticType | NotificationType, isNotification: boolean = false) => {
    if (isNotification) {
      switch (type as NotificationType) {
        case 'success':
          await haptics.success();
          break;
        case 'warning':
          await haptics.warning();
          break;
        case 'error':
          await haptics.error();
          break;
      }
    } else {
      switch (type as HapticType) {
        case 'light':
          await haptics.light();
          break;
        case 'medium':
          await haptics.medium();
          break;
        case 'heavy':
          await haptics.heavy();
          break;
        case 'selection':
          await haptics.selection();
          break;
      }
    }
  },
};

export function useHaptics() {
  const { reduceMotion } = useAccessibility();

  return {
    light: async () => { if (!reduceMotion) await haptics.light(); },
    medium: async () => { if (!reduceMotion) await haptics.medium(); },
    heavy: async () => { if (!reduceMotion) await haptics.heavy(); },
    selection: async () => { if (!reduceMotion) await haptics.selection(); },
    success: async () => { if (!reduceMotion) await haptics.success(); },
    warning: async () => { if (!reduceMotion) await haptics.warning(); },
    error: async () => { if (!reduceMotion) await haptics.error(); },
    trigger: haptics.trigger,
    isEnabled: true,
    reduceMotion,
  };
}