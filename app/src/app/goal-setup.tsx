/**
 * Goal Setup — design handoff §5. Pushed/modal screen.
 * Goals persistence is Phase 2 backend work; state is local for now.
 */
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, Switch, Text, View } from 'react-native';

import {
  BookOpenIcon,
  CalendarIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  MinusIcon,
  PlusIcon,
  RefreshIcon,
} from '@/components/icons';
import { Screen } from '@/components/screen';
import { Fonts, Layout } from '@/constants/hujra';
import { useHujraTheme } from '@/hooks/use-hujra-theme';
import { SURAHS, getSurah } from '@/lib/quran';

const GOAL_TYPES = [
  { key: 'surah', title: 'Memorize a surah', desc: 'Work through a surah verse by verse', Icon: BookOpenIcon },
  { key: 'juz', title: 'Review a juz', desc: 'Keep a memorized juz fresh', Icon: RefreshIcon },
  { key: 'daily', title: 'Daily recitation', desc: 'A steady daily recitation habit', Icon: CalendarIcon },
] as const;

const FREQUENCIES = ['Daily', 'Weekdays', 'Fridays'] as const;

export default function GoalSetupScreen() {
  const { palette, isDark } = useHujraTheme();

  const [goalType, setGoalType] = useState<(typeof GOAL_TYPES)[number]['key']>('surah');
  const [surahNo, setSurahNo] = useState(18);
  const [pace, setPace] = useState(3);
  const [frequency, setFrequency] = useState<(typeof FREQUENCIES)[number]>('Daily');
  const [reminder, setReminder] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);

  const surah = getSurah(surahNo);

  const finish = useMemo(() => {
    const days = Math.ceil(surah.ayahCount / pace);
    const perWeek = frequency === 'Daily' ? 7 : frequency === 'Weekdays' ? 5 : 1;
    const calendarDays = Math.ceil((days * 7) / perWeek);
    const d = new Date();
    d.setDate(d.getDate() + calendarDays);
    return {
      days,
      date: d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }),
    };
  }, [surah, pace, frequency]);

  const card = {
    backgroundColor: palette.surface,
    borderRadius: Layout.radiusCard,
    borderWidth: 1,
    borderColor: palette.cardBorder,
  } as const;

  const sectionLabel = {
    fontFamily: Fonts.bodyBold,
    fontSize: 11,
    letterSpacing: 1.1,
    color: palette.textSecondary,
    marginTop: 22,
    marginBottom: 9,
  } as const;

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <Screen>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 12 }}>
          <Pressable
            onPress={() => router.back()}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: palette.surface,
              borderWidth: 1,
              borderColor: palette.cardBorder,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <ChevronLeftIcon size={20} color={palette.textPrimary} />
          </Pressable>
          <Text style={{ fontFamily: Fonts.display, fontSize: 22, color: palette.textPrimary }}>New goal</Text>
        </View>

        {/* Goal type */}
        <Text style={sectionLabel}>GOAL TYPE</Text>
        <View style={{ gap: 10 }}>
          {GOAL_TYPES.map((t) => {
            const selected = goalType === t.key;
            return (
              <Pressable
                key={t.key}
                onPress={() => setGoalType(t.key)}
                style={[
                  card,
                  {
                    padding: 14,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    borderColor: selected ? palette.primary : palette.cardBorder,
                    borderWidth: selected ? 1.5 : 1,
                    backgroundColor: selected ? palette.primaryTint : palette.surface,
                  },
                ]}>
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    backgroundColor: selected ? palette.primary : palette.primaryTint,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <t.Icon size={19} color={selected ? '#FFFFFF' : palette.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: Fonts.display, fontSize: 15, color: palette.textPrimary }}>{t.title}</Text>
                  <Text style={{ fontFamily: Fonts.body, fontSize: 12, color: palette.textSecondary, marginTop: 1 }}>
                    {t.desc}
                  </Text>
                </View>
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    borderWidth: selected ? 0 : 1.5,
                    borderColor: palette.textTertiary,
                    backgroundColor: selected ? palette.primary : 'transparent',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  {selected ? <CheckIcon size={13} color="#FFFFFF" strokeWidth={2.5} /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* What to memorize */}
        <Text style={sectionLabel}>WHAT TO MEMORIZE</Text>
        <Pressable
          onPress={() => setPickerOpen(true)}
          style={[card, { padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }]}>
          <Text style={{ fontFamily: Fonts.arabic, fontSize: 23, color: palette.primary }}>{surah.arabic}</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: Fonts.display, fontSize: 15, color: palette.textPrimary }}>
              Surah {surah.name}
            </Text>
            <Text style={{ fontFamily: Fonts.body, fontSize: 12, color: palette.textSecondary, marginTop: 1 }}>
              Chapter {surah.number} · {surah.ayahCount} verses
            </Text>
          </View>
          <ChevronRightIcon size={18} color={palette.textTertiary} />
        </Pressable>

        {/* Pace */}
        <Text style={sectionLabel}>PACE</Text>
        <View style={[card, { padding: 14 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ fontFamily: Fonts.display, fontSize: 15, color: palette.textPrimary, flex: 1 }}>
              Verses per day
            </Text>
            <Pressable
              onPress={() => setPace((p) => Math.max(1, p - 1))}
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                borderWidth: 1.5,
                borderColor: palette.cardBorder,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <MinusIcon size={16} color={palette.textPrimary} />
            </Pressable>
            <Text
              style={{
                fontFamily: Fonts.displayBold,
                fontSize: 20,
                color: palette.textPrimary,
                width: 44,
                textAlign: 'center',
              }}>
              {pace}
            </Text>
            <Pressable
              onPress={() => setPace((p) => Math.min(20, p + 1))}
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                backgroundColor: palette.primary,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <PlusIcon size={16} color="#FFFFFF" />
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 }}>
            <ClockIcon size={14} color={palette.textSecondary} />
            <Text style={{ fontFamily: Fonts.body, fontSize: 12, color: palette.textSecondary }}>
              About {finish.days} days · finishes {finish.date}
            </Text>
          </View>
        </View>

        {/* Frequency */}
        <Text style={sectionLabel}>FREQUENCY</Text>
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: isDark ? palette.surface : palette.ringTrack,
            borderRadius: Layout.radiusPill,
            padding: 4,
          }}>
          {FREQUENCIES.map((f) => {
            const selected = frequency === f;
            return (
              <Pressable
                key={f}
                onPress={() => setFrequency(f)}
                style={{
                  flex: 1,
                  paddingVertical: 9,
                  borderRadius: Layout.radiusPill,
                  alignItems: 'center',
                  backgroundColor: selected ? (isDark ? palette.primary : palette.surface) : 'transparent',
                }}>
                <Text
                  style={{
                    fontFamily: selected ? Fonts.bodyBold : Fonts.body,
                    fontSize: 13,
                    color: selected ? (isDark ? '#FFFFFF' : palette.textPrimary) : palette.textSecondary,
                  }}>
                  {f}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Reminder */}
        <Text style={sectionLabel}>REMINDER</Text>
        <View style={[card, { paddingHorizontal: 14 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }}>
            <Text style={{ fontFamily: Fonts.display, fontSize: 15, color: palette.textPrimary, flex: 1 }}>
              Daily reminder
            </Text>
            <Switch
              value={reminder}
              onValueChange={setReminder}
              trackColor={{ true: palette.primary, false: palette.ringTrack }}
              thumbColor="#FFFFFF"
            />
          </View>
          <View style={{ height: 1, backgroundColor: palette.cardBorder }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14 }}>
            <Text style={{ fontFamily: Fonts.display, fontSize: 15, color: palette.textPrimary, flex: 1 }}>Time</Text>
            <Text style={{ fontFamily: Fonts.bodyBold, fontSize: 14, color: palette.primary }}>6:00 AM</Text>
          </View>
        </View>

        {/* Create */}
        <Pressable
          onPress={() => {
            Alert.alert(
              'Goal created',
              `${surah.name} · ${pace} verses/day · ${frequency}. (Saved locally — goal sync arrives with accounts.)`,
              [{ text: 'OK', onPress: () => router.back() }],
            );
          }}
          style={{
            marginTop: 26,
            backgroundColor: palette.primary,
            borderRadius: Layout.radiusButton,
            paddingVertical: 16,
            alignItems: 'center',
          }}>
          <Text style={{ fontFamily: Fonts.display, fontSize: 16, color: '#FFFFFF' }}>Create goal</Text>
        </Pressable>
      </Screen>

      {/* Surah picker */}
      <Modal visible={pickerOpen} animationType="slide" transparent onRequestClose={() => setPickerOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} onPress={() => setPickerOpen(false)} />
        <View
          style={{
            backgroundColor: palette.bg,
            borderTopLeftRadius: 26,
            borderTopRightRadius: 26,
            maxHeight: '70%',
            paddingTop: 14,
          }}>
          <Text
            style={{
              fontFamily: Fonts.display,
              fontSize: 18,
              color: palette.textPrimary,
              textAlign: 'center',
              marginBottom: 10,
            }}>
            Choose a surah
          </Text>
          <FlatList
            data={SURAHS}
            keyExtractor={(s) => String(s.number)}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  setSurahNo(item.number);
                  setPickerOpen(false);
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: Layout.screenPadding,
                  paddingVertical: 13,
                  borderBottomWidth: 1,
                  borderBottomColor: palette.cardBorder,
                  backgroundColor: item.number === surahNo ? palette.primaryTint : 'transparent',
                }}>
                <Text style={{ fontFamily: Fonts.bodySemiBold, fontSize: 13, color: palette.textSecondary, width: 34 }}>
                  {item.number}
                </Text>
                <Text style={{ fontFamily: Fonts.bodySemiBold, fontSize: 15, color: palette.textPrimary, flex: 1 }}>
                  {item.name}
                </Text>
                <Text style={{ fontFamily: Fonts.arabic, fontSize: 19, color: palette.primary }}>{item.arabic}</Text>
              </Pressable>
            )}
          />
        </View>
      </Modal>
    </View>
  );
}
