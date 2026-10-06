import { Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import { Radius, Spacing, Typography } from '../../constants';
import type { ThemeColors } from '../../constants';
import { getKnownCourse } from '../../lib/golf-courses';
import { formatRecentCourseMeta, type RecentCourse } from '../../lib/recent-courses';
import { useTheme, useThemedStyles } from '../../lib/theme';
import { Icon } from '../ui/Icon';

type Props = {
  courses: RecentCourse[];
  onSelect: (course: RecentCourse) => void;
};

export function RecentCourses({ courses, onSelect }: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  if (courses.length === 0) {
    return null;
  }

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>Mes parcours</Text>
      <View style={styles.card}>
        {courses.map((course, index) => {
          const meta = formatRecentCourseMeta(getKnownCourse(course.courseId)?.city, course.roundCount);

          return (
            <Pressable
              key={course.key}
              style={({ pressed }) => [styles.row, index < courses.length - 1 && styles.rowDivider, pressed && styles.pressed]}
              onPress={() => {
                Keyboard.dismiss();
                onSelect(course);
              }}
              accessibilityRole="button"
              accessibilityLabel={`${course.name}, ${meta}`}
            >
              <View style={styles.info}>
                <Text style={styles.name} numberOfLines={1}>{course.name}</Text>
                <Text style={styles.meta} numberOfLines={1}>{meta}</Text>
              </View>
              <Icon name="chevron-right" size={18} color={colors.ink3} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrapper: {
      marginTop: Spacing.lg,
    },
    label: {
      ...Typography.label,
      color: colors.ink2,
      marginBottom: Spacing.xs,
    },
    card: {
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.surface,
      overflow: 'hidden',
    },
    row: {
      minHeight: 56,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
    },
    rowDivider: {
      borderBottomWidth: 1,
      borderBottomColor: colors.line,
    },
    pressed: {
      opacity: 0.7,
    },
    info: {
      flex: 1,
      minWidth: 0,
    },
    name: {
      ...Typography.bodyStrong,
      color: colors.ink,
    },
    meta: {
      ...Typography.caption,
      color: colors.ink2,
      marginTop: 2,
    },
  });
