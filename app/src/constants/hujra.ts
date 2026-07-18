/**
 * Hujra design tokens, transcribed from design_handoff_hujra/README.md.
 * Every color has a light and dark counterpart; components must read them
 * through useHujraTheme(), never hardcode.
 */

export const HujraLight = {
  bg: '#F4EDE1',
  bgAlt: '#FBF6EC',
  surface: '#FFFFFF',
  cardBorder: '#EDE4D5',
  primary: '#0C5A4E',
  primaryLight: '#178a76',
  primaryTint: '#E8F0EB',
  primaryDeepCard: '#0C5A4E',
  primaryDeepCardBorder: '#0C5A4E',
  gold: '#B0883B',
  goldTint: '#F1E7CF',
  goldWordTint: '#F4E7C6',
  goldLine: '#D9BE7E',
  goldLineSoft: '#DCC79A',
  error: '#C06A5C',
  errorTint: '#F6E4DF',
  textPrimary: '#22302B',
  textSecondary: '#8A938C',
  textTertiary: '#b3ac9d',
  mushafSurface: '#FBF5E6',
  mushafBorder: '#EDE4D5',
  hiddenWord: '#9aa39c',
  ringTrack: '#EDE7D8',
  futureDot: '#E0D9C8',
  tabBarBg: '#FBF6EC',
  tabBarBorder: '#EDE4D5',
  heatmap: ['#ECE6D7', '#CBE0D6', '#93C3B3', '#4F9E8B', '#0C5A4E'],
  bismillah: '#9C7B33',
  verseOrnament: '#C9A24B',
};

export const HujraDark: typeof HujraLight = {
  bg: '#0D1714',
  bgAlt: '#0F1A16',
  surface: '#15231F',
  cardBorder: '#21322C',
  primary: '#37A892',
  primaryLight: '#46c2a8',
  primaryTint: '#163029',
  primaryDeepCard: '#0C463C',
  primaryDeepCardBorder: '#15564a',
  gold: '#D7B569',
  goldTint: 'rgba(215,181,105,.14)',
  goldWordTint: 'rgba(215,181,105,.18)',
  goldLine: '#D7B569',
  goldLineSoft: 'rgba(215,181,105,.45)',
  error: '#D6837A',
  errorTint: 'rgba(214,131,122,.16)',
  textPrimary: '#ECE3D3',
  textSecondary: '#8BA197',
  textTertiary: '#5C6E67',
  mushafSurface: '#12201C',
  mushafBorder: '#2A4239',
  hiddenWord: '#5C6E67',
  ringTrack: '#21322C',
  futureDot: '#243530',
  tabBarBg: '#0F1A16',
  tabBarBorder: '#21322C',
  heatmap: ['#16241F', '#1E3F37', '#2A6356', '#2E8C77', '#46C2A8'],
  bismillah: '#C9A24B',
  verseOrnament: '#C9A24B',
};

export type HujraPalette = typeof HujraLight;

export const Fonts = {
  arabic: 'Amiri_400Regular',
  arabicBold: 'Amiri_700Bold',
  display: 'BricolageGrotesque_600SemiBold',
  displayBold: 'BricolageGrotesque_700Bold',
  displayMedium: 'BricolageGrotesque_500Medium',
  body: 'HankenGrotesk_500Medium',
  bodySemiBold: 'HankenGrotesk_600SemiBold',
  bodyBold: 'HankenGrotesk_700Bold',
  bodyRegular: 'HankenGrotesk_400Regular',
};

export const Layout = {
  screenPadding: 22,
  cardGap: 13,
  radiusVerseCard: 26,
  radiusCard: 22,
  radiusTile: 22,
  radiusButton: 16,
  radiusChip: 9,
  radiusPill: 100,
};
