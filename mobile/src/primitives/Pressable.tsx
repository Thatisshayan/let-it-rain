import { Pressable as RNPressable, type PressableProps, ActivityIndicator } from 'react-native';
import { memo, useCallback, type ReactNode } from 'react';
import { useTheme } from '../theme';
import { haptics } from '../haptics';

interface StyledPressableProps extends Omit<PressableProps, 'style' | 'onPress' | 'disabled' | 'children'> {
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  haptic?: 'light' | 'medium' | 'heavy' | 'selection' | 'none';
  accessibilityLabel: string;
  accessibilityHint?: string;
  style?: PressableProps['style'];
  testID?: string;
  children: ReactNode;
}

const StyledPressable = memo(({
  onPress,
  disabled = false,
  loading = false,
  haptic = 'light',
  accessibilityLabel,
  accessibilityHint,
  style,
  children,
  testID,
  ...props
}: StyledPressableProps) => {
  const theme = useTheme();

  const handlePress = useCallback(() => {
    if (disabled || loading) return;
    if (haptic !== 'none') {
      haptics[haptic]();
    }
    onPress();
  }, [disabled, loading, haptic, onPress]);

  return (
    <RNPressable
      style={style}
      onPress={handlePress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      testID={testID}
      {...props}
    >
      {loading ? (
        <ActivityIndicator 
          size="small" 
          color={theme.primaryForeground}
        />
      ) : null}
      {children as ReactNode}
    </RNPressable>
  );
});

StyledPressable.displayName = 'Pressable';

export { StyledPressable as Pressable };