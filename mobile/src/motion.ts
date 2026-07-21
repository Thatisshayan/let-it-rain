import { useAccessibility } from './hooks/useAccessibility';

export function useMotion() {
  const { reduceMotion } = useAccessibility();

  return {
    reduceMotion,
    shouldReduce: reduceMotion,
  };
}

export function withReducedMotion<T>(value: T): T | null {
  return null;
}