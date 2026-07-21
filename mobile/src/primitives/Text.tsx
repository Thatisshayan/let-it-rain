import { Text, type TextProps, StyleSheet } from 'react-native';
import { memo } from 'react';
import { useTheme } from '../theme';

interface StyledTextProps extends TextProps {
  variant?: 'display' | 'h1' | 'h2' | 'h3' | 'title' | 'subtitle' | 'body' | 'label' | 'caption' | 'eyebrow';
  color?: string;
  weight?: 'normal' | 'medium' | 'semibold' | 'bold' | 'extrabold';
  align?: 'auto' | 'left' | 'center' | 'right' | 'justify';
  numberOfLines?: number;
  lineHeight?: number;
  letterSpacing?: number;
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
  style?: TextProps['style'];
  testID?: string;
}

const TEXT_SIZES: Record<string, { size: number; lineHeight: number; fontWeight: string; letterSpacing: number; textTransform?: 'uppercase' | 'lowercase' | 'capitalize' | 'none' }> = {
  display: { size: 40, lineHeight: 44, fontWeight: '800', letterSpacing: -1 },
  h1: { size: 32, lineHeight: 36, fontWeight: '800', letterSpacing: -1 },
  h2: { size: 28, lineHeight: 32, fontWeight: '800', letterSpacing: -0.8 },
  h3: { size: 22, lineHeight: 26, fontWeight: '700', letterSpacing: -0.6 },
  title: { size: 18, lineHeight: 24, fontWeight: '700', letterSpacing: -0.3 },
  subtitle: { size: 16, lineHeight: 22, fontWeight: '600', letterSpacing: -0.2 },
  body: { size: 15, lineHeight: 22, fontWeight: '400', letterSpacing: 0 },
  label: { size: 13, lineHeight: 18, fontWeight: '500', letterSpacing: 0 },
  caption: { size: 12, lineHeight: 16, fontWeight: '400', letterSpacing: 0.3 },
  eyebrow: { size: 11, lineHeight: 14, fontWeight: '700', letterSpacing: 1.6, textTransform: 'uppercase' },
};

const StyledText = memo(({
  variant = 'body',
  color,
  weight,
  align,
  numberOfLines,
  lineHeight,
  letterSpacing,
  textTransform,
  style,
  children,
  testID,
  ...props
}: StyledTextProps) => {
  const theme = useTheme();
  const textConfig = TEXT_SIZES[variant] || TEXT_SIZES.body;
  const resolvedColor = color ?? theme.foreground;

  const fontWeight = weight ?? textConfig.fontWeight;
  const resolvedLineHeight = lineHeight ?? textConfig.lineHeight;
  const resolvedLetterSpacing = letterSpacing ?? textConfig.letterSpacing;
  const resolvedTextTransform = textTransform ?? textConfig.textTransform;

  const textStyle = [
    styles.base,
    {
      fontSize: textConfig.size,
      lineHeight: resolvedLineHeight,
      fontWeight: fontWeight as '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900' | 'normal' | 'bold' | 'bolder' | 'lighter',
      letterSpacing: resolvedLetterSpacing,
      textAlign: align,
      color: resolvedColor,
      textTransform: resolvedTextTransform,
    },
    style,
  ].filter(Boolean) as object[];

  return (
    <Text
      style={textStyle}
      numberOfLines={numberOfLines}
      testID={testID}
      {...props}
    >
      {children}
    </Text>
  );
});

StyledText.displayName = 'Text';

const styles = StyleSheet.create({
  base: {
    includeFontPadding: false,
  },
});

export { StyledText as Text };