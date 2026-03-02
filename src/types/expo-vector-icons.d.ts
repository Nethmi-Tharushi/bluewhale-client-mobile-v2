declare module '@expo/vector-icons' {
  import * as React from 'react';

  type IconProps = {
    name: string;
    size?: number;
    color?: string;
  };

  export const Feather: React.ComponentType<IconProps> & {
    glyphMap: Record<string, number>;
  };
}
