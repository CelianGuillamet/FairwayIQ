import { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, Pressable,
  StyleSheet, Keyboard,
} from 'react-native';
import {
  COURSE_SEARCH_UNAVAILABLE_MESSAGE,
  searchCoursesWithStatus,
  type CourseSearchResult,
  type GolfCourse,
} from '../../lib/golf-courses';
import { COURSE_SEARCH_ATTRIBUTION, hasOpenStreetMapCourse } from '../../lib/credits';
import { Radius, Shadows, Spacing, Typography } from '../../constants';
import type { ThemeColors } from '../../constants';
import { useTheme, useThemedStyles } from '../../lib/theme';

type Props = {
  value: string;
  onSelect: (course: GolfCourse) => void;
  onChangeText: (text: string) => void;
};

export function CourseSearch({ value, onSelect, onChangeText }: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [results, setResults] = useState<CourseSearchResult[]>([]);
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchUnavailable, setSearchUnavailable] = useState(false);
  const latestRequestRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, []);

  const handleChange = (text: string) => {
    onChangeText(text);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (text.trim().length < 2) {
      latestRequestRef.current += 1;
      setResults([]);
      setSearchUnavailable(false);
      setLoading(false);
      return;
    }

    const requestId = latestRequestRef.current + 1;
    latestRequestRef.current = requestId;
    setResults([]);
    setSearchUnavailable(false);
    setLoading(true);

    timeoutRef.current = setTimeout(() => {
      void searchCoursesWithStatus(text)
        .then((outcome) => {
          if (latestRequestRef.current !== requestId) {
            return;
          }

          setResults(outcome.courses);
          setSearchUnavailable(outcome.remoteUnavailable);
        })
        .catch(() => {
          if (latestRequestRef.current !== requestId) {
            return;
          }

          setResults([]);
          setSearchUnavailable(true);
        })
        .finally(() => {
          if (latestRequestRef.current === requestId) {
            setLoading(false);
          }
        });
    }, 240);
  };

  const handleSelect = (course: GolfCourse) => {
    onChangeText(course.name);
    setResults([]);
    setSearchUnavailable(false);
    Keyboard.dismiss();
    setFocused(false);
    setLoading(false);
    onSelect(course);
  };

  const showDropdown = focused && value.trim().length >= 2 && (loading || results.length > 0 || searchUnavailable);
  const showAttribution = hasOpenStreetMapCourse(results);

  return (
    <View style={styles.wrapper}>
      <TextInput
        style={[styles.input, focused && styles.inputFocused]}
        placeholder="Rechercher un parcours..."
        placeholderTextColor={colors.ink3}
        selectionColor={colors.ink}
        accessibilityLabel="Rechercher un parcours"
        value={value}
        onChangeText={handleChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        autoCapitalize="words"
      />
      {showDropdown && (
        <View style={styles.dropdown}>
          {loading ? (
            <View style={styles.loadingState}>
              <Text style={styles.loadingLabel}>Recherche des parcours...</Text>
            </View>
          ) : null}
          {!loading && searchUnavailable ? (
            <View style={styles.notice}>
              <Text style={styles.noticeLabel}>{COURSE_SEARCH_UNAVAILABLE_MESSAGE}</Text>
            </View>
          ) : null}
          {results.map((course) => {
            const name = course.isCustom ? `Utiliser « ${course.name} »` : course.name;
            const meta = course.isCustom
              ? `Parcours non trouvé · Par ${course.par18} par défaut`
              : `${course.city} · Par ${course.par18} · ${course.holes} trous${course.latitude != null && course.longitude != null ? ' · GPS' : ''}`;

            return (
              <Pressable
                key={course.id}
                style={({ pressed }) => [styles.result, course.isCustom && styles.customResult, pressed && styles.pressed]}
                onPress={() => handleSelect(course)}
                accessibilityRole="button"
                accessibilityLabel={`${name}, ${meta}`}
              >
                <Text style={styles.resultName}>{name}</Text>
                <Text style={styles.resultMeta}>{meta}</Text>
              </Pressable>
            );
          })}
          {showAttribution ? <Text style={styles.attribution}>{COURSE_SEARCH_ATTRIBUTION}</Text> : null}
        </View>
      )}
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrapper: { position: 'relative', zIndex: 10 },
    input: {
      ...Typography.body,
      fontSize: 16,
      minHeight: 48,
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.line,
      borderRadius: Radius.md,
      paddingHorizontal: Spacing.md,
      paddingVertical: 12,
      color: colors.ink,
    },
    inputFocused: {
      borderColor: colors.ink,
    },
    dropdown: {
      position: 'absolute',
      top: '100%',
      left: 0,
      right: 0,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.lineStrong,
      borderRadius: Radius.lg,
      marginTop: Spacing.xs,
      overflow: 'hidden',
      zIndex: 100,
      shadowColor: '#000000',
      ...Shadows.elevated,
    },
    result: {
      minHeight: 56,
      justifyContent: 'center',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.line,
    },
    customResult: {
      backgroundColor: colors.sunk,
    },
    pressed: {
      opacity: 0.7,
    },
    loadingState: {
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.line,
    },
    loadingLabel: {
      ...Typography.caption,
      color: colors.ink2,
    },
    notice: {
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.line,
    },
    noticeLabel: {
      ...Typography.caption,
      color: colors.ink2,
    },
    attribution: {
      ...Typography.caption,
      color: colors.ink3,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.xs,
    },
    resultName: { ...Typography.bodyStrong, color: colors.ink },
    resultMeta: { ...Typography.caption, color: colors.ink2, marginTop: 2 },
  });
