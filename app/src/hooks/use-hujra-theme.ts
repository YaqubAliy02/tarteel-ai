import { useColorScheme } from 'react-native';

import { HujraDark, HujraLight, type HujraPalette } from '@/constants/hujra';

export function useHujraTheme(): { palette: HujraPalette; isDark: boolean } {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  return { palette: isDark ? HujraDark : HujraLight, isDark };
}
