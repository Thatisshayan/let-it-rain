import { View, type ViewProps, StyleSheet } from 'react-native';
import { memo } from 'react';
import { useTheme } from '../theme';

interface BoxProps extends ViewProps {
  flex?: number;
  flexDirection?: 'row' | 'column';
  justifyContent?: 'flex-start' | 'center' | 'flex-end' | 'space-between';
  alignItems?: 'flex-start' | 'center' | 'flex-end';
  gap?: number;
  padding?: number;
  paddingHorizontal?: number;
  paddingVertical?: number;
  marginTop?: number;
  marginBottom?: number;
  marginLeft?: number;
  marginRight?: number;
  width?: number | string;
  height?: number | string;
  minWidth?: number | string;
  minHeight?: number | string;
  maxWidth?: number | string;
  maxHeight?: number | string;
  borderRadius?: number;
  borderWidth?: number;
  borderColor?: string;
  backgroundColor?: string;
  opacity?: number;
  style?: ViewProps['style'];
  testID?: string;
}

const Box = memo(({
  flex,
  flexDirection = 'column',
  justifyContent,
  alignItems,
  gap,
  padding,
  paddingHorizontal,
  paddingVertical,
  marginTop,
  marginBottom,
  marginLeft,
  marginRight,
  width,
  height,
  minWidth,
  minHeight,
  maxWidth,
  maxHeight,
  borderRadius,
  borderWidth,
  borderColor,
  backgroundColor,
  opacity,
  style,
  children,
  testID,
  ...props
}: BoxProps) => {
  const theme = useTheme();
  const resolveColor = (value?: string): string | undefined => {
    if (value === undefined) return value;
    const resolved = (theme as unknown as Record<string, unknown>)[value];
    return typeof resolved === 'string' ? resolved : value;
  };

  const containerStyle = [
    styles.base,
    {
      flex,
      flexDirection,
      justifyContent,
      alignItems,
      gap,
      padding,
      paddingHorizontal,
      paddingVertical,
      marginTop,
      marginBottom,
      marginLeft,
      marginRight,
      width,
      height,
      minWidth,
      minHeight,
      maxWidth,
      maxHeight,
      borderRadius,
      borderWidth,
      borderColor: resolveColor(borderColor),
      backgroundColor: resolveColor(backgroundColor),
      opacity: opacity ?? 1,
    },
    style,
  ].filter(Boolean) as object[];

  return (
    <View
      style={containerStyle}
      testID={testID}
      {...props}
    >
      {children}
    </View>
  );
});

Box.displayName = 'Box';

const styles = StyleSheet.create({
  base: {
    overflow: 'visible' as const,
    position: 'relative' as const,
  },
});

export { Box };