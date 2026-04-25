import { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Keyboard,
} from 'react-native';
import { searchCourses, type CourseSearchResult, type GolfCourse } from '../../lib/golf-courses';
import { Colors, Radius, Spacing, Typography } from '../../constants';

type Props = {
  value: string;
  onSelect: (course: GolfCourse) => void;
  onChangeText: (text: string) => void;
};

export function CourseSearch({ value, onSelect, onChangeText }: Props) {
  const [results, setResults] = useState<CourseSearchResult[]>([]);
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(false);
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
      setLoading(false);
      return;
    }

    const requestId = latestRequestRef.current + 1;
    latestRequestRef.current = requestId;
    setResults([]);
    setLoading(true);

    timeoutRef.current = setTimeout(() => {
      void searchCourses(text)
        .then((nextResults) => {
          if (latestRequestRef.current !== requestId) {
            return;
          }

          setResults(nextResults);
        })
        .catch(() => {
          if (latestRequestRef.current !== requestId) {
            return;
          }

          setResults([]);
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
    Keyboard.dismiss();
    setFocused(false);
    setLoading(false);
    onSelect(course);
  };

  const showDropdown = focused && value.trim().length >= 2 && (loading || results.length > 0);

  return (
    <View style={styles.wrapper}>
      <TextInput
        style={styles.input}
        placeholder="Rechercher un parcours..."
        placeholderTextColor={Colors.textDim}
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
          {results.map((course) => (
            <TouchableOpacity
              key={course.id}
              style={[styles.result, course.isCustom && styles.customResult]}
              onPress={() => handleSelect(course)}
            >
              <Text style={styles.resultName}>
                {course.isCustom ? `Utiliser "${course.name}"` : course.name}
              </Text>
              <Text style={styles.resultMeta}>
                {course.isCustom
                  ? `Parcours non trouve · Par ${course.par18} par defaut`
                  : `${course.city} · Par ${course.par18} · ${course.holes} trous${course.latitude != null && course.longitude != null ? ' · GPS' : ''}`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: 'relative', zIndex: 10 },
  input: {
    backgroundColor: Colors.backgroundSoft,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: 15,
    color: Colors.text,
    fontSize: 16,
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    borderRadius: Radius.lg,
    marginTop: Spacing.xs,
    overflow: 'hidden',
    zIndex: 100,
    elevation: 8,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 20,
  },
  result: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  customResult: {
    backgroundColor: Colors.surface,
  },
  loadingState: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  loadingLabel: {
    ...Typography.caption,
    color: Colors.textMuted,
  },
  resultName: { ...Typography.bodyStrong, color: Colors.text },
  resultMeta: { ...Typography.caption, color: Colors.textMuted, marginTop: 4 },
});
