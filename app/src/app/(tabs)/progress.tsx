/**
 * Progress / Analytics — design handoff §4.
 * Aggregates are Phase 2 backend work; sample data mirrors the design.
 */
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Fonts, Layout } from '@/constants/hujra';
import { useHujraTheme } from '@/hooks/use-hujra-theme';
import { getSurah } from '@/lib/quran';
import { useSession } from '@/store/session';

function strengthStatus(pct: number): 'Strong' | 'Needs work' | 'Weak' {
  return pct >= 85 ? 'Strong' : pct >= 60 ? 'Needs work' : 'Weak';
}

export default function ProgressScreen() {
  const { palette } = useHujraTheme();
  const { stats, refresh } = useSession();

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  // Real practice activity: 84 daily cells ending today, intensity 0-4.
  const counts = new Map((stats?.activity ?? []).map((a) => [a.day, a.count]));
  const today = new Date();
  const ACTIVITY = Array.from({ length: 84 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (83 - i));
    const c = counts.get(d.toISOString().slice(0, 10)) ?? 0;
    return Math.min(4, c);
  });
  const monthLabels = [0, 28, 56].map((offset) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (83 - offset));
    return d.toLocaleDateString('en-GB', { month: 'short' });
  });

  // Real per-surah strength from recitation history.
  const strength = (stats?.surah_strength ?? []).map((s) => {
    const meta = getSurah(s.surah);
    return { name: meta.name, arabic: meta.arabic, pct: s.pct, status: strengthStatus(s.pct) };
  });

  const card = {
    backgroundColor: palette.surface,
    borderRadius: Layout.radiusCard,
    borderWidth: 1,
    borderColor: palette.cardBorder,
  } as const;

  const statusColor = (s: string) =>
    s === 'Strong' ? palette.primary : s === 'Needs work' ? palette.gold : palette.error;

  const activeDays = ACTIVITY.filter((v) => v > 0).length;

  return (
    <Screen>
      <View style={{ marginTop: 10 }}>
        <Text style={{ fontFamily: Fonts.display, fontSize: 26, color: palette.textPrimary }}>Your progress</Text>
        <Text style={{ fontFamily: Fonts.body, fontSize: 13, color: palette.textSecondary, marginTop: 3 }}>
          Last 12 weeks
        </Text>
      </View>

      {/* Stat cards */}
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
        <View style={{ flex: 1, backgroundColor: palette.primary, borderRadius: Layout.radiusCard, padding: 14 }}>
          <Text style={{ fontFamily: Fonts.displayBold, fontSize: 26, color: '#FFFFFF' }}>
            {stats?.accuracy != null ? `${stats.accuracy}%` : '—'}
          </Text>
          <Text style={{ fontFamily: Fonts.body, fontSize: 11.5, color: 'rgba(255,255,255,0.8)', marginTop: 2 }}>
            accuracy
          </Text>
        </View>
        <View style={[card, { flex: 1, padding: 14 }]}>
          <Text style={{ fontFamily: Fonts.displayBold, fontSize: 26, color: palette.textPrimary }}>
            {stats?.attempts ?? 0}
          </Text>
          <Text style={{ fontFamily: Fonts.body, fontSize: 11.5, color: palette.textSecondary, marginTop: 2 }}>
            verses recited
          </Text>
        </View>
        <View style={[card, { flex: 1, padding: 14 }]}>
          <Text style={{ fontFamily: Fonts.displayBold, fontSize: 26, color: palette.gold }}>
            {stats?.streak ?? 0}
          </Text>
          <Text style={{ fontFamily: Fonts.body, fontSize: 11.5, color: palette.textSecondary, marginTop: 2 }}>
            day streak
          </Text>
        </View>
      </View>

      {/* Heatmap */}
      <View style={[card, { marginTop: Layout.cardGap, padding: 16 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
          <Text style={{ fontFamily: Fonts.display, fontSize: 15.5, color: palette.textPrimary, flex: 1 }}>
            Practice activity
          </Text>
          <Text style={{ fontFamily: Fonts.body, fontSize: 12, color: palette.textSecondary }}>
            {activeDays} of {ACTIVITY.length} days
          </Text>
        </View>
        <View style={{ flexDirection: 'row', marginTop: 12, marginBottom: 4 }}>
          {monthLabels.map((m) => (
            <Text
              key={m}
              style={{ flex: 1, fontFamily: Fonts.body, fontSize: 10.5, color: palette.textTertiary }}>
              {m}
            </Text>
          ))}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
          {ACTIVITY.map((v, i) => (
            <View
              key={i}
              style={{
                // 12 columns with 4px gaps inside the padded card
                width: `${100 / 12 - 1}%`,
                aspectRatio: 1,
                borderRadius: 4,
                backgroundColor: palette.heatmap[v],
              }}
            />
          ))}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10, justifyContent: 'flex-end' }}>
          <Text style={{ fontFamily: Fonts.body, fontSize: 10.5, color: palette.textTertiary }}>Less</Text>
          {palette.heatmap.map((c) => (
            <View key={c} style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: c }} />
          ))}
          <Text style={{ fontFamily: Fonts.body, fontSize: 10.5, color: palette.textTertiary }}>More</Text>
        </View>
      </View>

      {/* Surah strength */}
      <View style={[card, { marginTop: Layout.cardGap, padding: 16 }]}>
        <Text style={{ fontFamily: Fonts.display, fontSize: 15.5, color: palette.textPrimary, marginBottom: 4 }}>
          Surah strength
        </Text>
        {strength.length === 0 ? (
          <Text style={{ fontFamily: Fonts.body, fontSize: 12.5, color: palette.textSecondary, marginTop: 8 }}>
            Recite in Memorize mode and each surah's strength will appear here.
          </Text>
        ) : null}
        {strength.map((s) => (
          <View key={s.name} style={{ marginTop: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontFamily: Fonts.display, fontSize: 14, color: palette.textPrimary }}>{s.name}</Text>
              <Text style={{ fontFamily: Fonts.arabic, fontSize: 15, color: palette.textSecondary, marginLeft: 8, flex: 1 }}>
                {s.arabic}
              </Text>
              <Text style={{ fontFamily: Fonts.bodyBold, fontSize: 11.5, color: statusColor(s.status) }}>
                {s.status}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 7 }}>
              <View style={{ flex: 1, height: 7, borderRadius: 4, backgroundColor: palette.ringTrack, overflow: 'hidden' }}>
                <View
                  style={{
                    width: `${s.pct}%`,
                    height: '100%',
                    borderRadius: 4,
                    backgroundColor: statusColor(s.status),
                  }}
                />
              </View>
              <Text style={{ fontFamily: Fonts.bodySemiBold, fontSize: 12, color: palette.textSecondary, width: 36, textAlign: 'right' }}>
                {s.pct}%
              </Text>
            </View>
          </View>
        ))}
      </View>
    </Screen>
  );
}
