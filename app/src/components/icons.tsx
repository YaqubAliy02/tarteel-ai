/**
 * Feather-style stroke icons (the handoff README calls for Lucide/Feather,
 * ~1.7-1.9 stroke). Hand-inlined via react-native-svg to avoid an icon-font
 * dependency; path data from Feather (MIT).
 */
import Svg, { Circle, Line, Path, Polygon, Polyline, Rect } from 'react-native-svg';

export type IconProps = {
  size?: number;
  color: string;
  strokeWidth?: number;
};

function Frame({ size = 22, color, strokeWidth = 1.8, children }: IconProps & { children: React.ReactNode }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round">
      {children}
    </Svg>
  );
}

export const HomeIcon = (p: IconProps) => (
  <Frame {...p}>
    <Path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <Polyline points="9 22 9 12 15 12 15 22" />
  </Frame>
);

export const MicIcon = (p: IconProps) => (
  <Frame {...p}>
    <Path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
    <Path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <Line x1="12" y1="19" x2="12" y2="23" />
    <Line x1="8" y1="23" x2="16" y2="23" />
  </Frame>
);

export const AlertCircleIcon = (p: IconProps) => (
  <Frame {...p}>
    <Circle cx="12" cy="12" r="10" />
    <Line x1="12" y1="8" x2="12" y2="12" />
    <Line x1="12" y1="16" x2="12.01" y2="16" />
  </Frame>
);

export const BarChartIcon = (p: IconProps) => (
  <Frame {...p}>
    <Line x1="18" y1="20" x2="18" y2="10" />
    <Line x1="12" y1="20" x2="12" y2="4" />
    <Line x1="6" y1="20" x2="6" y2="14" />
  </Frame>
);

export const EyeIcon = (p: IconProps) => (
  <Frame {...p}>
    <Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <Circle cx="12" cy="12" r="3" />
  </Frame>
);

export const EyeOffIcon = (p: IconProps) => (
  <Frame {...p}>
    <Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <Circle cx="12" cy="12" r="3" />
    <Line x1="2" y1="2" x2="22" y2="22" />
  </Frame>
);

export const BookOpenIcon = (p: IconProps) => (
  <Frame {...p}>
    <Path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
    <Path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
  </Frame>
);

export const HeadphonesIcon = (p: IconProps) => (
  <Frame {...p}>
    <Path d="M3 18v-6a9 9 0 0 1 18 0v6" />
    <Path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
  </Frame>
);

export const CalendarIcon = (p: IconProps) => (
  <Frame {...p}>
    <Rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <Line x1="16" y1="2" x2="16" y2="6" />
    <Line x1="8" y1="2" x2="8" y2="6" />
    <Line x1="3" y1="10" x2="21" y2="10" />
  </Frame>
);

export const RefreshIcon = (p: IconProps) => (
  <Frame {...p}>
    <Polyline points="23 4 23 10 17 10" />
    <Polyline points="1 20 1 14 7 14" />
    <Path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </Frame>
);

export const BellIcon = (p: IconProps) => (
  <Frame {...p}>
    <Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <Path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </Frame>
);

export const ClockIcon = (p: IconProps) => (
  <Frame {...p}>
    <Circle cx="12" cy="12" r="10" />
    <Polyline points="12 6 12 12 16 14" />
  </Frame>
);

export const PlayIcon = ({ filled, ...p }: IconProps & { filled?: boolean }) => (
  <Svg
    width={p.size ?? 22}
    height={p.size ?? 22}
    viewBox="0 0 24 24"
    fill={filled ? p.color : 'none'}
    stroke={p.color}
    strokeWidth={p.strokeWidth ?? 1.8}
    strokeLinecap="round"
    strokeLinejoin="round">
    <Polygon points="5 3 19 12 5 21 5 3" />
  </Svg>
);

export const CheckIcon = (p: IconProps) => (
  <Frame {...p}>
    <Polyline points="20 6 9 17 4 12" />
  </Frame>
);

export const ChevronLeftIcon = (p: IconProps) => (
  <Frame {...p}>
    <Polyline points="15 18 9 12 15 6" />
  </Frame>
);

export const ChevronRightIcon = (p: IconProps) => (
  <Frame {...p}>
    <Polyline points="9 18 15 12 9 6" />
  </Frame>
);

export const ChevronDownIcon = (p: IconProps) => (
  <Frame {...p}>
    <Polyline points="6 9 12 15 18 9" />
  </Frame>
);

export const PlusIcon = (p: IconProps) => (
  <Frame {...p}>
    <Line x1="12" y1="5" x2="12" y2="19" />
    <Line x1="5" y1="12" x2="19" y2="12" />
  </Frame>
);

export const MinusIcon = (p: IconProps) => (
  <Frame {...p}>
    <Line x1="5" y1="12" x2="19" y2="12" />
  </Frame>
);

export const SquareIcon = ({ filled, ...p }: IconProps & { filled?: boolean }) => (
  <Svg
    width={p.size ?? 22}
    height={p.size ?? 22}
    viewBox="0 0 24 24"
    fill={filled ? p.color : 'none'}
    stroke={p.color}
    strokeWidth={p.strokeWidth ?? 1.8}
    strokeLinejoin="round">
    <Rect x="5" y="5" width="14" height="14" rx="2" />
  </Svg>
);
