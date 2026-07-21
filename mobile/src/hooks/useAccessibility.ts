import { useState, useEffect, useCallback } from 'react';
import { AccessibilityInfo } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const REDUCED_MOTION_KEY = 'accessibility_reduced_motion';

export interface AccessibilityState {
  reduceMotion: boolean;
  fontScale: number;
  setReduceMotion: (value: boolean) => Promise<void>;
}

const DEFAULT_REDUCE_MOTION = false;

export function useAccessibility(): AccessibilityState {
  const [reduceMotion, setReduceMotionState] = useState(DEFAULT_REDUCE_MOTION);
  const [fontScale, setFontScaleState] = useState(1);

  useEffect(() => {
    let mounted = true;

    AccessibilityInfo.addEventListener('reduceMotionChanged', (reduce) => {
      if (mounted) {
        setReduceMotionState(reduce);
      }
    });

    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (mounted) setReduceMotionState(reduce);
    });

    AsyncStorage.getItem(REDUCED_MOTION_KEY).then((value) => {
      if (mounted && value !== null) {
        setReduceMotionState(value === 'true');
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  const setReduceMotion = useCallback(async (value: boolean) => {
    setReduceMotionState(value);
    await AsyncStorage.setItem(REDUCED_MOTION_KEY, String(value));
  }, []);

  return {
    reduceMotion,
    fontScale,
    setReduceMotion,
  };
}

export function usePrefersReducedMotion(): boolean {
  const { reduceMotion } = useAccessibility();
  return reduceMotion;
}