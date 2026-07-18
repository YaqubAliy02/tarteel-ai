/** Mistake Review — design handoff §3. Fed by the session store. */
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { Text, View } from 'react-native';

import { ClockIcon, PlayIcon } from '@/components/icons';
import { Screen } from '@/components/screen';
import { Fonts, Layout } from '@/constants/hujra';
import { useHujraTheme } from '@/hooks/use-hujra-theme';
import { getSurah } from '@/lib/quran';
import { useSession, type MistakeEntry } from '@/store/session';

export default function ReviewScreen() {
  const { palette } = useHujraTheme();
  const { mistakes, stats, refresh } = useSession();

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const groups = useMemo(() => {
    const bySurah = new Map<number, MistakeEntry[]>();
    for (const m of mistakes) {
      bySurah.set(m.surah, [...(bySurah.get(m.surah) ?? []), m]);
    }
    return [...bySurah.entries()].sort((a, b) => a[0] - b[0]);
  }, [mistakes]);

  const card = {
    backgroundColor: palette.surface,
    borderRadius: Layout.radiusCard,
    borderWidth: 1,
    borderColor: palette.cardBorder,
  } as const;

  return (
    <Screen>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginTop: 10 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: Fonts.display, fontSize: 26, color: palette.textPrimary }}>
            Review mistakes
          </Text>
          <Text style={{ fontFamily: Fonts.body, fontSize: 13, color: palette.textSecondary, marginTop: 3 }}>
            Fix your weak spots before they settle in
          </Text>
        </View>
        <View
          style={[
            card,
            { borderRadius: Layout.radiusPill, paddingHorizontal: 13, paddingVertical: 7 },
          ]}>
          <Text style={{ fontFamily: Fonts.bodySemiBold, fontSize: 12, color: palette.textPrimary }}>
            This week ▾
          </Text>
        </View>
      </View>

      {/* Stat cards */}
      <View style={{ flexDirection: 'row', gap: Layout.cardGap, marginTop: 16 }}>
        <View style={[card, { flex: 1, padding: 16 }]}>
          <Text style={{ fontFamily: Fonts.displayBold, fontSize: 27, color: palette.error }}>
            {mistakes.length}
          </Text>
          <Text style={{ fontFamily: Fonts.body, fontSize: 12.5, color: palette.textSecondary, marginTop: 2 }}>
            mistakes · {groups.length} surah{groups.length === 1 ? '' : 's'}
          </Text>
        </View>
        <View style={[card, { flex: 1, padding: 16 }]}>
          <Text style={{ fontFamily: Fonts.displayBold, fontSize: 27, color: palette.primary }}>
            {stats?.accuracy != null ? `${stats.accuracy}%` : '—'}
          </Text>
          <Text style={{ fontFamily: Fonts.body, fontSize: 12.5, color: palette.textSecondary, marginTop: 2 }}>
            accuracy · all time
          </Text>
        </View>
      </View>

      {/* Insight banner */}
      <View
        style={{
          backgroundColor: palette.goldTint,
          borderRadius: Layout.radiusCard,
          padding: 15,
          marginTop: Layout.cardGap,
          flexDirection: 'row',
          gap: 12,
          alignItems: 'center',
        }}>
        <ClockIcon size={20} color={palette.gold} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: Fonts.bodyBold, fontSize: 13, color: palette.textPrimary }}>
            Recurring weak spot
          </Text>
          <Text style={{ fontFamily: Fonts.body, fontSize: 12, color: palette.textSecondary, marginTop: 2, lineHeight: 17 }}>
            You tend to shorten the madd (elongation) — slow down on long vowels.
          </Text>
        </View>
      </View>

      {/* Groups */}
      {groups.map(([surahNo, entries]) => {
        const surah = getSurah(surahNo);
        return (
          <View key={surahNo} style={{ marginTop: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Text style={{ fontFamily: Fonts.arabic, fontSize: 19, color: palette.primary }}>{surah.arabic}</Text>
              <Text style={{ fontFamily: Fonts.display, fontSize: 15, color: palette.textPrimary, flex: 1 }}>
                {surah.name}
              </Text>
              <View
                style={{
                  backgroundColor: palette.errorTint,
                  borderRadius: Layout.radiusPill,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                }}>
                <Text style={{ fontFamily: Fonts.bodyBold, fontSize: 11, color: palette.error }}>
                  {entries.length} mistake{entries.length === 1 ? '' : 's'}
                </Text>
              </View>
            </View>

            <View style={{ gap: 10 }}>
              {entries.map((m) => (
                <View key={m.id} style={[card, { padding: 14 }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View
                      style={{
                        backgroundColor: palette.primaryTint,
                        borderRadius: 7,
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                      }}>
                      <Text style={{ fontFamily: Fonts.bodyBold, fontSize: 11, color: palette.primary }}>
                        Ayah {m.surah}:{m.ayah}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }} />
                    <View
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 15,
                        backgroundColor: palette.primaryTint,
                        alignItems: 'center',
                        justifyContent: 'center',
                        paddingLeft: 2,
                      }}>
                      <PlayIcon size={13} color={palette.primary} filled />
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                    <View
                      style={{
                        flex: 1,
                        backgroundColor: palette.primaryTint,
                        borderRadius: 14,
                        padding: 12,
                        alignItems: 'center',
                      }}>
                      <Text style={{ fontFamily: Fonts.bodyBold, fontSize: 10, letterSpacing: 0.8, color: palette.primary }}>
                        EXPECTED
                      </Text>
                      <Text
                        style={{
                          fontFamily: Fonts.arabic,
                          fontSize: 27,
                          lineHeight: 52,
                          color: palette.primary,
                          writingDirection: 'rtl',
                        }}>
                        {m.expected}
                      </Text>
                    </View>
                    <View
                      style={{
                        flex: 1,
                        backgroundColor: palette.errorTint,
                        borderRadius: 14,
                        padding: 12,
                        alignItems: 'center',
                      }}>
                      <Text style={{ fontFamily: Fonts.bodyBold, fontSize: 10, letterSpacing: 0.8, color: palette.error }}>
                        YOU RECITED
                      </Text>
                      {m.recited ? (
                        <Text
                          style={{
                            fontFamily: Fonts.arabic,
                            fontSize: 27,
                            lineHeight: 52,
                            color: palette.error,
                            writingDirection: 'rtl',
                          }}>
                          {m.recited}
                        </Text>
                      ) : (
                        <Text
                          style={{
                            fontFamily: Fonts.body,
                            fontSize: 13,
                            color: palette.error,
                            lineHeight: 52,
                          }}>
                          — skipped —
                        </Text>
                      )}
                    </View>
                  </View>

                  <Text style={{ fontFamily: Fonts.body, fontSize: 12, color: palette.textSecondary, marginTop: 10 }}>
                    {m.note}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        );
      })}

      {mistakes.length === 0 ? (
        <View style={{ alignItems: 'center', marginTop: 60, gap: 8 }}>
          <Text style={{ fontFamily: Fonts.display, fontSize: 19, color: palette.primary }}>
            No mistakes to review 🎉
          </Text>
          <Text style={{ fontFamily: Fonts.body, fontSize: 13, color: palette.textSecondary }}>
            Recite in Memorize mode and errors will appear here.
          </Text>
        </View>
      ) : null}
    </Screen>
  );
}
