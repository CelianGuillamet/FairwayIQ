import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, Spacing, Typography } from '../../constants';

type Props = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
};

export function PageHeader({ eyebrow, title, subtitle, trailing }: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.content}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  content: {
    flex: 1,
  },
  eyebrow: {
    color: Colors.accentBlue,
    ...Typography.caption,
    marginBottom: 6,
  },
  title: {
    color: Colors.text,
    ...Typography.title,
  },
  subtitle: {
    color: Colors.textMuted,
    ...Typography.body,
    marginTop: Spacing.xs,
  },
  trailing: {
    alignItems: 'flex-end',
  },
});
