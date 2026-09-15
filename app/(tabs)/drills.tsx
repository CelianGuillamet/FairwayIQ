import { useState, useEffect } from 'react';
import { Alert, View, Text, ScrollView, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../constants';
import { useDrillsStore } from '../../stores/drills';
import { useAuthStore } from '../../stores/auth';
import type { Drill } from '../../types';
import { DRILL_CATEGORY_LABELS, DRILL_DIFFICULTY_LABELS, DRILLS } from '../../lib/drill-library';
import { AppCard } from '../../components/ui/AppCard';
import { AppButton } from '../../components/ui/AppButton';
import { PageHeader } from '../../components/ui/PageHeader';
import { DecorativeBackground } from '../../components/ui/DecorativeBackground';

const CATEGORIES = [
  { key: 'recommended', label: 'Focus' },
  { key: 'all', label: 'Tous' },
  { key: 'putting', label: 'Putting' },
  { key: 'short_game', label: 'Petit jeu' },
  { key: 'approach', label: 'Approches' },
  { key: 'driving', label: 'Mise en jeu' },
  { key: 'mental', label: 'Mental' },
] as const;

export default function DrillsScreen() {
  const [activeCategory, setActiveCategory] = useState<string>('recommended');
  const { user } = useAuthStore();
  const { completions, recommendedCategories, fetchCompletions, markDone, isDoneToday, getStreak, getTotalDone } = useDrillsStore();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    void fetchCompletions().catch((error: any) => {
      Alert.alert('Erreur', error?.message ?? 'Impossible de charger tes drills complétés.');
    });
  }, [fetchCompletions]);

  const filtered = activeCategory === 'all'
    ? DRILLS
    : activeCategory === 'recommended'
      ? recommendedCategories.length > 0
        ? DRILLS.filter(d => recommendedCategories.includes(d.category))
        : DRILLS
      : DRILLS.filter(d => d.category === activeCategory);

  const streak = getStreak();
  const totalDone = getTotalDone();

  return (
    <View style={styles.container}>
      <DecorativeBackground />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
      >
        <PageHeader
          eyebrow="Practice"
          title="Drills & routines"
          subtitle="Une bibliothèque plus lisible, pilotée par ton diagnostic et pensée pour un usage court, efficace et répétable."
          trailing={(
            <View style={styles.statsColumn}>
              <StatBadge value={streak.toString()} label="série" />
              <StatBadge value={totalDone.toString()} label="faits" />
            </View>
          )}
        />

        {recommendedCategories.length > 0 && activeCategory === 'recommended' && (
          <AppCard accent="highlight" style={styles.recommendBanner}>
            <Text style={styles.recommendEyebrow}>Focus du moment</Text>
            <Text style={styles.recommendText}>
              {recommendedCategories.map(c => {
                return DRILL_CATEGORY_LABELS[c as keyof typeof DRILL_CATEGORY_LABELS] ?? c;
              }).join(' · ')}
            </Text>
          </AppCard>
        )}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterContent}>
          {CATEGORIES.map(cat => (
            <TouchableOpacity
              key={cat.key}
              style={[styles.filterChip, activeCategory === cat.key && styles.filterChipActive]}
              onPress={() => setActiveCategory(cat.key)}
            >
              <Text style={[styles.filterChipText, activeCategory === cat.key && styles.filterChipTextActive]}>
                {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {filtered.map(drill => (
          <DrillCard
            key={drill.id}
            drill={drill}
            doneToday={isDoneToday(drill.id)}
            totalCompletions={completions.filter(c => c.drill_id === drill.id).length}
            onMarkDone={() => {
              if (!user) {
                return;
              }

              void markDone(drill.id, user.id).catch((error: any) => {
                Alert.alert('Erreur', error?.message ?? 'Impossible de marquer ce drill comme terminé.');
              });
            }}
          />
        ))}

        {filtered.length === 0 ? (
          <AppCard accent="soft" style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Aucun drill sur ce filtre</Text>
            <Text style={styles.emptyText}>Change de catégorie ou attends un nouveau diagnostic pour faire remonter une priorité.</Text>
          </AppCard>
        ) : null}
      </ScrollView>
    </View>
  );
}

function DrillCard({ drill, doneToday, totalCompletions, onMarkDone }: {
  drill: Drill;
  doneToday: boolean;
  totalCompletions: number;
  onMarkDone: () => void;
}) {
  const diffColors: Record<string, string> = { beginner: Colors.accentBlue, intermediate: Colors.warning, advanced: Colors.error };

  return (
    <AppCard style={[styles.card, doneToday && styles.cardDone]} accent={doneToday ? 'highlight' : 'default'}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{drill.title}</Text>
        <View style={[styles.diffBadge, { borderColor: diffColors[drill.difficulty] }]}>
          <Text style={[styles.diffText, { color: diffColors[drill.difficulty] }]}>
            {DRILL_DIFFICULTY_LABELS[drill.difficulty]}
          </Text>
        </View>
      </View>
      <Text style={styles.cardDescription}>{drill.description}</Text>
      <View style={styles.cardFooter}>
        <View style={styles.cardMeta}>
          <Text style={styles.cardDuration}>{drill.duration_minutes} min</Text>
          {totalCompletions > 0 && (
            <Text style={styles.cardCount}>{totalCompletions}× réalisé</Text>
          )}
        </View>
        <View style={styles.cardActions}>
          {drill.youtube_url && (
            <TouchableOpacity onPress={() => Linking.openURL(drill.youtube_url!)}>
              <Text style={styles.youtubeLink}>Vidéo</Text>
            </TouchableOpacity>
          )}
          <AppButton
            label={doneToday ? 'Terminé' : 'Marquer fait'}
            variant={doneToday ? 'secondary' : 'primary'}
            onPress={onMarkDone}
            disabled={doneToday}
            style={styles.doneButton}
          />
        </View>
      </View>
    </AppCard>
  );
}

function StatBadge({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.statBadge}>
      <Text style={styles.statBadgeValue}>{value}</Text>
      <Text style={styles.statBadgeLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: 16, paddingBottom: 110 },
  statsColumn: { gap: 8 },
  statBadge: { backgroundColor: Colors.surfaceAccent, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: Colors.borderStrong, minWidth: 64 },
  statBadgeValue: { fontSize: 18, fontWeight: '800', color: Colors.text },
  statBadgeLabel: { fontSize: 10, color: Colors.textDim, marginTop: 2 },
  recommendBanner: { marginBottom: 12 },
  recommendEyebrow: { fontSize: 12, color: Colors.accentBlue, fontWeight: '700', marginBottom: 8 },
  recommendText: { fontSize: 15, color: Colors.text, lineHeight: 22, fontWeight: '700' },
  filterScroll: { maxHeight: 46, marginBottom: 12 },
  filterContent: { gap: 8, alignItems: 'center' },
  filterChip: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 22, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  filterChipActive: { backgroundColor: Colors.surfaceAccent, borderColor: Colors.accentBlue },
  filterChipText: { color: Colors.textMuted, fontSize: 12, fontWeight: '700' },
  filterChipTextActive: { color: Colors.text },
  card: { marginBottom: 12 },
  cardDone: { borderColor: Colors.borderStrong },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: Colors.text, flex: 1, marginRight: 8 },
  diffBadge: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  diffText: { fontSize: 11, fontWeight: '600' },
  cardDescription: { fontSize: 14, color: Colors.textMuted, lineHeight: 20 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 14, gap: 12 },
  cardMeta: { gap: 4 },
  cardDuration: { fontSize: 13, color: Colors.textDim, fontWeight: '700' },
  cardCount: { fontSize: 12, color: Colors.textDim },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  youtubeLink: { fontSize: 12, color: Colors.accentBlue, fontWeight: '700' },
  doneButton: { minHeight: 40, paddingHorizontal: 14 },
  emptyCard: { marginTop: 6 },
  emptyTitle: { color: Colors.text, fontSize: 16, fontWeight: '800', marginBottom: 6 },
  emptyText: { color: Colors.textMuted, fontSize: 14, lineHeight: 21 },
});
