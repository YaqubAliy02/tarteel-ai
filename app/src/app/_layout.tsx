import { Amiri_400Regular, Amiri_700Bold } from '@expo-google-fonts/amiri';
import {
  BricolageGrotesque_500Medium,
  BricolageGrotesque_600SemiBold,
  BricolageGrotesque_700Bold,
} from '@expo-google-fonts/bricolage-grotesque';
import {
  HankenGrotesk_400Regular,
  HankenGrotesk_500Medium,
  HankenGrotesk_600SemiBold,
  HankenGrotesk_700Bold,
} from '@expo-google-fonts/hanken-grotesk';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';

import { AuthScreen } from '@/components/auth-screen';
import { useHujraTheme } from '@/hooks/use-hujra-theme';
import { AuthProvider, useAuth } from '@/store/auth';
import { SessionProvider } from '@/store/session';

SplashScreen.preventAutoHideAsync();

function Gate() {
  const { isDark } = useHujraTheme();
  const { user, ready } = useAuth();

  if (!ready) return null;

  if (!user) {
    return (
      <>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <AuthScreen />
      </>
    );
  }

  return (
    <SessionProvider>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="goal-setup" options={{ presentation: 'modal' }} />
        <Stack.Screen name="read" />
        <Stack.Screen name="listen" />
      </Stack>
    </SessionProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Amiri_400Regular,
    Amiri_700Bold,
    BricolageGrotesque_500Medium,
    BricolageGrotesque_600SemiBold,
    BricolageGrotesque_700Bold,
    HankenGrotesk_400Regular,
    HankenGrotesk_500Medium,
    HankenGrotesk_600SemiBold,
    HankenGrotesk_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}
