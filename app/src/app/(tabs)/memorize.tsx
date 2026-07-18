/**
 * Memorization Mode — the hero screen (design handoff §2).
 *
 * v1 is BATCH per CLAUDE.md §3: record → stop → server /analyze → per-word
 * verdicts. The design's real-time word-by-word reveal is Phase 3; this screen
 * keeps its exact visual language (hidden blur, emerald recited, red mistake,
 * gold current) but reveals results after analysis instead of live.
 */
import {
  AudioModule,
  AudioQuality,
  IOSOutputFormat,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioRecorder,
  type RecordingOptions,
} from 'expo-audio';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';

import {
  AlertCircleIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  EyeIcon,
  EyeOffIcon,
  MicIcon,
  SquareIcon,
} from '@/components/icons';
import { Screen } from '@/components/screen';
import { Fonts, Layout } from '@/constants/hujra';
import { useHujraTheme } from '@/hooks/use-hujra-theme';
import {
  analyzePartial,
  analyzeRecitation,
  postComplete,
  postPosition,
  type AnalyzeResponse,
} from '@/lib/api';
import { SURAHS, fetchTranslation, fetchVerseText, getSurah, toArabicIndic } from '@/lib/quran';
import { useSession } from '@/store/session';

type WordStatus = 'hidden' | 'current' | 'recited' | 'mistake' | 'neutral';
type MicState = 'idle' | 'recording' | 'processing';

const BISMILLAH = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ';
const WAVE_BARS = [14, 22, 30, 18, 26, 34, 22, 30, 16, 26, 20, 14];

// Follow-along needs a container that is decodable BEFORE the recording is
// finalized. m4a/mp4 is not (its index is written at stop), so: raw ADTS AAC
// on Android, uncompressed PCM WAV on iOS.
const FOLLOW_ALONG_RECORDING: RecordingOptions = {
  extension: Platform.OS === 'android' ? '.aac' : '.wav',
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 64000,
  android: {
    outputFormat: 'aac_adts',
    audioEncoder: 'aac',
  },
  ios: {
    outputFormat: IOSOutputFormat.LINEARPCM,
    audioQuality: AudioQuality.HIGH,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {
    mimeType: 'audio/webm',
    bitsPerSecond: 128000,
  },
};

// CPU reality: every partial poll is a full Whisper pass on the server.
// Poll gently so the FINAL analysis isn't starved by live previews.
const PARTIAL_POLL_MS = 5000;
const PARTIAL_FIRST_MS = 4000;

export default function MemorizeScreen() {
  const { palette, isDark } = useHujraTheme();
  const { progress, refresh } = useSession();

  const [surahNo, setSurahNo] = useState(1); // Al-Fatihah until progress loads
  const [ayah, setAyah] = useState(1);
  const resumedRef = useRef(false);
  const touchedRef = useRef(false);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [verseWords, setVerseWords] = useState<string[]>([]);
  const [translation, setTranslation] = useState<string | null>(null);
  const [verseError, setVerseError] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<WordStatus[]>([]);
  // Words are READABLE by default; the eye toggles hide-for-recall test mode.
  const [peek, setPeek] = useState(true);
  const [mic, setMic] = useState<MicState>('idle');
  const [summary, setSummary] = useState<string | null>(null);
  const [lastOk, setLastOk] = useState(false);
  const [celebrateOpen, setCelebrateOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [ayahPickerOpen, setAyahPickerOpen] = useState(false);

  const chime = useAudioPlayer(require('@/assets/sounds/celebration.wav'));
  const [retryNonce, setRetryNonce] = useState(0);

  const surah = getSurah(surahNo);
  const recorder = useAudioRecorder(FOLLOW_ALONG_RECORDING);
  const isCompleted = !!progress?.surahs.find((s) => s.surah === surahNo)?.completed;
  // This ayah was recited fully correctly at least once -> show it in green.
  const isMastered =
    isCompleted || !!progress?.mastered?.some((m) => m.surah === surahNo && m.ayah === ayah);

  // Resume where the user left off (from the DB) — once, and only if they
  // haven't already navigated somewhere themselves.
  useEffect(() => {
    if (resumedRef.current || touchedRef.current) return;
    const cont = progress?.continue;
    if (cont) {
      resumedRef.current = true;
      setSurahNo(cont.surah);
      setAyah(cont.ayah);
    }
  }, [progress]);

  // ---- verse loading ------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    setVerseWords([]);
    setTranslation(null);
    setVerseError(null);
    setSummary(null);
    setLastOk(false);
    // Verse text renders as soon as it arrives; the translation is fetched
    // independently and fills in later so it can never block the verse.
    fetchVerseText(surahNo, ayah)
      .then((text) => {
        if (cancelled) return;
        const words = text.split(/\s+/).filter(Boolean);
        setVerseWords(words);
        // Mastered ayahs (and completed surahs) open revealed in emerald;
        // everything else opens hidden — that's the memorization test.
        setStatuses(
          isMastered
            ? words.map(() => 'recited' as const)
            : words.map((_, i) => (i === 0 ? 'current' : 'hidden')),
        );
      })
      .catch(() => {
        if (!cancelled) setVerseError('Could not load the verse. Check your connection and retry.');
      });
    fetchTranslation(surahNo, ayah).then((t) => {
      if (!cancelled) setTranslation(t);
    });
    return () => {
      cancelled = true;
    };
  }, [surahNo, ayah, retryNonce, isMastered]);

  // Keep "continue where you left off" in sync with navigation (debounced).
  useEffect(() => {
    if (!touchedRef.current && !resumedRef.current) return;
    const timer = setTimeout(() => {
      postPosition(surahNo, ayah).catch(() => {});
    }, 800);
    return () => clearTimeout(timer);
  }, [surahNo, ayah]);

  // Map a server report onto per-word display states. In partial mode the
  // first not-yet-reached word gets the gold "current" highlight.
  const applyReport = useCallback(
    (result: AnalyzeResponse, partial: boolean) => {
      const expectedSide = result.report.filter((r) => r.verdict !== 'EXTRA');
      const next: WordStatus[] = verseWords.map((_, i) => {
        const v = expectedSide[i]?.verdict;
        if (v === 'OK') return 'recited';
        if (v === 'WRONG' || v === 'MISSING') return 'mistake';
        if (v === 'PENDING') return 'hidden';
        return partial ? 'hidden' : 'neutral';
      });
      if (partial) {
        const idx = next.indexOf('hidden');
        if (idx >= 0) next[idx] = 'current';
      }
      setStatuses(next);
    },
    [verseWords],
  );

  const resetAyah = useCallback((nextAyah: number, nextSurah?: number) => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    touchedRef.current = true;
    if (nextSurah) setSurahNo(nextSurah);
    setAyah(nextAyah);
  }, []);

  const completeSurah = useCallback(async () => {
    setCelebrateOpen(true);
    postComplete(surahNo, surah.ayahCount)
      .then(() => refresh())
      .catch(() => {}); // celebration first; persistence retries on next sync
    try {
      // Recording audio mode can mute playback on iOS; switch back first.
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      chime.seekTo(0);
      chime.play();
    } catch {
      // the celebration must never crash over a sound
    }
  }, [chime, surahNo, surah.ayahCount, refresh]);

  // ---- recording ----------------------------------------------------------
  const startRecording = useCallback(async () => {
    const perm = await AudioModule.requestRecordingPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Microphone needed', 'Hujra needs microphone access to hear your recitation.');
      return;
    }
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    setSummary(null);
    // Re-testing a completed surah hides the words again for the duration.
    setStatuses(verseWords.map((_, i) => (i === 0 ? 'current' : 'hidden')));
    setMic('recording');
  }, [recorder, verseWords]);

  const stopAndAnalyze = useCallback(async () => {
    pollSeq.current += 1; // invalidate any in-flight partial poll
    setMic('processing');
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) throw new Error('recording produced no file');

      const result = await analyzeRecitation(surahNo, ayah, uri);
      refresh(); // backend persisted the attempt; pull fresh progress/mistakes

      const expectedSide = result.report.filter((r) => r.verdict !== 'EXTRA');
      const extras = result.report.length - expectedSide.length;
      applyReport(result, false);
      const ok = expectedSide.filter((r) => r.verdict === 'OK').length;
      const mistakes = expectedSide.length - ok;
      setLastOk(mistakes === 0);
      setSummary(
        mistakes === 0
          ? extras > 0
            ? `All ${ok} words correct — ${extras} extra word${extras > 1 ? 's' : ''} recited.`
            : `Perfect — all ${ok} words correct. Mā shāʾ Allāh!`
          : `${ok}/${expectedSide.length} words correct · ${mistakes} to review`,
      );

      if (mistakes === 0) {
        if (ayah === surah.ayahCount) {
          // Last ayah recited correctly -> surah done: celebrate immediately.
          completeSurah();
        } else {
          // Give the reciter a moment to see the green, then move on.
          if (advanceTimer.current) clearTimeout(advanceTimer.current);
          advanceTimer.current = setTimeout(() => resetAyah(ayah + 1), 1600);
        }
      }
    } catch (e) {
      Alert.alert('Analysis failed', e instanceof Error ? e.message : 'Could not reach the server.');
      setStatuses(verseWords.map((_, i) => (i === 0 ? 'current' : 'hidden')));
    } finally {
      setMic('idle');
    }
  }, [recorder, surahNo, ayah, surah.ayahCount, verseWords, refresh, applyReport, completeSurah, resetAyah]);

  // ---- follow-along: poll partial analysis while recording ----------------
  const pollSeq = useRef(0);
  const pollBusy = useRef(false);

  useEffect(() => {
    if (mic !== 'recording') return;
    const seq = ++pollSeq.current;
    let stopped = false;

    const tick = async () => {
      if (stopped || pollBusy.current) return;
      const uri = recorder.uri;
      if (!uri) return;
      pollBusy.current = true;
      try {
        const result = await analyzePartial(surahNo, ayah, uri);
        if (!stopped && pollSeq.current === seq) applyReport(result, true);
      } catch {
        // polls are best-effort; the final analysis is authoritative
      } finally {
        pollBusy.current = false;
      }
    };

    const first = setTimeout(tick, PARTIAL_FIRST_MS);
    const interval = setInterval(tick, PARTIAL_POLL_MS);
    return () => {
      stopped = true;
      clearTimeout(first);
      clearInterval(interval);
    };
  }, [mic, recorder, surahNo, ayah, applyReport]);

  // ---- animations (pulse rings, waveform, dots) ---------------------------
  const pulseA = useRef(new Animated.Value(0)).current;
  const pulseB = useRef(new Animated.Value(0)).current;
  const wave = useRef(WAVE_BARS.map(() => new Animated.Value(0.3))).current;
  const dots = useRef([0, 1, 2].map(() => new Animated.Value(0.25))).current;

  useEffect(() => {
    if (mic !== 'recording') return;
    const pulse = (v: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(v, { toValue: 1, duration: 2600, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      );
    const waves = wave.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 70),
          Animated.timing(v, { toValue: 1, duration: 450, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(v, { toValue: 0.3, duration: 450, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
      ),
    );
    const dotAnims = dots.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 200),
          Animated.timing(v, { toValue: 1, duration: 600, useNativeDriver: true }),
          Animated.timing(v, { toValue: 0.25, duration: 600, useNativeDriver: true }),
        ]),
      ),
    );
    const all = [pulse(pulseA, 0), pulse(pulseB, 1300), ...waves, ...dotAnims];
    all.forEach((a) => a.start());
    return () => all.forEach((a) => a.stop());
  }, [mic, pulseA, pulseB, wave, dots]);

  // ---- word rendering -----------------------------------------------------
  // Completed surah + not actively re-testing = clean review mode: every word
  // plain emerald, NO chips/pills/underlines. Live word states (gold current
  // chip, hidden pills, red mistakes) belong to an active recitation only.
  const reviewMode = isMastered && mic === 'idle' && !summary;

  const wordEls = useMemo(() => {
    return verseWords.map((w, i) => {
      const status = reviewMode ? 'recited' : (statuses[i] ?? 'neutral');
      const base = {
        fontFamily: Fonts.arabic,
        fontSize: 33,
        lineHeight: 74,
        color: palette.textPrimary,
      } as const;

      if (status === 'recited') {
        return (
          <Text key={i} style={[base, { color: palette.primary }]}>
            {w}{' '}
          </Text>
        );
      }
      if (status === 'mistake') {
        return (
          <Text
            key={i}
            style={[
              base,
              {
                color: palette.error,
                textDecorationLine: 'underline',
                textDecorationColor: palette.error,
              },
            ]}>
            {w}{' '}
          </Text>
        );
      }
      if (status === 'current') {
        return (
          <Text key={i}>
            <View
              style={{
                backgroundColor: palette.goldWordTint,
                borderRadius: Layout.radiusChip,
                borderWidth: 1.5,
                borderColor: palette.goldLine,
                paddingHorizontal: 8,
                paddingVertical: 1,
              }}>
              {/* lineHeight must fit Amiri's tall marks or glyphs clip */}
              <Text style={[base, { lineHeight: 60 }]}>{w}</Text>
            </View>
            <Text style={base}> </Text>
          </Text>
        );
      }
      if (status === 'hidden' && !peek) {
        // RN's blur filter does not apply to Text on iOS OR Android — only
        // web renders it. Native platforms mask the glyphs behind a soft
        // pill (transparent text keeps correct word width/flow).
        if (Platform.OS === 'web') {
          return (
            <Text key={i} style={[base, { color: palette.hiddenWord, opacity: 0.55, filter: 'blur(6px)' as never }]}>
              {w}{' '}
            </Text>
          );
        }
        return (
          <Text key={i}>
            <View
              style={{
                backgroundColor: palette.hiddenWord,
                opacity: 0.35,
                borderRadius: 8,
                paddingHorizontal: 6,
              }}>
              {/* opacity 0, NOT color:'transparent' — Android still draws
                  transparent-colored glyphs with some fonts. */}
              <Text style={[base, { lineHeight: 60, opacity: 0 }]}>{w}</Text>
            </View>
            <Text style={base}> </Text>
          </Text>
        );
      }
      // Peeked hidden words reveal in full ink so the eye toggle is obvious.
      return (
        <Text key={i} style={base}>
          {w}{' '}
        </Text>
      );
    });
  }, [verseWords, statuses, peek, palette, reviewMode]);

  const headerCircle = {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.cardBorder,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  };

  const legend = [
    { label: 'Recited', color: palette.primary },
    { label: 'Listening', color: palette.gold },
    { label: 'Mistake', color: palette.error },
    { label: 'Hidden', color: palette.hiddenWord },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <Screen scroll={false} padded={false}>
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: Layout.screenPadding,
            paddingTop: 10,
          }}>
          <Pressable style={headerCircle} onPress={() => resetAyah(Math.max(1, ayah - 1))}>
            <ChevronLeftIcon size={20} color={palette.textPrimary} />
          </Pressable>
          <Pressable style={{ flex: 1, alignItems: 'center' }} onPress={() => setPickerOpen(true)}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={{ fontFamily: Fonts.display, fontSize: 17, color: palette.textPrimary }}>
                {surah.name}
              </Text>
              <ChevronDownIcon size={15} color={palette.textSecondary} />
            </View>
            <Text
              style={{
                fontFamily: Fonts.body,
                fontSize: 12,
                color: isCompleted ? palette.gold : palette.textSecondary,
              }}>
              {isCompleted ? '✓ Completed' : 'Memorize'} · Ayah {ayah}
            </Text>
          </Pressable>
          <Pressable style={headerCircle} onPress={() => setPeek((v) => !v)}>
            {peek ? (
              <EyeIcon size={19} color={palette.textPrimary} />
            ) : (
              <EyeOffIcon size={19} color={palette.gold} />
            )}
          </Pressable>
        </View>

        {/* Ayah progress */}
        <View style={{ paddingHorizontal: Layout.screenPadding, marginTop: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
            <Pressable
              onPress={() => setAyahPickerOpen(true)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 }}>
              <Text style={{ fontFamily: Fonts.bodySemiBold, fontSize: 11.5, color: palette.textSecondary }}>
                Ayah {ayah} / {surah.ayahCount}
              </Text>
              <ChevronDownIcon size={12} color={palette.textSecondary} />
            </Pressable>
            {/* Always-available ayah navigation (review mode has no result pill) */}
            {[
              { key: 'prev', disabled: ayah <= 1, Icon: ChevronLeftIcon, go: () => resetAyah(ayah - 1) },
              { key: 'next', disabled: ayah >= surah.ayahCount, Icon: ChevronRightIcon, go: () => resetAyah(ayah + 1) },
            ].map((b) => (
              <Pressable
                key={b.key}
                disabled={b.disabled}
                onPress={b.go}
                hitSlop={8}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  marginLeft: 8,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: palette.surface,
                  borderWidth: 1,
                  borderColor: palette.cardBorder,
                  opacity: b.disabled ? 0.35 : 1,
                }}>
                <b.Icon size={15} color={palette.textPrimary} />
              </Pressable>
            ))}
            <Text style={{ fontFamily: Fonts.bodySemiBold, fontSize: 11.5, color: palette.textSecondary, marginLeft: 10 }}>
              {Math.round((ayah / surah.ayahCount) * 100)}%
            </Text>
          </View>
          <View style={{ height: 4, borderRadius: 2, backgroundColor: palette.ringTrack, overflow: 'hidden' }}>
            <View
              style={{
                width: `${(ayah / surah.ayahCount) * 100}%`,
                height: '100%',
                backgroundColor: palette.primary,
                borderRadius: 2,
              }}
            />
          </View>
        </View>

        {/* Mushaf verse card */}
        <View style={{ flex: 1, paddingHorizontal: Layout.screenPadding }}>
          <View
            style={{
              marginTop: 14,
              backgroundColor: palette.mushafSurface,
              borderRadius: Layout.radiusVerseCard,
              borderWidth: 1,
              borderColor: palette.mushafBorder,
              padding: 20,
              flex: 1,
            }}>
            {/* Long ayahs (e.g. 2:282) far exceed the card height — the card
                frame stays fixed and its content scrolls, per the design. */}
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 6 }}>
            <Text
              style={{
                fontFamily: Fonts.bodyBold,
                fontSize: 10.5,
                letterSpacing: 1.2,
                color: palette.gold,
                textAlign: 'center',
              }}>
              SURAH {surah.name.toUpperCase()}
            </Text>
            <Text
              style={{
                fontFamily: Fonts.arabic,
                fontSize: 25,
                color: palette.primary,
                textAlign: 'center',
                marginTop: 3,
                writingDirection: 'rtl',
              }}>
              سُورَةُ {surah.arabic}
            </Text>
            <View
              style={{
                height: 1,
                backgroundColor: palette.goldLineSoft,
                marginVertical: 12,
                marginHorizontal: 30,
              }}
            />
            {ayah === 1 && surahNo !== 1 && surahNo !== 9 ? (
              <Text
                style={{
                  fontFamily: Fonts.arabic,
                  fontSize: 23,
                  color: palette.bismillah,
                  textAlign: 'center',
                  marginBottom: 6,
                  writingDirection: 'rtl',
                }}>
                {BISMILLAH}
              </Text>
            ) : null}

            {verseError ? (
              <View style={{ alignItems: 'center', marginTop: 30, gap: 12 }}>
                <Text style={{ fontFamily: Fonts.body, fontSize: 13.5, color: palette.error, textAlign: 'center' }}>
                  {verseError}
                </Text>
                <Pressable
                  onPress={() => setRetryNonce((n) => n + 1)}
                  style={{
                    backgroundColor: palette.primaryTint,
                    borderRadius: Layout.radiusButton,
                    paddingHorizontal: 18,
                    paddingVertical: 10,
                  }}>
                  <Text style={{ fontFamily: Fonts.bodyBold, fontSize: 13, color: palette.primary }}>Retry</Text>
                </Pressable>
              </View>
            ) : verseWords.length === 0 ? (
              <ActivityIndicator color={palette.primary} style={{ marginTop: 30 }} />
            ) : (
              <Text style={{ textAlign: 'center', writingDirection: 'rtl', marginTop: 8 }}>
                {wordEls}
                {/* NBSP+RLM bind the ornament to the last word so it renders
                    at the ayah's true end (visual left) and never wraps alone. */}
                <Text style={{ fontFamily: Fonts.arabic, fontSize: 26, lineHeight: 74, color: palette.gold }}>
                  {' ‏﴿' + toArabicIndic(ayah) + '﴾‏'}
                </Text>
              </Text>
            )}

            {translation ? (
              <Text
                style={{
                  fontFamily: Fonts.bodyRegular,
                  fontStyle: 'italic',
                  fontSize: 13,
                  lineHeight: 20,
                  color: palette.textSecondary,
                  textAlign: 'center',
                  marginTop: 14,
                  maxWidth: 300,
                  alignSelf: 'center',
                }}>
                “{translation}”
              </Text>
            ) : null}

            {summary && lastOk ? (
              <Text
                style={{
                  fontFamily: Fonts.bodyBold,
                  fontSize: 13.5,
                  color: palette.primary,
                  textAlign: 'center',
                  marginTop: 14,
                }}>
                {summary}
              </Text>
            ) : null}

            {summary && !lastOk ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  backgroundColor: palette.errorTint,
                  borderRadius: 14,
                  padding: 13,
                  marginTop: 14,
                }}>
                <AlertCircleIcon size={19} color={palette.error} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: Fonts.bodyBold, fontSize: 13, color: palette.error }}>
                    Some words need another try
                  </Text>
                  <Text style={{ fontFamily: Fonts.body, fontSize: 12, color: palette.error, marginTop: 2 }}>
                    {summary} — the red words are the ones to fix. Tap the mic to retry.
                  </Text>
                </View>
              </View>
            ) : null}

            {summary && ayah < surah.ayahCount ? (
              <Pressable
                onPress={() => resetAyah(ayah + 1)}
                style={{
                  alignSelf: 'center',
                  marginTop: 10,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  backgroundColor: palette.primaryTint,
                  borderRadius: Layout.radiusPill,
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                }}>
                <Text style={{ fontFamily: Fonts.bodyBold, fontSize: 13, color: palette.primary }}>Next ayah</Text>
                <ChevronRightIcon size={15} color={palette.primary} />
              </Pressable>
            ) : null}

            {summary && lastOk && ayah === surah.ayahCount ? (
              <Pressable
                onPress={completeSurah}
                style={{
                  alignSelf: 'center',
                  marginTop: 12,
                  backgroundColor: palette.primary,
                  borderRadius: Layout.radiusButton,
                  paddingHorizontal: 22,
                  paddingVertical: 13,
                }}>
                <Text style={{ fontFamily: Fonts.display, fontSize: 15, color: '#FFFFFF' }}>
                  Complete Surah {surah.name}
                </Text>
              </Pressable>
            ) : null}
            </ScrollView>
          </View>

          {/* Legend */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 16,
              marginTop: 12,
              marginBottom: 148,
            }}>
            {legend.map((l) => (
              <View key={l.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: l.color }} />
                <Text style={{ fontFamily: Fonts.body, fontSize: 11.5, color: palette.textSecondary }}>{l.label}</Text>
              </View>
            ))}
          </View>
        </View>
      </Screen>

      {/* Floating mic cluster */}
      <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 26, alignItems: 'center' }}>
        {mic === 'recording' ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              backgroundColor: palette.surface,
              borderColor: palette.cardBorder,
              borderWidth: 1,
              borderRadius: Layout.radiusPill,
              paddingHorizontal: 14,
              paddingVertical: 7,
              marginBottom: 10,
            }}>
            <Text style={{ fontFamily: Fonts.bodySemiBold, fontSize: 12.5, color: palette.textPrimary }}>Listening</Text>
            {dots.map((v, i) => (
              <Animated.View
                key={i}
                style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: palette.primary, opacity: v }}
              />
            ))}
          </View>
        ) : null}

        {mic === 'recording' ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, height: 36, marginBottom: 10 }}>
            {WAVE_BARS.map((h, i) => (
              <Animated.View
                key={i}
                style={{
                  width: 3,
                  height: h,
                  borderRadius: 2,
                  backgroundColor: i % 4 === 2 ? palette.primaryLight : palette.primary,
                  transform: [{ scaleY: wave[i] }],
                }}
              />
            ))}
          </View>
        ) : null}

        <View style={{ width: 84, height: 84, alignItems: 'center', justifyContent: 'center' }}>
          {mic === 'recording'
            ? [pulseA, pulseB].map((v, i) => (
                <Animated.View
                  key={i}
                  style={{
                    position: 'absolute',
                    width: 84,
                    height: 84,
                    borderRadius: 42,
                    backgroundColor: palette.primary,
                    opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] }),
                    transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.85, 2] }) }],
                  }}
                />
              ))
            : null}
          <Pressable
            disabled={mic === 'processing' || verseWords.length === 0}
            onPress={mic === 'recording' ? stopAndAnalyze : startRecording}
            style={{
              width: 84,
              height: 84,
              borderRadius: 42,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: mic === 'recording' ? palette.error : isDark ? palette.primaryLight : palette.primary,
              shadowColor: palette.primary,
              shadowOpacity: 0.55,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 10 },
              elevation: 10,
              opacity: mic === 'processing' ? 0.7 : 1,
            }}>
            {mic === 'processing' ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : mic === 'recording' ? (
              <SquareIcon size={26} color="#FFFFFF" filled />
            ) : (
              <MicIcon size={30} color="#FFFFFF" strokeWidth={2} />
            )}
          </Pressable>
        </View>
        {mic === 'processing' ? (
          <Text style={{ fontFamily: Fonts.body, fontSize: 12, color: palette.textSecondary, marginTop: 8 }}>
            Checking your recitation…
          </Text>
        ) : null}
      </View>

      {/* Ayah jump picker */}
      <Modal visible={ayahPickerOpen} animationType="slide" transparent onRequestClose={() => setAyahPickerOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} onPress={() => setAyahPickerOpen(false)} />
        <View
          style={{
            backgroundColor: palette.bg,
            borderTopLeftRadius: 26,
            borderTopRightRadius: 26,
            maxHeight: '60%',
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
            Jump to ayah · {surah.name}
          </Text>
          <FlatList
            data={Array.from({ length: surah.ayahCount }, (_, i) => i + 1)}
            keyExtractor={(n) => String(n)}
            numColumns={6}
            contentContainerStyle={{ paddingHorizontal: Layout.screenPadding, paddingBottom: 24 }}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  setAyahPickerOpen(false);
                  resetAyah(item);
                }}
                style={{
                  flex: 1,
                  margin: 4,
                  aspectRatio: 1.3,
                  borderRadius: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: item === ayah ? palette.primary : palette.surface,
                  borderWidth: 1,
                  borderColor: item === ayah ? palette.primary : palette.cardBorder,
                }}>
                <Text
                  style={{
                    fontFamily: Fonts.bodySemiBold,
                    fontSize: 14,
                    color: item === ayah ? '#FFFFFF' : palette.textPrimary,
                  }}>
                  {item}
                </Text>
              </Pressable>
            )}
          />
        </View>
      </Modal>

      {/* Surah completion celebration */}
      <Modal visible={celebrateOpen} animationType="fade" transparent onRequestClose={() => setCelebrateOpen(false)}>
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(13,23,20,0.72)',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 30,
          }}>
          <View
            style={{
              width: '100%',
              backgroundColor: palette.mushafSurface,
              borderRadius: Layout.radiusVerseCard,
              borderWidth: 1.5,
              borderColor: palette.goldLine,
              padding: 28,
              alignItems: 'center',
            }}>
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: palette.goldTint,
                borderWidth: 1.5,
                borderColor: palette.goldLine,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <CheckIcon size={30} color={palette.gold} strokeWidth={2.2} />
            </View>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              style={{
                fontFamily: Fonts.arabic,
                fontSize: 30,
                lineHeight: 58,
                color: palette.primary,
                marginTop: 16,
                writingDirection: 'rtl',
                textAlign: 'center',
                width: '100%',
              }}>
              مَا شَاءَ ٱللَّهُ
            </Text>
            <Text style={{ fontFamily: Fonts.display, fontSize: 20, color: palette.textPrimary, marginTop: 8 }}>
              Congratulations!
            </Text>
            <Text
              style={{
                fontFamily: Fonts.body,
                fontSize: 13.5,
                color: palette.textSecondary,
                textAlign: 'center',
                marginTop: 6,
                lineHeight: 20,
              }}>
              You completed Surah {surah.name} ({surah.arabic}) — all {surah.ayahCount} ayahs. May it stay
              with you.
            </Text>
            <Pressable
              onPress={() => {
                setCelebrateOpen(false);
                // After An-Nas (114) the journey wraps back to Al-Fatihah.
                resetAyah(1, surahNo < 114 ? surahNo + 1 : 1);
              }}
              style={{
                marginTop: 20,
                alignSelf: 'stretch',
                backgroundColor: palette.primary,
                borderRadius: Layout.radiusButton,
                paddingVertical: 14,
                alignItems: 'center',
              }}>
              <Text style={{ fontFamily: Fonts.display, fontSize: 15, color: '#FFFFFF' }}>
                {surahNo < 114
                  ? `Next surah · ${getSurah(surahNo + 1).name}`
                  : 'Start again · Al-Fatihah'}
              </Text>
            </Pressable>
            <Pressable onPress={() => setCelebrateOpen(false)} style={{ marginTop: 12, padding: 6 }}>
              <Text style={{ fontFamily: Fonts.bodySemiBold, fontSize: 13, color: palette.textSecondary }}>
                Stay here
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Surah / ayah picker */}
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
                  setPickerOpen(false);
                  resetAyah(1, item.number);
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
                <Text style={{ fontFamily: Fonts.body, fontSize: 12, color: palette.textTertiary, marginLeft: 10 }}>
                  {item.ayahCount}
                </Text>
              </Pressable>
            )}
          />
        </View>
      </Modal>
    </View>
  );
}
