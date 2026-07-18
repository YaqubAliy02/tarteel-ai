import { router } from 'expo-router';
import { Alert, Pressable, Text, View } from 'react-native';

import {
  AlertCircleIcon,
  BookOpenIcon,
  HeadphonesIcon,
  MicIcon,
  PlayIcon,
} from '@/components/icons';
import { ProgressRing } from '@/components/progress-ring';
import { Screen } from '@/components/screen';
import { Fonts, Layout } from '@/constants/hujra';
import { useHujraTheme } from '@/hooks/use-hujra-theme';
import { getSurah } from '@/lib/quran';
import { useSession } from '@/store/session';

const DAILY_GOAL = 12; // verses/day; becomes user-configurable with Goal sync

export default function HomeScreen() {
  const { palette, isDark } = useHujraTheme();
  const { mistakes, stats, progress } = useSession();

  const todayIso = new Date().toISOString().slice(0, 10);
  const doneToday = stats?.activity.find((a) => a.day === todayIso)?.count ?? 0;
  const goalPct = Math.min(1, doneToday / DAILY_GOAL);

  const cont = progress?.continue ?? null;
  const contSurah = cont ? getSurah(cont.surah) : null;

  // Weekday dots (Mon..Sun) from real activity
  const activityDays = new Set((stats?.activity ?? []).map((a) => a.day));
  const jsDay = new Date().getDay(); // 0=Sun
  const todayIndex = (jsDay + 6) % 7; // 0=Mon
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (todayIndex - i));
    return activityDays.has(d.toISOString().slice(0, 10));
  });
  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const card = {
    backgroundColor: palette.surface,
    borderRadius: Layout.radiusCard,
    borderWidth: 1,
    borderColor: palette.cardBorder,
    padding: 18,
  } as const;

  const eyebrow = {
    fontFamily: Fonts.bodyBold,
    fontSize: 11,
    letterSpacing: 1.1,
    color: palette.gold,
  } as const;

  const notYet = (what: string) =>
    Alert.alert(what, 'Coming in a later phase — the memorization loop comes first.');

  return (
    <Screen>
      {/* Greeting */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: Fonts.body, fontSize: 12.5, color: palette.textSecondary }}>{today}</Text>
          <Text style={{ fontFamily: Fonts.display, fontSize: 22, color: palette.textPrimary, marginTop: 5 }}>
            Assalāmu ʿalaykum, Yusuf
          </Text>
        </View>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: palette.primaryTint,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Text style={{ fontFamily: Fonts.display, fontSize: 17, color: palette.primary }}>Y</Text>
        </View>
      </View>

      {/* Today's goal */}
      <View style={[card, { marginTop: 18, flexDirection: 'row', alignItems: 'center', gap: 18 }]}>
        <ProgressRing
          size={104}
          strokeWidth={10}
          progress={goalPct}
          color={palette.primary}
          trackColor={palette.ringTrack}>
          <Text style={{ fontFamily: Fonts.displayBold, fontSize: 20, color: palette.textPrimary }}>
            {Math.round(goalPct * 100)}%
          </Text>
          <Text style={{ fontFamily: Fonts.body, fontSize: 11, color: palette.textSecondary }}>today</Text>
        </ProgressRing>
        <View style={{ flex: 1 }}>
          <Text style={eyebrow}>TODAY'S GOAL</Text>
          <Text style={{ fontFamily: Fonts.display, fontSize: 19, color: palette.textPrimary, marginTop: 4 }}>
            {doneToday} of {DAILY_GOAL} verses
          </Text>
          <Text style={{ fontFamily: Fonts.body, fontSize: 12.5, color: palette.textSecondary, marginTop: 3 }}>
            {Math.max(0, DAILY_GOAL - doneToday)} verses left
            {contSurah ? ` · ${contSurah.name}` : ''}
          </Text>
          <View style={{ height: 7, borderRadius: 4, backgroundColor: palette.ringTrack, marginTop: 10, overflow: 'hidden' }}>
            <View style={{ width: `${goalPct * 100}%`, height: '100%', borderRadius: 4, backgroundColor: palette.primary }} />
          </View>
        </View>
      </View>

      {/* Continue card */}
      <Pressable
        onPress={() => router.push('/memorize')}
        style={{
          marginTop: Layout.cardGap,
          backgroundColor: isDark ? palette.primaryDeepCard : palette.primary,
          borderWidth: isDark ? 1 : 0,
          borderColor: palette.primaryDeepCardBorder,
          borderRadius: Layout.radiusCard,
          padding: 20,
          overflow: 'hidden',
          flexDirection: 'row',
          alignItems: 'center',
        }}>
        <Text
          style={{
            position: 'absolute',
            top: -12,
            right: 8,
            fontFamily: Fonts.arabic,
            fontSize: 84,
            color: 'rgba(255,255,255,0.06)',
          }}>
          {contSurah?.arabic ?? 'الفاتحة'}
        </Text>
        <View style={{ flex: 1 }}>
          <Text style={[{ fontFamily: Fonts.bodyBold, fontSize: 11, letterSpacing: 1.1 }, { color: 'rgba(255,255,255,0.65)' }]}>
            {cont ? 'CONTINUE WHERE YOU LEFT OFF' : 'START MEMORIZING'}
          </Text>
          <Text style={{ fontFamily: Fonts.display, fontSize: 20, color: '#FFFFFF', marginTop: 6 }}>
            Surah {contSurah?.name ?? 'Al-Fatihah'}
          </Text>
          <Text style={{ fontFamily: Fonts.body, fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>
            Ayah {cont?.ayah ?? 1} · Memorize
          </Text>
          <View style={{ height: 5, width: 150, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.22)', marginTop: 12, overflow: 'hidden' }}>
            <View
              style={{
                width: `${contSurah && cont ? Math.round((cont.ayah / contSurah.ayahCount) * 100) : 0}%`,
                height: '100%',
                backgroundColor: palette.gold,
                borderRadius: 3,
              }}
            />
          </View>
        </View>
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: '#FBF5E6',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <View style={{ marginLeft: 3 }}>
            <PlayIcon size={22} color={palette.primary} filled />
          </View>
        </View>
      </Pressable>

      {/* Streak card */}
      <View style={[card, { marginTop: Layout.cardGap, flexDirection: 'row', alignItems: 'center' }]}>
        <View style={{ alignItems: 'flex-start', paddingRight: 18 }}>
          <Text style={{ fontFamily: Fonts.displayBold, fontSize: 30, color: palette.gold }}>{stats?.streak ?? 0}</Text>
          <Text style={{ fontFamily: Fonts.bodyBold, fontSize: 10.5, letterSpacing: 1, color: palette.textSecondary }}>
            DAY STREAK
          </Text>
        </View>
        <View style={{ width: 1, alignSelf: 'stretch', backgroundColor: palette.cardBorder, marginRight: 18 }} />
        <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-between' }}>
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => {
            const isToday = i === todayIndex;
            const done = week[i];
            return (
              <View key={`${d}-${i}`} style={{ alignItems: 'center', gap: 6 }}>
                <View
                  style={{
                    width: 13,
                    height: 13,
                    borderRadius: 7,
                    backgroundColor: done || isToday ? palette.primary : palette.futureDot,
                    borderWidth: isToday ? 2 : 0,
                    borderColor: palette.gold,
                  }}
                />
                <Text style={{ fontFamily: Fonts.body, fontSize: 10.5, color: palette.textTertiary }}>{d}</Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Quick access 2x2 */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Layout.cardGap, marginTop: Layout.cardGap }}>
        {[
          {
            key: 'memorize',
            title: 'Memorize',
            caption: contSurah && cont ? `${contSurah.name} · ${cont.ayah}/${contSurah.ayahCount}` : 'Start fresh',
            tint: palette.primaryTint,
            color: palette.primary,
            Icon: MicIcon,
            onPress: () => router.push('/memorize'),
          },
          {
            key: 'read',
            title: 'Read',
            caption: 'Full Mushaf',
            tint: palette.goldTint,
            color: palette.gold,
            Icon: BookOpenIcon,
            onPress: () => notYet('Read'),
          },
          {
            key: 'listen',
            title: 'Listen',
            caption: 'Recitations',
            tint: palette.primaryTint,
            color: palette.primary,
            Icon: HeadphonesIcon,
            onPress: () => notYet('Listen'),
          },
          {
            key: 'review',
            title: 'Review mistakes',
            caption: `${mistakes.length} to fix`,
            captionColor: palette.error,
            tint: palette.errorTint,
            color: palette.error,
            Icon: AlertCircleIcon,
            onPress: () => router.push('/review'),
          },
        ].map((tile) => (
          <Pressable
            key={tile.key}
            onPress={tile.onPress}
            style={[card, { width: '47.5%', flexGrow: 1, borderRadius: Layout.radiusTile, padding: 16 }]}>
            <View
              style={{
                width: 42,
                height: 42,
                borderRadius: 13,
                backgroundColor: tile.tint,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <tile.Icon size={21} color={tile.color} />
            </View>
            <Text style={{ fontFamily: Fonts.display, fontSize: 15, color: palette.textPrimary, marginTop: 12 }}>
              {tile.title}
            </Text>
            <Text
              style={{
                fontFamily: Fonts.body,
                fontSize: 12,
                color: tile.captionColor ?? palette.textSecondary,
                marginTop: 2,
              }}>
              {tile.caption}
            </Text>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}
