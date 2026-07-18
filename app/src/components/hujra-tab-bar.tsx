/**
 * Custom 4-tab bottom bar per the Hujra design: 22px stroke icon over an 11px
 * label; the active tab's icon sits in a rounded-14 pill of the accent tint.
 */
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AlertCircleIcon,
  BarChartIcon,
  HomeIcon,
  MicIcon,
  type IconProps,
} from '@/components/icons';
import { Fonts } from '@/constants/hujra';
import { useHujraTheme } from '@/hooks/use-hujra-theme';

const TABS: Record<string, { label: string; Icon: (p: IconProps) => React.ReactNode }> = {
  index: { label: 'Home', Icon: HomeIcon },
  memorize: { label: 'Memorize', Icon: MicIcon },
  review: { label: 'Review', Icon: AlertCircleIcon },
  progress: { label: 'Progress', Icon: BarChartIcon },
};

// Structural subset of react-navigation's BottomTabBarProps — expo-router
// vendors its own copy of those types, so depending on the package directly
// causes declaration clashes.
type TabBarProps = {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: {
    emit: (e: { type: 'tabPress'; target: string; canPreventDefault: true }) => { defaultPrevented: boolean };
    navigate: (name: string) => void;
  };
};

export function HujraTabBar({ state, navigation }: TabBarProps) {
  const { palette } = useHujraTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: palette.tabBarBg,
        borderTopWidth: 1,
        borderTopColor: palette.tabBarBorder,
        paddingBottom: Math.max(insets.bottom, 8),
        paddingTop: 8,
      }}>
      {state.routes.map((route, index) => {
        const tab = TABS[route.name];
        if (!tab) return null;
        const focused = state.index === index;
        const color = focused ? palette.primary : palette.textTertiary;

        return (
          <Pressable
            key={route.key}
            onPress={() => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
            }}
            style={{ flex: 1, alignItems: 'center', gap: 3 }}>
            <View
              style={{
                width: 46,
                height: 30,
                borderRadius: 14,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: focused ? palette.primaryTint : 'transparent',
              }}>
              <tab.Icon size={22} color={color} />
            </View>
            <Text style={{ fontFamily: focused ? Fonts.bodyBold : Fonts.body, fontSize: 11, color }}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
