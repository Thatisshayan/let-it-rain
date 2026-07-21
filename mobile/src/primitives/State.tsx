import { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme';
import { Box } from './Box';
import { Pressable } from './Pressable';

type StateVariant = 'loading' | 'empty' | 'error' | 'permission' | 'success' | 'warning';

interface StateProps {
  variant: StateVariant;
  title: string;
  description?: string;
  action?: {
    label: string;
    onPress: () => void;
    haptic?: 'light' | 'medium' | 'heavy';
  };
  testID?: string;
}

const VARIANT_CONFIG: Record<StateVariant, { color: string; icon: string }> = {
  loading: { color: '#7b9fff', icon: '⏳' },
  empty: { color: '#9aa7bf', icon: '📭' },
  error: { color: '#ff7d75', icon: '⚠️' },
  permission: { color: '#e0b15c', icon: '🔒' },
  success: { color: '#68c49b', icon: '✅' },
  warning: { color: '#e0b15c', icon: '⚠️' },
};

const State = memo(({
  variant,
  title,
  description,
  action,
  testID,
}: StateProps) => {
  const theme = useTheme();
  const config = VARIANT_CONFIG[variant];

  return (
    <Box
      padding={24}
      alignItems="center"
      justifyContent="center"
      gap={12}
      testID={testID}
    >
      <Text
        style={{ fontSize: 48 }}
        accessibilityLabel=""
      >
        {config.icon}
      </Text>
      
      <Box alignItems="center" gap={4}>
        <Text
          style={{
            fontSize: 22,
            fontWeight: '700',
            lineHeight: 26,
            color: config.color,
            textAlign: 'center',
          }}
          accessibilityRole="alert"
        >
          {title}
        </Text>
        
        {description ? (
          <Text
            style={{
              fontSize: 15,
              lineHeight: 22,
              color: theme.mutedForeground,
              textAlign: 'center',
              maxWidth: 280,
            }}
          >
            {description}
          </Text>
        ) : null}
      </Box>

      {action ? (
        <Pressable
          onPress={action.onPress}
          haptic={action.haptic}
          accessibilityLabel={action.label}
          style={styles.actionButton}
        >
          <Text style={{
            fontSize: 13,
            fontWeight: '700',
            color: theme.primaryForeground,
          }}>
            {action.label}
          </Text>
        </Pressable>
      ) : null}
    </Box>
  );
});

State.displayName = 'State';

const styles = StyleSheet.create({
  actionButton: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: '#7b9fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export { State };
export type { StateVariant };