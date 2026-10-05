import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Fonts, Numerals, Radius, Spacing, Typography } from '../constants';
import type { ThemeColors } from '../constants';
import { useTheme, useThemedStyles } from '../lib/theme';
import {
  CARRY_RANGE_MESSAGE,
  CLUBS,
  countClubs,
  formatClubCount,
  getBagErrorMessage,
  readCarryInput,
  sanitizeCarryText,
  type ClubDistances,
  type ClubId,
} from '../lib/bag';
import { describeAdviceReadiness } from '../lib/club-advice';
import { useAuthStore } from '../stores/auth';
import { useBagStore } from '../stores/bag';
import { AppCard } from '../components/ui/AppCard';
import { Icon } from '../components/ui/Icon';
import { PageHeader } from '../components/ui/PageHeader';
import { TextAction } from '../components/ui/TextAction';

const SAVE_DEBOUNCE_MS = 700;
const SAVED_VISIBLE_MS = 2000;

type Drafts = Record<ClubId, string>;
type RowStatus = { kind: 'saved' } | { kind: 'error'; message: string };
type Statuses = Partial<Record<ClubId, RowStatus>>;

const toDrafts = (distances: ClubDistances) =>
  Object.fromEntries(CLUBS.map(({ id }) => [id, distances[id] != null ? String(distances[id]) : ''])) as Drafts;

export default function BagScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const loaded = useBagStore((state) => state.loaded);
  const error = useBagStore((state) => state.error);
  const load = useBagStore((state) => state.load);

  useEffect(() => {
    if (userId) void load(userId);
  }, [userId, load]);

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/profile');
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.xs, paddingBottom: insets.bottom + Spacing.xxl },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <PageHeader
          title="Mon sac"
          subtitle="Distance moyenne en vol (carry), pas le roulé. Laisse vide un club que tu n’as pas."
          onBack={goBack}
        />

        {loaded ? (
          <BagEditor />
        ) : error ? (
          <View style={styles.centered}>
            <Text style={styles.stateText}>{error}</Text>
            <TextAction
              label="Réessayer"
              onPress={() => {
                if (userId) void load(userId);
              }}
            />
          </View>
        ) : (
          <View style={styles.centered}>
            <ActivityIndicator color={colors.ink} accessibilityLabel="Chargement" />
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function BagEditor() {
  const styles = useThemedStyles(createStyles);
  const distances = useBagStore((state) => state.distances);
  const [drafts, setDrafts] = useState<Drafts>(() => toDrafts(useBagStore.getState().distances));
  const [statuses, setStatuses] = useState<Statuses>({});
  const draftsRef = useRef(drafts);
  const dirtyRef = useRef(new Set<ClubId>());
  const sentRef = useRef(new Map<ClubId, string>());
  const mountedRef = useRef(true);
  const saveTimers = useRef(new Map<ClubId, ReturnType<typeof setTimeout>>());
  const savedTimers = useRef(new Map<ClubId, ReturnType<typeof setTimeout>>());

  const setStatus = useCallback((club: ClubId, status: RowStatus | null) => {
    setStatuses((current) => {
      const next = { ...current };
      if (status) next[club] = status;
      else delete next[club];
      return next;
    });
  }, []);

  const clearSaveTimer = useCallback((club: ClubId) => {
    const timer = saveTimers.current.get(club);
    if (timer) clearTimeout(timer);
    saveTimers.current.delete(club);
  }, []);

  const commit = useCallback(
    async (club: ClubId, final: boolean) => {
      clearSaveTimer(club);
      const text = draftsRef.current[club];
      const input = readCarryInput(text);

      if (input.kind === 'invalid') {
        if (final) setStatus(club, { kind: 'error', message: CARRY_RANGE_MESSAGE });
        return;
      }

      if (input.kind === 'empty' && !final) {
        return;
      }

      dirtyRef.current.delete(club);

      const stored = useBagStore.getState().distances[club];
      const baseline = sentRef.current.get(club) ?? (stored === undefined ? '' : String(stored));
      const next = input.kind === 'empty' ? '' : String(input.carryM);

      if (next === baseline) {
        return;
      }

      sentRef.current.set(club, next);

      try {
        if (input.kind === 'empty') {
          await useBagStore.getState().removeDistance(club);
        } else {
          await useBagStore.getState().saveDistance(club, input.carryM);
        }
      } catch (error) {
        sentRef.current.delete(club);
        if (mountedRef.current && draftsRef.current[club] === text) {
          setStatus(club, { kind: 'error', message: getBagErrorMessage(error, input.kind === 'empty' ? 'remove' : 'save') });
        }
        return;
      }

      if (!mountedRef.current || draftsRef.current[club] !== text) {
        return;
      }

      setStatus(club, { kind: 'saved' });
      const previous = savedTimers.current.get(club);
      if (previous) clearTimeout(previous);
      savedTimers.current.set(
        club,
        setTimeout(() => {
          savedTimers.current.delete(club);
          setStatuses((current) => {
            if (current[club]?.kind !== 'saved') return current;
            const next = { ...current };
            delete next[club];
            return next;
          });
        }, SAVED_VISIBLE_MS),
      );
    },
    [clearSaveTimer, setStatus],
  );

  const handleChange = (club: ClubId, raw: string) => {
    const text = sanitizeCarryText(raw);
    draftsRef.current = { ...draftsRef.current, [club]: text };
    dirtyRef.current.add(club);
    setDrafts(draftsRef.current);
    setStatus(club, null);
    clearSaveTimer(club);
    saveTimers.current.set(
      club,
      setTimeout(() => void commit(club, false), SAVE_DEBOUNCE_MS),
    );
  };

  const handleClear = (club: ClubId) => {
    draftsRef.current = { ...draftsRef.current, [club]: '' };
    setDrafts(draftsRef.current);
    setStatus(club, null);
    void commit(club, true);
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      saveTimers.current.forEach((timer) => clearTimeout(timer));
      savedTimers.current.forEach((timer) => clearTimeout(timer));
      dirtyRef.current.forEach((club) => void commit(club, true));
    };
  }, [commit]);

  const count = countClubs(distances);

  return (
    <View style={styles.editor}>
      <AppCard accent="soft">
        <Text style={styles.summaryTitle} accessibilityRole="header">
          {formatClubCount(count)}
        </Text>
        <Text style={styles.summaryText}>{describeAdviceReadiness(count)}</Text>
      </AppCard>

      <AppCard style={styles.listCard}>
        {CLUBS.map(({ id, label }, index) => (
          <ClubRow
            key={id}
            label={label}
            value={drafts[id]}
            status={statuses[id]}
            first={index === 0}
            onChange={(text) => handleChange(id, text)}
            onBlur={() => void commit(id, true)}
            onClear={() => handleClear(id)}
          />
        ))}
      </AppCard>
    </View>
  );
}

function ClubRow({
  label,
  value,
  status,
  first,
  onChange,
  onBlur,
  onClear,
}: {
  label: string;
  value: string;
  status: RowStatus | undefined;
  first: boolean;
  onChange: (text: string) => void;
  onBlur: () => void;
  onClear: () => void;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [focused, setFocused] = useState(false);
  const errorMessage = status?.kind === 'error' ? status.message : null;

  return (
    <View style={[styles.row, !first && styles.rowDivider]}>
      <View style={styles.rowMain}>
        <Text style={styles.rowLabel}>{label}</Text>
        <View style={styles.statusSlot}>
          {status?.kind === 'saved' ? (
            <Icon name="check" size={16} strokeWidth={2} color={colors.green} accessibilityLabel="Enregistré" />
          ) : null}
        </View>
        <View style={[styles.inputShell, focused && styles.inputShellFocused, errorMessage ? styles.inputShellError : null]}>
          <TextInput
            style={styles.input}
            value={value}
            onChangeText={onChange}
            onFocus={() => setFocused(true)}
            onBlur={() => {
              setFocused(false);
              onBlur();
            }}
            keyboardType="number-pad"
            returnKeyType="done"
            maxLength={3}
            selectTextOnFocus
            placeholder="–"
            placeholderTextColor={colors.ink3}
            selectionColor={colors.ink}
            accessibilityLabel={`${label}, distance en mètres`}
          />
          <Text style={styles.unit} accessibilityElementsHidden importantForAccessibility="no">
            m
          </Text>
        </View>
        <View style={styles.clearSlot}>
          {value !== '' ? (
            <Pressable
              style={({ pressed }) => [styles.clear, pressed && styles.pressed]}
              onPress={onClear}
              hitSlop={4}
              accessibilityRole="button"
              accessibilityLabel={`Effacer la distance ${label}`}
            >
              <Icon name="x" size={18} color={colors.ink3} />
            </Pressable>
          ) : null}
        </View>
      </View>
      {errorMessage ? (
        <Text style={styles.rowError} accessibilityLiveRegion="polite">
          {errorMessage}
        </Text>
      ) : null}
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
    },
    centered: {
      alignItems: 'center',
      paddingVertical: Spacing.xxl,
      gap: Spacing.xs,
    },
    stateText: {
      ...Typography.body,
      color: colors.ink2,
      textAlign: 'center',
    },
    editor: {
      gap: Spacing.md,
    },
    summaryTitle: {
      ...Typography.titleMd,
      color: colors.ink,
    },
    summaryText: {
      ...Typography.body,
      color: colors.ink2,
      marginTop: Spacing.xxs,
    },
    listCard: {
      paddingVertical: 0,
    },
    row: {
      minHeight: 60,
      justifyContent: 'center',
      paddingVertical: Spacing.xs,
    },
    rowDivider: {
      borderTopWidth: 1,
      borderTopColor: colors.line,
    },
    rowMain: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
    },
    rowLabel: {
      ...Typography.bodyStrong,
      color: colors.ink,
      flex: 1,
    },
    statusSlot: {
      width: 18,
      alignItems: 'center',
    },
    inputShell: {
      width: 92,
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.line,
      borderRadius: Radius.md,
      paddingLeft: Spacing.xs,
      paddingRight: Spacing.sm,
      gap: 4,
    },
    inputShellFocused: {
      borderColor: colors.ink,
    },
    inputShellError: {
      borderColor: colors.error,
    },
    input: {
      ...Numerals,
      flex: 1,
      minWidth: 0,
      fontFamily: Fonts.serif,
      fontSize: 20,
      lineHeight: 24,
      color: colors.ink,
      textAlign: 'right',
      paddingVertical: 8,
    },
    unit: {
      fontFamily: Fonts.sansMedium,
      fontSize: 14,
      color: colors.ink3,
    },
    clearSlot: {
      width: 36,
      alignItems: 'center',
    },
    clear: {
      width: 36,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pressed: {
      opacity: 0.6,
    },
    rowError: {
      ...Typography.caption,
      color: colors.error,
      marginTop: 2,
      paddingBottom: Spacing.xxs,
    },
  });
