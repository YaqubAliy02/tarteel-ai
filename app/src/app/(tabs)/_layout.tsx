import { Tabs } from 'expo-router';

import { HujraTabBar } from '@/components/hujra-tab-bar';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <HujraTabBar {...props} />}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="memorize" />
      <Tabs.Screen name="review" />
      <Tabs.Screen name="progress" />
    </Tabs>
  );
}
