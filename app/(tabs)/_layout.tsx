import type { ReactNode } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Fonts } from '../../constants';
import { Icon, type IconName } from '../../components/ui/Icon';
import { useTheme } from '../../lib/theme';

const TAB_BAR_HEIGHT = 56;

type TabBarButtonProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: (event: GestureResponderEvent) => void;
  onLongPress?: ((event: GestureResponderEvent) => void) | null;
  testID?: string;
  'aria-label'?: string;
  'aria-selected'?: boolean;
};

function TabBarButton({
  children,
  style,
  onPress,
  onLongPress,
  testID,
  'aria-label': label,
  'aria-selected': selected = false,
}: TabBarButtonProps) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      testID={testID}
      accessibilityRole={Platform.OS === 'ios' ? 'button' : 'tab'}
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      style={[style, styles.button]}
    >
      {selected ? (
        <View pointerEvents="none" style={styles.indicatorSlot}>
          <View style={[styles.indicator, { backgroundColor: colors.ink }]} />
        </View>
      ) : null}
      {children}
    </Pressable>
  );
}

function tabIcon(name: IconName) {
  return function TabIcon({ color, focused }: { color: string; focused: boolean }) {
    return <Icon name={name} size={22} color={color} strokeWidth={focused ? 2 : 1.75} />;
  };
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const bottomInset = Math.max(insets.bottom, 6);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.bg },
        tabBarStyle: {
          backgroundColor: colors.bg,
          borderTopColor: colors.line,
          borderTopWidth: 1,
          height: TAB_BAR_HEIGHT + bottomInset,
          paddingBottom: bottomInset,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.ink3,
        tabBarLabelStyle: { fontFamily: Fonts.sansSemiBold, fontSize: 12, lineHeight: 16 },
        tabBarButton: (props) => <TabBarButton {...props} />,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Accueil',
          tabBarAccessibilityLabel: 'Accueil',
          tabBarIcon: tabIcon('home'),
        }}
      />
      <Tabs.Screen
        name="round"
        options={{
          title: 'Score',
          tabBarAccessibilityLabel: 'Score',
          tabBarIcon: tabIcon('flag'),
        }}
      />
      <Tabs.Screen
        name="drills"
        options={{
          title: 'Exercices',
          tabBarAccessibilityLabel: 'Exercices',
          tabBarIcon: tabIcon('target'),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarAccessibilityLabel: 'Profil',
          tabBarIcon: tabIcon('user'),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  button: {
    justifyContent: 'center',
  },
  indicatorSlot: {
    position: 'absolute',
    top: -1,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  indicator: {
    width: 28,
    height: 3,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
  },
});
