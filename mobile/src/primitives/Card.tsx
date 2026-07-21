import { memo } from 'react';
import { Box } from './Box';

interface CardProps {
  variant?: 'default' | 'elevated' | 'outlined' | 'filled';
  padding?: number;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  testID?: string;
}

const Card = memo(({
  variant = 'default',
  padding = 16,
  header,
  footer,
  children,
  testID,
}: CardProps) => {
  return (
    <Box
      borderRadius={24}
      backgroundColor={variant === 'outlined' ? 'background' : 'surface'}
      borderColor={variant === 'outlined' ? 'border' : undefined}
      borderWidth={variant === 'outlined' ? 1 : undefined}
      padding={padding}
      testID={testID}
    >
      {header ? <Box marginBottom={header ? 8 : undefined}>{header}</Box> : null}
      <Box flex={1}>
        {children}
      </Box>
      {footer ? <Box marginTop={footer ? 8 : undefined}>{footer}</Box> : null}
    </Box>
  );
});

Card.displayName = 'Card';

export { Card };