import type { StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '../../lib/theme';
import type { ThemePreference } from '../../lib/theme-preference';
import { SegmentedControl, type SegmentedOption } from './SegmentedControl';

const OPTIONS: readonly SegmentedOption<ThemePreference>[] = [
  { value: 'system', label: 'Auto' },
  { value: 'light', label: 'Clair' },
  { value: 'dark', label: 'Sombre' },
];

export function ThemePreferenceControl({ style }: { style?: StyleProp<ViewStyle> }) {
  const { preference, setPreference } = useTheme();

  return (
    <SegmentedControl
      options={OPTIONS}
      value={preference}
      onChange={setPreference}
      accessibilityLabel="Apparence de l’application"
      style={style}
    />
  );
}
