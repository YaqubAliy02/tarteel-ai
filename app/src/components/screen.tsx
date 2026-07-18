import { ScrollView, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Layout } from '@/constants/hujra';
import { useHujraTheme } from '@/hooks/use-hujra-theme';

type Props = {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  style?: ViewStyle;
};

/** Shared screen chrome: canvas background + safe-area top + 22px gutters. */
export function Screen({ children, scroll = true, padded = true, style }: Props) {
  const { palette } = useHujraTheme();
  const insets = useSafeAreaInsets();

  const base: ViewStyle = {
    flex: 1,
    backgroundColor: palette.bg,
    paddingTop: insets.top,
  };

  if (!scroll) {
    return (
      <View style={[base, style]}>
        <View style={{ flex: 1, paddingHorizontal: padded ? Layout.screenPadding : 0 }}>{children}</View>
      </View>
    );
  }

  return (
    <View style={[base, style]}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: padded ? Layout.screenPadding : 0,
          paddingBottom: 28,
        }}
        showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>
    </View>
  );
}
