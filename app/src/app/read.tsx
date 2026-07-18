/**
 * Read — Mushaf book-page reader (Madani layout, 604 pages).
 * One physical page at a time, dense Uthmani text like a printed mushaf,
 * with download progress and on-device page caching.
 */
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { FlatList, Modal, PanResponder, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from '@/components/icons';
import { Fonts, Layout } from '@/constants/hujra';
import { useHujraTheme } from '@/hooks/use-hujra-theme';
import {
  MUSHAF_PAGES,
  SURAHS,
  fetchMushafPage,
  getSurah,
  getSurahStartPage,
  toArabicIndic,
  type MushafVerse,
} from '@/lib/quran';

const BISMILLAH = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ';

// Remember where the reader was during this app session.
let lastReadPage = 1;

export default function ReadScreen() {
  const { palette } = useHujraTheme();
  const insets = useSafeAreaInsets();

  const [page, setPage] = useState(lastReadPage);
  const [verses, setVerses] = useState<MushafVerse[]>([]);
  const [downloadPct, setDownloadPct] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    lastReadPage = page;
    setVerses([]);
    setError(null);
    setDownloadPct(null);
    fetchMushafPage(page, (pct) => {
      if (!cancelled) setDownloadPct(pct);
    })
      .then((v) => {
        if (cancelled) return;
        setDownloadPct(null);
        setVerses(v);
      })
      .catch(() => {
        if (cancelled) return;
        setDownloadPct(null);
        setError('Could not load this page. Check your connection and retry.');
      });
    return () => {
      cancelled = true;
    };
  }, [page, retryNonce]);

  // Arabic book direction: the mushaf opens right-to-left, so swiping the
  // finger RIGHT turns to the NEXT page (it slides in from the left), and
  // swiping LEFT goes back. Vertical scrolling stays untouched.
  const swipe = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 24 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderRelease: (_, g) => {
        if (g.dx > 50) setPage((p) => Math.min(MUSHAF_PAGES, p + 1));
        else if (g.dx < -50) setPage((p) => Math.max(1, p - 1));
      },
    }),
  ).current;

  const jumpToSurah = async (n: number) => {
    setPickerOpen(false);
    try {
      setPage(await getSurahStartPage(n));
    } catch {
      setError('Could not look up that surah. Check your connection and retry.');
    }
  };

  const pageSurahs = [...new Set(verses.map((v) => v.surah))];
  const headerTitle = pageSurahs.length
    ? pageSurahs.map((s) => getSurah(s).name).join(' · ')
    : `Page ${page}`;

  const circle = {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.cardBorder,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  };

  // Group consecutive verses by surah so surah transitions get a name plate.
  const groups: { surah: number; verses: MushafVerse[] }[] = [];
  for (const v of verses) {
    const last = groups[groups.length - 1];
    if (last && last.surah === v.surah) last.verses.push(v);
    else groups.push({ surah: v.surah, verses: [v] });
  }

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg, paddingTop: insets.top }}>
      {/* Header: back | title+picker | page prev/next (book order: next = left) */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: Layout.screenPadding,
          paddingTop: 10,
          gap: 8,
        }}>
        <Pressable style={circle} onPress={() => router.back()}>
          <ChevronLeftIcon size={20} color={palette.textPrimary} />
        </Pressable>
        <Pressable style={{ flex: 1, alignItems: 'center' }} onPress={() => setPickerOpen(true)}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text
              numberOfLines={1}
              style={{ fontFamily: Fonts.display, fontSize: 16, color: palette.textPrimary }}>
              {headerTitle}
            </Text>
            <ChevronDownIcon size={14} color={palette.textSecondary} />
          </View>
          <Text style={{ fontFamily: Fonts.body, fontSize: 12, color: palette.textSecondary }}>
            Page {page} / {MUSHAF_PAGES}
          </Text>
        </Pressable>
        <Pressable
          style={[circle, { opacity: page <= 1 ? 0.35 : 1 }]}
          disabled={page <= 1}
          onPress={() => setPage((p) => p - 1)}>
          <ChevronLeftIcon size={18} color={palette.textPrimary} />
        </Pressable>
        <Pressable
          style={[circle, { opacity: page >= MUSHAF_PAGES ? 0.35 : 1 }]}
          disabled={page >= MUSHAF_PAGES}
          onPress={() => setPage((p) => p + 1)}>
          <ChevronRightIcon size={18} color={palette.textPrimary} />
        </Pressable>
      </View>

      {/* The book page */}
      <ScrollView
        {...swipe.panHandlers}
        contentContainerStyle={{ padding: Layout.screenPadding, paddingBottom: 34 }}
        showsVerticalScrollIndicator={false}>
        <View
          style={{
            backgroundColor: palette.mushafSurface,
            borderRadius: 18,
            borderWidth: 1.5,
            borderColor: palette.goldLineSoft,
            paddingVertical: 18,
            paddingHorizontal: 16,
            minHeight: 420,
          }}>
          {downloadPct !== null ? (
            <View style={{ alignItems: 'center', marginTop: 60, gap: 12 }}>
              <Text style={{ fontFamily: Fonts.displayBold, fontSize: 26, color: palette.primary }}>
                {downloadPct}%
              </Text>
              <View style={{ width: 180, height: 5, borderRadius: 3, backgroundColor: palette.ringTrack, overflow: 'hidden' }}>
                <View style={{ width: `${downloadPct}%`, height: '100%', backgroundColor: palette.gold }} />
              </View>
              <Text style={{ fontFamily: Fonts.body, fontSize: 12.5, color: palette.textSecondary }}>
                Downloading page {page}…
              </Text>
            </View>
          ) : error ? (
            <View style={{ alignItems: 'center', marginTop: 50, gap: 12 }}>
              <Text style={{ fontFamily: Fonts.body, fontSize: 13.5, color: palette.error, textAlign: 'center' }}>
                {error}
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
          ) : (
            groups.map((g) => {
              const meta = getSurah(g.surah);
              const startsSurah = g.verses[0]?.ayah === 1;
              return (
                <View key={`${g.surah}-${g.verses[0]?.ayah}`}>
                  {startsSurah ? (
                    <View style={{ marginBottom: 6, marginTop: groups[0].surah === g.surah ? 0 : 14 }}>
                      <View
                        style={{
                          borderWidth: 1.2,
                          borderColor: palette.goldLine,
                          borderRadius: 10,
                          paddingVertical: 6,
                          marginHorizontal: 8,
                        }}>
                        <Text
                          style={{
                            fontFamily: Fonts.arabic,
                            fontSize: 19,
                            color: palette.primary,
                            textAlign: 'center',
                            writingDirection: 'rtl',
                          }}>
                          سُورَةُ {meta.arabic}
                        </Text>
                      </View>
                      {g.surah !== 1 && g.surah !== 9 ? (
                        <Text
                          style={{
                            fontFamily: Fonts.arabic,
                            fontSize: 17,
                            color: palette.bismillah,
                            textAlign: 'center',
                            marginTop: 8,
                            writingDirection: 'rtl',
                          }}>
                          {BISMILLAH}
                        </Text>
                      ) : null}
                    </View>
                  ) : null}
                  <Text style={{ textAlign: 'justify', writingDirection: 'rtl' }}>
                    {g.verses.map((v) => (
                      <Text key={`${v.surah}:${v.ayah}`}>
                        <Text
                          style={{
                            fontFamily: Fonts.arabic,
                            fontSize: 21,
                            lineHeight: 44,
                            color: palette.textPrimary,
                          }}>
                          {v.text}
                        </Text>
                        {/* NBSP glues the marker to the last word; RLM (U+200F)
                            keeps the neutral ﴿﴾ pair inside the RTL run so the
                            number lands at the ayah's END (visual left). */}
                        <Text
                          style={{
                            fontFamily: Fonts.arabic,
                            fontSize: 19,
                            lineHeight: 44,
                            color: palette.gold,
                          }}>
                          {' ‏﴿' + toArabicIndic(v.ayah) + '﴾‏ '}
                        </Text>
                      </Text>
                    ))}
                  </Text>
                </View>
              );
            })
          )}

          {/* Page number footer, like a printed mushaf */}
          {verses.length > 0 ? (
            <Text
              style={{
                fontFamily: Fonts.bodySemiBold,
                fontSize: 12,
                color: palette.gold,
                textAlign: 'center',
                marginTop: 14,
              }}>
              ﴾ {toArabicIndic(page)} ﴿
            </Text>
          ) : null}
        </View>
      </ScrollView>

      {/* Surah picker -> jumps to the surah's first page */}
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
                onPress={() => jumpToSurah(item.number)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: Layout.screenPadding,
                  paddingVertical: 13,
                  borderBottomWidth: 1,
                  borderBottomColor: palette.cardBorder,
                  backgroundColor: pageSurahs.includes(item.number) ? palette.primaryTint : 'transparent',
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
