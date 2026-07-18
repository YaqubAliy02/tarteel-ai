/**
 * Listen — full-surah recitations by Mishary Rashid Alafasy.
 * Files are downloaded with visible progress, cached on-device, then played —
 * a replay starts instantly and works offline.
 */
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChevronLeftIcon, HeadphonesIcon, PlayIcon, SquareIcon } from '@/components/icons';
import { Fonts, Layout } from '@/constants/hujra';
import { useHujraTheme } from '@/hooks/use-hujra-theme';
import { SURAHS, alafasySurahAudioUrl, getSurah } from '@/lib/quran';

function fmt(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function ListenScreen() {
  const { palette } = useHujraTheme();
  const insets = useSafeAreaInsets();

  const player = useAudioPlayer();
  const status = useAudioPlayerStatus(player);
  const [current, setCurrent] = useState<number | null>(null);
  const [downloadPct, setDownloadPct] = useState<number | null>(null);
  const loadSeq = useRef(0); // ignores progress/results of an abandoned pick

  const playSurah = async (n: number) => {
    const seq = ++loadSeq.current;
    setCurrent(n);
    setDownloadPct(null);
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });

    const dest = `${FileSystem.cacheDirectory}alafasy_${n}.mp3`;
    const partial = `${dest}.part`;
    try {
      const info = await FileSystem.getInfoAsync(dest);
      if (!info.exists) {
        setDownloadPct(0);
        const download = FileSystem.createDownloadResumable(
          alafasySurahAudioUrl(n),
          partial,
          {},
          (p) => {
            if (loadSeq.current === seq && p.totalBytesExpectedToWrite > 0) {
              setDownloadPct(
                Math.min(100, Math.round((p.totalBytesWritten / p.totalBytesExpectedToWrite) * 100)),
              );
            }
          },
        );
        const result = await download.downloadAsync();
        if (!result) throw new Error('download interrupted');
        // Only a fully downloaded file is moved into the cache slot, so a
        // dropped connection never leaves a broken "cached" recitation.
        await FileSystem.moveAsync({ from: partial, to: dest });
      }
      if (loadSeq.current !== seq) return; // user tapped another surah meanwhile
      setDownloadPct(null);
      player.replace({ uri: dest });
      player.play();
    } catch {
      FileSystem.deleteAsync(partial, { idempotent: true }).catch(() => {});
      if (loadSeq.current === seq) {
        setDownloadPct(null);
        setCurrent(null);
        Alert.alert('Download failed', 'Could not download the recitation. Check your connection and try again.');
      }
    }
  };

  const togglePlay = () => {
    if (status.playing) player.pause();
    else player.play();
  };

  const currentSurah = current ? getSurah(current) : null;

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg, paddingTop: insets.top }}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: Layout.screenPadding,
          paddingTop: 10,
          gap: 12,
        }}>
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
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: Fonts.display, fontSize: 20, color: palette.textPrimary }}>Listen</Text>
          <Text style={{ fontFamily: Fonts.body, fontSize: 12, color: palette.textSecondary }}>
            Mishary Rashid Alafasy
          </Text>
        </View>
      </View>

      {/* Now playing */}
      {currentSurah ? (
        <View
          style={{
            marginHorizontal: Layout.screenPadding,
            marginTop: 14,
            backgroundColor: palette.primary,
            borderRadius: Layout.radiusCard,
            padding: 16,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14,
          }}>
          <Pressable
            onPress={togglePlay}
            disabled={downloadPct !== null}
            style={{
              width: 52,
              height: 52,
              borderRadius: 26,
              backgroundColor: '#FBF5E6',
              alignItems: 'center',
              justifyContent: 'center',
              paddingLeft: downloadPct === null && !status.playing ? 3 : 0,
            }}>
            {downloadPct !== null ? (
              <Text style={{ fontFamily: Fonts.displayBold, fontSize: 13, color: palette.primary }}>
                {downloadPct}%
              </Text>
            ) : status.playing ? (
              <SquareIcon size={20} color={palette.primary} filled />
            ) : (
              <PlayIcon size={20} color={palette.primary} filled />
            )}
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: Fonts.display, fontSize: 17, color: '#FFFFFF' }}>
              {currentSurah.name}
            </Text>
            <Text style={{ fontFamily: Fonts.body, fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>
              {downloadPct !== null
                ? `Downloading recitation · ${downloadPct}%`
                : `${fmt(status.currentTime)} / ${fmt(status.duration)}`}
            </Text>
            <View
              style={{
                height: 4,
                borderRadius: 2,
                backgroundColor: 'rgba(255,255,255,0.25)',
                marginTop: 8,
                overflow: 'hidden',
              }}>
              <View
                style={{
                  width: `${
                    downloadPct !== null
                      ? downloadPct
                      : status.duration > 0
                        ? Math.min(100, (status.currentTime / status.duration) * 100)
                        : 0
                  }%`,
                  height: '100%',
                  backgroundColor: downloadPct !== null ? 'rgba(255,255,255,0.85)' : palette.gold,
                }}
              />
            </View>
          </View>
          <Text style={{ fontFamily: Fonts.arabic, fontSize: 24, color: 'rgba(255,255,255,0.85)' }}>
            {currentSurah.arabic}
          </Text>
        </View>
      ) : (
        <View
          style={{
            marginHorizontal: Layout.screenPadding,
            marginTop: 14,
            backgroundColor: palette.surface,
            borderWidth: 1,
            borderColor: palette.cardBorder,
            borderRadius: Layout.radiusCard,
            padding: 16,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
          }}>
          <HeadphonesIcon size={22} color={palette.primary} />
          <Text style={{ fontFamily: Fonts.body, fontSize: 13, color: palette.textSecondary, flex: 1 }}>
            Pick a surah to stream the recitation.
          </Text>
        </View>
      )}

      {/* Surah list */}
      <FlatList
        data={SURAHS}
        keyExtractor={(s) => String(s.number)}
        contentContainerStyle={{ paddingBottom: 30, paddingTop: 10 }}
        renderItem={({ item }) => {
          const active = item.number === current;
          return (
            <Pressable
              onPress={() => playSurah(item.number)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: Layout.screenPadding,
                paddingVertical: 13,
                borderBottomWidth: 1,
                borderBottomColor: palette.cardBorder,
                backgroundColor: active ? palette.primaryTint : 'transparent',
              }}>
              <Text style={{ fontFamily: Fonts.bodySemiBold, fontSize: 13, color: palette.textSecondary, width: 34 }}>
                {item.number}
              </Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: Fonts.bodySemiBold, fontSize: 15, color: palette.textPrimary }}>
                  {item.name}
                </Text>
                <Text style={{ fontFamily: Fonts.body, fontSize: 11.5, color: palette.textTertiary }}>
                  {item.ayahCount} ayahs
                </Text>
              </View>
              <Text style={{ fontFamily: Fonts.arabic, fontSize: 19, color: palette.primary, marginRight: 12 }}>
                {item.arabic}
              </Text>
              <View
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 15,
                  backgroundColor: active ? palette.primary : palette.primaryTint,
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingLeft: active && status.playing ? 0 : 2,
                }}>
                {active && downloadPct !== null ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : active && status.playing ? (
                  <SquareIcon size={12} color="#FFFFFF" filled />
                ) : (
                  <PlayIcon size={12} color={active ? '#FFFFFF' : palette.primary} filled />
                )}
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}
