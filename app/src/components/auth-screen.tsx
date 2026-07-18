/** Sign in / create account — shown before the tabs when signed out. */
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Fonts, Layout } from '@/constants/hujra';
import { useHujraTheme } from '@/hooks/use-hujra-theme';
import { useAuth } from '@/store/auth';

export function AuthScreen() {
  const { palette } = useHujraTheme();
  const insets = useSafeAreaInsets();
  const { signIn, signUp } = useAuth();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      if (mode === 'login') await signIn(email.trim(), password);
      else await signUp(email.trim(), password, name.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not reach the server.');
    } finally {
      setBusy(false);
    }
  };

  const inputStyle = {
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.cardBorder,
    borderRadius: Layout.radiusButton,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontFamily: Fonts.body,
    fontSize: 15,
    color: palette.textPrimary,
    marginTop: 10,
  } as const;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: palette.bg }}>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          paddingHorizontal: Layout.screenPadding + 6,
          paddingTop: insets.top,
          paddingBottom: 30,
        }}
        keyboardShouldPersistTaps="handled">
        <Text
          style={{
            fontFamily: Fonts.arabic,
            fontSize: 44,
            color: palette.primary,
            textAlign: 'center',
            writingDirection: 'rtl',
          }}>
          حُجْرَة
        </Text>
        <Text style={{ fontFamily: Fonts.display, fontSize: 24, color: palette.textPrimary, textAlign: 'center', marginTop: 6 }}>
          Hujra
        </Text>
        <Text
          style={{
            fontFamily: Fonts.body,
            fontSize: 13.5,
            color: palette.textSecondary,
            textAlign: 'center',
            marginTop: 4,
            marginBottom: 26,
          }}>
          Your Quran memorization companion
        </Text>

        {mode === 'register' ? (
          <TextInput
            style={inputStyle}
            placeholder="Your name"
            placeholderTextColor={palette.textTertiary}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />
        ) : null}
        <TextInput
          style={inputStyle}
          placeholder="Email"
          placeholderTextColor={palette.textTertiary}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />
        <TextInput
          style={inputStyle}
          placeholder={mode === 'register' ? 'Password (min 8 characters)' : 'Password'}
          placeholderTextColor={palette.textTertiary}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        {error ? (
          <Text style={{ fontFamily: Fonts.bodySemiBold, fontSize: 12.5, color: palette.error, marginTop: 12, textAlign: 'center' }}>
            {error}
          </Text>
        ) : null}

        <Pressable
          onPress={submit}
          disabled={busy || !email || !password}
          style={{
            marginTop: 18,
            backgroundColor: palette.primary,
            borderRadius: Layout.radiusButton,
            paddingVertical: 15,
            alignItems: 'center',
            opacity: busy || !email || !password ? 0.6 : 1,
          }}>
          {busy ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={{ fontFamily: Fonts.display, fontSize: 16, color: '#FFFFFF' }}>
              {mode === 'login' ? 'Sign in' : 'Create account'}
            </Text>
          )}
        </Pressable>

        <Pressable
          onPress={() => {
            setMode((m) => (m === 'login' ? 'register' : 'login'));
            setError(null);
          }}
          style={{ marginTop: 16, alignItems: 'center', padding: 6 }}>
          <Text style={{ fontFamily: Fonts.bodySemiBold, fontSize: 13.5, color: palette.primary }}>
            {mode === 'login' ? "New here? Create an account" : 'Already have an account? Sign in'}
          </Text>
        </Pressable>

        <View style={{ height: 1, backgroundColor: palette.cardBorder, marginTop: 24, marginBottom: 10 }} />
        <Text style={{ fontFamily: Fonts.bodyRegular, fontSize: 11.5, color: palette.textTertiary, textAlign: 'center', lineHeight: 17 }}>
          Your recitation progress and mistakes are saved to your account.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
