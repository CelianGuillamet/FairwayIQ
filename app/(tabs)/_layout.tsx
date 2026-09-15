import { StyleSheet, Text, View } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Radius } from '../../constants';

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          position: 'absolute',
          left: 16,
          right: 16,
          bottom: 12,
          backgroundColor: Colors.surface,
          borderTopColor: Colors.borderStrong,
          borderTopWidth: 1,
          borderRadius: Radius.xxl,
          height: 72 + insets.bottom,
          paddingTop: 8,
          paddingBottom: Math.max(insets.bottom, 10),
          paddingHorizontal: 8,
          shadowColor: Colors.black,
          shadowOffset: { width: 0, height: 16 },
          shadowOpacity: 0.28,
          shadowRadius: 24,
          elevation: 10,
        },
        tabBarActiveBackgroundColor: Colors.surfaceAccent,
        tabBarActiveTintColor: Colors.text,
        tabBarInactiveTintColor: Colors.textDim,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '800', marginTop: 2, letterSpacing: 0.2 },
        tabBarItemStyle: { borderRadius: 18, marginHorizontal: 2 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Accueil',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon type="home" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="round"
        options={{
          title: 'Score',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon type="score" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="drills"
        options={{
          title: 'Drills',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon type="drills" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon type="profile" color={color} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

function TabIcon({
  type,
  color,
  focused,
}: {
  type: 'home' | 'score' | 'drills' | 'profile';
  color: string;
  focused: boolean;
}) {
  if (type === 'home') {
    return (
      <View style={stylesIcon.iconBox}>
        <View style={[stylesIcon.homeRoof, { borderBottomColor: color }]} />
        <View
          style={[
            stylesIcon.homeBase,
            { borderColor: color },
            focused && { backgroundColor: color },
          ]}
        />
      </View>
    );
  }

  if (type === 'score') {
    return (
      <View style={stylesIcon.iconBox}>
        <View style={[stylesIcon.flagPole, { backgroundColor: color }]} />
        <View
          style={[
            stylesIcon.flag,
            { borderColor: color },
            focused && { backgroundColor: color },
          ]}
        />
      </View>
    );
  }

  if (type === 'drills') {
    return (
      <View style={stylesIcon.iconBox}>
        <View style={[stylesIcon.targetOuter, { borderColor: color }]}>
          <View style={[stylesIcon.targetInner, { backgroundColor: focused ? color : 'transparent', borderColor: color }]} />
        </View>
      </View>
    );
  }

  return (
    <View style={stylesIcon.iconBox}>
      <View
        style={[
          stylesIcon.profileHead,
          { borderColor: color },
          focused && { backgroundColor: color },
        ]}
      />
      <View style={[stylesIcon.profileBody, { borderColor: color }]} />
    </View>
  );
}

const stylesIcon = StyleSheet.create({
  iconBox: {
    width: 22,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeRoof: {
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderBottomWidth: 7,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginBottom: 1,
  },
  homeBase: {
    width: 14,
    height: 9,
    borderWidth: 1.6,
    borderTopWidth: 0,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
  },
  flagPole: {
    position: 'absolute',
    left: 5,
    top: 1,
    width: 1.8,
    height: 18,
    borderRadius: 999,
  },
  flag: {
    position: 'absolute',
    left: 7,
    top: 2,
    width: 10,
    height: 7,
    borderWidth: 1.6,
    borderLeftWidth: 0,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
  },
  targetOuter: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  targetInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    borderWidth: 1.4,
  },
  profileHead: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.6,
    marginBottom: 2,
  },
  profileBody: {
    width: 15,
    height: 8,
    borderWidth: 1.6,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomWidth: 0,
  },
});
