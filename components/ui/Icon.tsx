import type { LucideIcon } from 'lucide-react-native';
import ArrowDown from 'lucide-react-native/icons/arrow-down';
import ArrowUp from 'lucide-react-native/icons/arrow-up';
import Check from 'lucide-react-native/icons/check';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import Clock from 'lucide-react-native/icons/clock';
import Flag from 'lucide-react-native/icons/flag';
import Flame from 'lucide-react-native/icons/flame';
import House from 'lucide-react-native/icons/house';
import Info from 'lucide-react-native/icons/info';
import Lock from 'lucide-react-native/icons/lock';
import MapPin from 'lucide-react-native/icons/map-pin';
import Minus from 'lucide-react-native/icons/minus';
import Plus from 'lucide-react-native/icons/plus';
import RefreshCw from 'lucide-react-native/icons/refresh-cw';
import Settings from 'lucide-react-native/icons/settings';
import Sparkles from 'lucide-react-native/icons/sparkles';
import Target from 'lucide-react-native/icons/target';
import Trash from 'lucide-react-native/icons/trash';
import Trophy from 'lucide-react-native/icons/trophy';
import TriangleAlert from 'lucide-react-native/icons/triangle-alert';
import User from 'lucide-react-native/icons/user';
import X from 'lucide-react-native/icons/x';
import { useTheme } from '../../lib/theme';

const ICONS = {
  home: House,
  flag: Flag,
  target: Target,
  user: User,
  plus: Plus,
  'chevron-right': ChevronRight,
  'chevron-left': ChevronLeft,
  check: Check,
  'arrow-down': ArrowDown,
  'arrow-up': ArrowUp,
  clock: Clock,
  lock: Lock,
  settings: Settings,
  trash: Trash,
  refresh: RefreshCw,
  alert: TriangleAlert,
  info: Info,
  x: X,
  minus: Minus,
  'map-pin': MapPin,
  flame: Flame,
  trophy: Trophy,
  sparkles: Sparkles,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

type Props = {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
  accessibilityLabel?: string;
};

export function Icon({ name, size = 22, color, strokeWidth = 1.75, accessibilityLabel }: Props) {
  const { colors } = useTheme();
  const Glyph = ICONS[name];

  if (accessibilityLabel) {
    return (
      <Glyph
        size={size}
        color={color ?? colors.ink}
        strokeWidth={strokeWidth}
        accessible
        accessibilityRole="image"
        accessibilityLabel={accessibilityLabel}
      />
    );
  }

  return (
    <Glyph
      size={size}
      color={color ?? colors.ink}
      strokeWidth={strokeWidth}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    />
  );
}
