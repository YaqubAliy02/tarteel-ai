/**
 * Static surah metadata + verse fetching from the Quran.com API v4.
 *
 * Display text is Uthmani (Mushaf orthography, per the design). The backend
 * compares against Imlaei server-side, so the app never needs to worry about
 * orthography differences — it just shows Uthmani and sends surah:ayah.
 */

const QURAN_API = 'https://api.quran.com/api/v4';
// Dr. Mustafa Khattab, The Clear Quran
const TRANSLATION_ID = 131;

export type Surah = {
  number: number;
  name: string;
  arabic: string;
  ayahCount: number;
};

export const SURAHS: Surah[] = [
  { number: 1, name: 'Al-Fatihah', arabic: 'الفاتحة', ayahCount: 7 },
  { number: 2, name: 'Al-Baqarah', arabic: 'البقرة', ayahCount: 286 },
  { number: 3, name: "Ali 'Imran", arabic: 'آل عمران', ayahCount: 200 },
  { number: 4, name: 'An-Nisa', arabic: 'النساء', ayahCount: 176 },
  { number: 5, name: "Al-Ma'idah", arabic: 'المائدة', ayahCount: 120 },
  { number: 6, name: "Al-An'am", arabic: 'الأنعام', ayahCount: 165 },
  { number: 7, name: "Al-A'raf", arabic: 'الأعراف', ayahCount: 206 },
  { number: 8, name: 'Al-Anfal', arabic: 'الأنفال', ayahCount: 75 },
  { number: 9, name: 'At-Tawbah', arabic: 'التوبة', ayahCount: 129 },
  { number: 10, name: 'Yunus', arabic: 'يونس', ayahCount: 109 },
  { number: 11, name: 'Hud', arabic: 'هود', ayahCount: 123 },
  { number: 12, name: 'Yusuf', arabic: 'يوسف', ayahCount: 111 },
  { number: 13, name: "Ar-Ra'd", arabic: 'الرعد', ayahCount: 43 },
  { number: 14, name: 'Ibrahim', arabic: 'إبراهيم', ayahCount: 52 },
  { number: 15, name: 'Al-Hijr', arabic: 'الحجر', ayahCount: 99 },
  { number: 16, name: 'An-Nahl', arabic: 'النحل', ayahCount: 128 },
  { number: 17, name: 'Al-Isra', arabic: 'الإسراء', ayahCount: 111 },
  { number: 18, name: 'Al-Kahf', arabic: 'الكهف', ayahCount: 110 },
  { number: 19, name: 'Maryam', arabic: 'مريم', ayahCount: 98 },
  { number: 20, name: 'Ta-Ha', arabic: 'طه', ayahCount: 135 },
  { number: 21, name: 'Al-Anbiya', arabic: 'الأنبياء', ayahCount: 112 },
  { number: 22, name: 'Al-Hajj', arabic: 'الحج', ayahCount: 78 },
  { number: 23, name: "Al-Mu'minun", arabic: 'المؤمنون', ayahCount: 118 },
  { number: 24, name: 'An-Nur', arabic: 'النور', ayahCount: 64 },
  { number: 25, name: 'Al-Furqan', arabic: 'الفرقان', ayahCount: 77 },
  { number: 26, name: "Ash-Shu'ara", arabic: 'الشعراء', ayahCount: 227 },
  { number: 27, name: 'An-Naml', arabic: 'النمل', ayahCount: 93 },
  { number: 28, name: 'Al-Qasas', arabic: 'القصص', ayahCount: 88 },
  { number: 29, name: "Al-'Ankabut", arabic: 'العنكبوت', ayahCount: 69 },
  { number: 30, name: 'Ar-Rum', arabic: 'الروم', ayahCount: 60 },
  { number: 31, name: 'Luqman', arabic: 'لقمان', ayahCount: 34 },
  { number: 32, name: 'As-Sajdah', arabic: 'السجدة', ayahCount: 30 },
  { number: 33, name: 'Al-Ahzab', arabic: 'الأحزاب', ayahCount: 73 },
  { number: 34, name: 'Saba', arabic: 'سبأ', ayahCount: 54 },
  { number: 35, name: 'Fatir', arabic: 'فاطر', ayahCount: 45 },
  { number: 36, name: 'Ya-Sin', arabic: 'يس', ayahCount: 83 },
  { number: 37, name: 'As-Saffat', arabic: 'الصافات', ayahCount: 182 },
  { number: 38, name: 'Sad', arabic: 'ص', ayahCount: 88 },
  { number: 39, name: 'Az-Zumar', arabic: 'الزمر', ayahCount: 75 },
  { number: 40, name: 'Ghafir', arabic: 'غافر', ayahCount: 85 },
  { number: 41, name: 'Fussilat', arabic: 'فصلت', ayahCount: 54 },
  { number: 42, name: 'Ash-Shura', arabic: 'الشورى', ayahCount: 53 },
  { number: 43, name: 'Az-Zukhruf', arabic: 'الزخرف', ayahCount: 89 },
  { number: 44, name: 'Ad-Dukhan', arabic: 'الدخان', ayahCount: 59 },
  { number: 45, name: 'Al-Jathiyah', arabic: 'الجاثية', ayahCount: 37 },
  { number: 46, name: 'Al-Ahqaf', arabic: 'الأحقاف', ayahCount: 35 },
  { number: 47, name: 'Muhammad', arabic: 'محمد', ayahCount: 38 },
  { number: 48, name: 'Al-Fath', arabic: 'الفتح', ayahCount: 29 },
  { number: 49, name: 'Al-Hujurat', arabic: 'الحجرات', ayahCount: 18 },
  { number: 50, name: 'Qaf', arabic: 'ق', ayahCount: 45 },
  { number: 51, name: 'Adh-Dhariyat', arabic: 'الذاريات', ayahCount: 60 },
  { number: 52, name: 'At-Tur', arabic: 'الطور', ayahCount: 49 },
  { number: 53, name: 'An-Najm', arabic: 'النجم', ayahCount: 62 },
  { number: 54, name: 'Al-Qamar', arabic: 'القمر', ayahCount: 55 },
  { number: 55, name: 'Ar-Rahman', arabic: 'الرحمن', ayahCount: 78 },
  { number: 56, name: "Al-Waqi'ah", arabic: 'الواقعة', ayahCount: 96 },
  { number: 57, name: 'Al-Hadid', arabic: 'الحديد', ayahCount: 29 },
  { number: 58, name: 'Al-Mujadila', arabic: 'المجادلة', ayahCount: 22 },
  { number: 59, name: 'Al-Hashr', arabic: 'الحشر', ayahCount: 24 },
  { number: 60, name: 'Al-Mumtahanah', arabic: 'الممتحنة', ayahCount: 13 },
  { number: 61, name: 'As-Saff', arabic: 'الصف', ayahCount: 14 },
  { number: 62, name: "Al-Jumu'ah", arabic: 'الجمعة', ayahCount: 11 },
  { number: 63, name: 'Al-Munafiqun', arabic: 'المنافقون', ayahCount: 11 },
  { number: 64, name: 'At-Taghabun', arabic: 'التغابن', ayahCount: 18 },
  { number: 65, name: 'At-Talaq', arabic: 'الطلاق', ayahCount: 12 },
  { number: 66, name: 'At-Tahrim', arabic: 'التحريم', ayahCount: 12 },
  { number: 67, name: 'Al-Mulk', arabic: 'الملك', ayahCount: 30 },
  { number: 68, name: 'Al-Qalam', arabic: 'القلم', ayahCount: 52 },
  { number: 69, name: 'Al-Haqqah', arabic: 'الحاقة', ayahCount: 52 },
  { number: 70, name: "Al-Ma'arij", arabic: 'المعارج', ayahCount: 44 },
  { number: 71, name: 'Nuh', arabic: 'نوح', ayahCount: 28 },
  { number: 72, name: 'Al-Jinn', arabic: 'الجن', ayahCount: 28 },
  { number: 73, name: 'Al-Muzzammil', arabic: 'المزمل', ayahCount: 20 },
  { number: 74, name: 'Al-Muddaththir', arabic: 'المدثر', ayahCount: 56 },
  { number: 75, name: 'Al-Qiyamah', arabic: 'القيامة', ayahCount: 40 },
  { number: 76, name: 'Al-Insan', arabic: 'الإنسان', ayahCount: 31 },
  { number: 77, name: 'Al-Mursalat', arabic: 'المرسلات', ayahCount: 50 },
  { number: 78, name: 'An-Naba', arabic: 'النبأ', ayahCount: 40 },
  { number: 79, name: "An-Nazi'at", arabic: 'النازعات', ayahCount: 46 },
  { number: 80, name: "'Abasa", arabic: 'عبس', ayahCount: 42 },
  { number: 81, name: 'At-Takwir', arabic: 'التكوير', ayahCount: 29 },
  { number: 82, name: 'Al-Infitar', arabic: 'الانفطار', ayahCount: 19 },
  { number: 83, name: 'Al-Mutaffifin', arabic: 'المطففين', ayahCount: 36 },
  { number: 84, name: 'Al-Inshiqaq', arabic: 'الانشقاق', ayahCount: 25 },
  { number: 85, name: 'Al-Buruj', arabic: 'البروج', ayahCount: 22 },
  { number: 86, name: 'At-Tariq', arabic: 'الطارق', ayahCount: 17 },
  { number: 87, name: "Al-A'la", arabic: 'الأعلى', ayahCount: 19 },
  { number: 88, name: 'Al-Ghashiyah', arabic: 'الغاشية', ayahCount: 26 },
  { number: 89, name: 'Al-Fajr', arabic: 'الفجر', ayahCount: 30 },
  { number: 90, name: 'Al-Balad', arabic: 'البلد', ayahCount: 20 },
  { number: 91, name: 'Ash-Shams', arabic: 'الشمس', ayahCount: 15 },
  { number: 92, name: 'Al-Layl', arabic: 'الليل', ayahCount: 21 },
  { number: 93, name: 'Ad-Duha', arabic: 'الضحى', ayahCount: 11 },
  { number: 94, name: 'Ash-Sharh', arabic: 'الشرح', ayahCount: 8 },
  { number: 95, name: 'At-Tin', arabic: 'التين', ayahCount: 8 },
  { number: 96, name: "Al-'Alaq", arabic: 'العلق', ayahCount: 19 },
  { number: 97, name: 'Al-Qadr', arabic: 'القدر', ayahCount: 5 },
  { number: 98, name: 'Al-Bayyinah', arabic: 'البينة', ayahCount: 8 },
  { number: 99, name: 'Az-Zalzalah', arabic: 'الزلزلة', ayahCount: 8 },
  { number: 100, name: "Al-'Adiyat", arabic: 'العاديات', ayahCount: 11 },
  { number: 101, name: "Al-Qari'ah", arabic: 'القارعة', ayahCount: 11 },
  { number: 102, name: 'At-Takathur', arabic: 'التكاثر', ayahCount: 8 },
  { number: 103, name: "Al-'Asr", arabic: 'العصر', ayahCount: 3 },
  { number: 104, name: 'Al-Humazah', arabic: 'الهمزة', ayahCount: 9 },
  { number: 105, name: 'Al-Fil', arabic: 'الفيل', ayahCount: 5 },
  { number: 106, name: 'Quraysh', arabic: 'قريش', ayahCount: 4 },
  { number: 107, name: "Al-Ma'un", arabic: 'الماعون', ayahCount: 7 },
  { number: 108, name: 'Al-Kawthar', arabic: 'الكوثر', ayahCount: 3 },
  { number: 109, name: 'Al-Kafirun', arabic: 'الكافرون', ayahCount: 6 },
  { number: 110, name: 'An-Nasr', arabic: 'النصر', ayahCount: 3 },
  { number: 111, name: 'Al-Masad', arabic: 'المسد', ayahCount: 5 },
  { number: 112, name: 'Al-Ikhlas', arabic: 'الإخلاص', ayahCount: 4 },
  { number: 113, name: 'Al-Falaq', arabic: 'الفلق', ayahCount: 5 },
  { number: 114, name: 'An-Nas', arabic: 'الناس', ayahCount: 6 },
];

export function getSurah(number: number): Surah {
  return SURAHS[number - 1];
}

const ARABIC_INDIC = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

export function toArabicIndic(n: number): string {
  return String(n)
    .split('')
    .map((d) => ARABIC_INDIC[Number(d)] ?? d)
    .join('');
}

// Mobile connections hang more often than they fail — always abort slow
// requests so the UI can show a Retry instead of an infinite spinner.
async function fetchWithTimeout(url: string, ms = 12000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

const textCache = new Map<string, string>();
const translationCache = new Map<string, string | null>();

export async function fetchVerseText(surah: number, ayah: number): Promise<string> {
  const key = `${surah}:${ayah}`;
  const cached = textCache.get(key);
  if (cached) return cached;

  const resp = await fetchWithTimeout(`${QURAN_API}/quran/verses/uthmani?verse_key=${key}`);
  if (!resp.ok) throw new Error(`verse fetch failed (${resp.status})`);
  const json = await resp.json();
  const verse = json.verses?.[0];
  if (!verse) throw new Error(`verse ${key} not found`);

  const text = verse.text_uthmani as string;
  textCache.set(key, text);
  return text;
}

// ---- Mushaf pages (Madani layout, 604 pages) --------------------------------

export const MUSHAF_PAGES = 604;

export type MushafVerse = { surah: number; ayah: number; text: string };

const pageMemCache = new Map<number, MushafVerse[]>();

/**
 * Verses of one physical Mushaf page. Downloaded with progress reporting and
 * cached on disk, so previously read pages open instantly and offline.
 */
export async function fetchMushafPage(
  page: number,
  onProgress?: (pct: number) => void,
): Promise<MushafVerse[]> {
  const cached = pageMemCache.get(page);
  if (cached) return cached;

  const FileSystem = await import('expo-file-system/legacy');
  const dest = `${FileSystem.cacheDirectory}mushaf_page_${page}.json`;
  const partial = `${dest}.part`;

  const info = await FileSystem.getInfoAsync(dest);
  if (!info.exists) {
    onProgress?.(0);
    const download = FileSystem.createDownloadResumable(
      `${QURAN_API}/quran/verses/uthmani?page_number=${page}`,
      partial,
      {},
      (p) => {
        if (p.totalBytesExpectedToWrite > 0) {
          onProgress?.(Math.min(100, Math.round((p.totalBytesWritten / p.totalBytesExpectedToWrite) * 100)));
        }
      },
    );
    try {
      const result = await download.downloadAsync();
      if (!result || (result.status && result.status >= 400)) throw new Error('download failed');
      await FileSystem.moveAsync({ from: partial, to: dest });
    } catch (e) {
      await FileSystem.deleteAsync(partial, { idempotent: true }).catch(() => {});
      throw e;
    }
  }

  const raw = await FileSystem.readAsStringAsync(dest);
  const json = JSON.parse(raw);
  const verses: MushafVerse[] = (json.verses ?? []).map(
    (v: { verse_key: string; text_uthmani: string }) => {
      const [s, a] = v.verse_key.split(':');
      return { surah: Number(s), ayah: Number(a), text: v.text_uthmani.trim() };
    },
  );
  if (!verses.length) {
    // corrupt cache entry — remove so the next attempt re-downloads
    await FileSystem.deleteAsync(dest, { idempotent: true }).catch(() => {});
    throw new Error(`page ${page} returned no verses`);
  }
  pageMemCache.set(page, verses);
  return verses;
}

let surahStartPages: number[] | null = null;

/** First Mushaf page of a surah (from the chapters catalog, cached). */
export async function getSurahStartPage(surah: number): Promise<number> {
  if (!surahStartPages) {
    const resp = await fetchWithTimeout(`${QURAN_API}/chapters`, 15000);
    if (!resp.ok) throw new Error(`chapters fetch failed (${resp.status})`);
    const json = await resp.json();
    const chapters = json.chapters ?? [];
    if (chapters.length !== 114) throw new Error('unexpected chapters payload');
    surahStartPages = chapters.map((c: { pages: number[] }) => c.pages[0]);
  }
  return surahStartPages?.[surah - 1] ?? 1;
}

/** Full-surah recitation by Mishary Rashid Alafasy (Islamic Network CDN). */
export function alafasySurahAudioUrl(surah: number): string {
  return `https://cdn.islamic.network/quran/audio-surah/128/ar.alafasy/${surah}.mp3`;
}

/** Decorative — resolves to null on any failure; never blocks the verse. */
export async function fetchTranslation(surah: number, ayah: number): Promise<string | null> {
  const key = `${surah}:${ayah}`;
  if (translationCache.has(key)) return translationCache.get(key) ?? null;

  try {
    const resp = await fetchWithTimeout(`${QURAN_API}/quran/translations/${TRANSLATION_ID}?verse_key=${key}`);
    if (!resp.ok) return null;
    const json = await resp.json();
    const raw = json.translations?.[0]?.text as string | undefined;
    // Strip footnote markers like <sup foot_note=...>1</sup> and any tags.
    const translation = raw
      ? raw.replace(/<sup[^>]*>.*?<\/sup>/g, '').replace(/<[^>]+>/g, '').trim()
      : null;
    translationCache.set(key, translation);
    return translation;
  } catch {
    return null;
  }
}
