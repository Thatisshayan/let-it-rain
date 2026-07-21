import { TextInput, type TextInputProps, StyleSheet, View, Text } from 'react-native';
import { memo } from 'react';
import { useTheme } from '../theme';
import { Text as StyledText } from './Text';
import { Box } from './Box';

interface StyledInputProps extends TextInputProps {
  label: string;
  error?: string;
  helperText?: string;
  required?: boolean;
  containerStyle?: object;
  inputStyle?: object;
  labelStyle?: object;
  errorStyle?: object;
  helperTextStyle?: object;
  testID?: string;
}

const StyledInput = memo(({
  label,
  error,
  helperText,
  required = false,
  containerStyle,
  inputStyle,
  labelStyle,
  errorStyle,
  helperTextStyle,
  testID,
  value,
  onChangeText,
  placeholder,
  ...props
}: StyledInputProps) => {
  const theme = useTheme();

  return (
    <View style={[styles.container, containerStyle]}>
      <View style={styles.labelRow}>
        <StyledText
          variant="label"
          color={theme.foreground}
          style={[styles.label, labelStyle]}
        >
          {label} {required && <Text style={styles.required}>*</Text>}
        </StyledText>
      </View>

      <Box
        flexDirection="row"
        alignItems="center"
        backgroundColor="surfaceStrong"
        borderColor={error ? theme.destructive : theme.border}
        borderWidth={1}
        borderRadius={16}
        paddingHorizontal={12}
        style={[styles.inputContainer, inputStyle]}
      >
        <TextInput
          style={[
            styles.input,
            { color: theme.foreground },
            inputStyle,
          ]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.mutedForeground}
          testID={testID}
          {...props}
        />
      </Box>

      {error ? (
        <Text
          style={[styles.error, errorStyle]}
          accessibilityRole="alert"
        >
          {error}
        </Text>
      ) : null}

      {!error && helperText ? (
        <Text style={[styles.helper, helperTextStyle]}>
          {helperText}
        </Text>
      ) : null}
    </View>
  );
});

StyledInput.displayName = 'Input';

const styles = StyleSheet.create({
  container: {
    gap: 4,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    marginBottom: 4,
  },
  required: {
    color: '#ff7d75',
    fontWeight: '700',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    height: 44,
  },
  error: {
    marginTop: 4,
    color: '#ff7d75',
    fontSize: 13,
    fontWeight: '600',
  },
  helper: {
    marginTop: 4,
    color: '#9aa7bf',
    fontSize: 13,
  },
});

export { StyledInput as Input };