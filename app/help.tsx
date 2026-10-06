import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Spacing, Typography } from '../constants';
import type { ThemeColors } from '../constants';
import { useThemedStyles } from '../lib/theme';
import { FAQ_ITEMS } from '../lib/help-faq';
import { contactSupport, getSupportEmail } from '../lib/support';
import { AppCard } from '../components/ui/AppCard';
import { PageHeader } from '../components/ui/PageHeader';
import { TextAction } from '../components/ui/TextAction';

export default function HelpScreen() {
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(createStyles);
  const supportEmail = getSupportEmail();

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/profile');
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.xs, paddingBottom: insets.bottom + Spacing.xxl },
        ]}
      >
        <PageHeader
          title="Questions fréquentes"
          subtitle="Les réponses aux questions les plus courantes sur FairwayIQ."
          onBack={goBack}
        />

        <AppCard style={styles.card}>
          {FAQ_ITEMS.map((item, index) => (
            <View key={item.id} style={[styles.item, index > 0 && styles.itemDivider]}>
              <Text style={styles.question} accessibilityRole="header">
                {item.question}
              </Text>
              <Text style={styles.answer}>{item.answer}</Text>
            </View>
          ))}
        </AppCard>

        {supportEmail ? (
          <View style={styles.contact}>
            <Text style={styles.contactText}>Tu ne trouves pas ta réponse ?</Text>
            <TextAction
              label="Contacter le support"
              role="link"
              underline
              onPress={() => void contactSupport(supportEmail)}
              accessibilityHint="Ouvre un e-mail prérempli"
            />
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    content: {
      paddingHorizontal: Spacing.lg,
      gap: Spacing.xl,
    },
    card: {
      paddingVertical: 0,
    },
    item: {
      paddingVertical: Spacing.md,
      gap: Spacing.xs,
    },
    itemDivider: {
      borderTopWidth: 1,
      borderTopColor: colors.line,
    },
    question: {
      ...Typography.bodyStrong,
      color: colors.ink,
    },
    answer: {
      ...Typography.body,
      color: colors.ink2,
    },
    contact: {
      gap: Spacing.xxs,
    },
    contactText: {
      ...Typography.body,
      color: colors.ink2,
    },
  });
