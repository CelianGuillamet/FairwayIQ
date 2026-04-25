import { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../constants';
import { useDrillsStore } from '../../stores/drills';
import { useAuthStore } from '../../stores/auth';
import type { Drill } from '../../types';
import { AppCard } from '../../components/ui/AppCard';
import { AppButton } from '../../components/ui/AppButton';
import { PageHeader } from '../../components/ui/PageHeader';
import { DecorativeBackground } from '../../components/ui/DecorativeBackground';

export const DRILLS: Drill[] = [
  { id: '1', title: 'Gate Drill', description: 'Place deux tees à la largeur de ton putter à 50cm du trou. Rentre 10 putts de suite sans toucher les tees.', youtube_url: null, category: 'putting', difficulty: 'beginner', duration_minutes: 10 },
  { id: '2', title: 'Clock Drill — distance', description: 'Place 4 balles à 1m, 2m, 3m et 4m du trou (comme une horloge). Fais le tour complet sans 3-putter.', youtube_url: null, category: 'putting', difficulty: 'intermediate', duration_minutes: 15 },
  { id: '3', title: '100 putts de 1 mètre', description: 'Rentre 100 putts de 1 mètre consécutifs. Si tu rates, recommence depuis 0. Construit la confiance.', youtube_url: null, category: 'putting', difficulty: 'beginner', duration_minutes: 20 },
  { id: '4', title: 'Chip & Run 50/50', description: "Depuis le rough, chipe vers une cible à 10m. L'objectif est que la balle roule autant qu'elle vole.", youtube_url: null, category: 'short_game', difficulty: 'beginner', duration_minutes: 20 },
  { id: '5', title: 'Sortie de bunker ciblée', description: "Trace un cercle de 1m autour du trou. Sors 10 balles de bunker. Objectif: 7/10 dans le cercle.", youtube_url: null, category: 'short_game', difficulty: 'intermediate', duration_minutes: 20 },
  { id: '6', title: 'Up & Down challenge', description: "50m du green, 10 essais. Compte tes up & downs réussis. Objectif: 5/10 minimum.", youtube_url: null, category: 'short_game', difficulty: 'intermediate', duration_minutes: 25 },
  { id: '7', title: '9 to 3 — contact propre', description: "Fais des swings courts (9h à 3h) avec un fer 7. Objectif: contact propre et trajectoire droite.", youtube_url: null, category: 'approach', difficulty: 'beginner', duration_minutes: 15 },
  { id: '8', title: 'Fer contre mur', description: "Debout face à un mur (10cm), descends le club sans le toucher. Corrige les défauts de swing intérieur.", youtube_url: null, category: 'approach', difficulty: 'intermediate', duration_minutes: 10 },
  { id: '9', title: 'Approche 100m / 150m / 200m', description: "10 balles à chaque distance. Note les résultats. Identifie quelle distance te coûte le plus de coups.", youtube_url: null, category: 'approach', difficulty: 'intermediate', duration_minutes: 30 },
  { id: '10', title: 'Drive en douceur 80%', description: "Frappe 20 drives à 80% de puissance. Mesure la précision vs direction. La vitesse sans contrôle ne sert à rien.", youtube_url: null, category: 'driving', difficulty: 'beginner', duration_minutes: 20 },
  { id: '11', title: 'Tempo 3:1', description: 'Monte en 3 temps, descends en 1. Utilise un métronome ou compte "un-deux-trois / frapper".', youtube_url: null, category: 'driving', difficulty: 'beginner', duration_minutes: 15 },
  { id: '12', title: 'Drive entre les cibles', description: "Choisis deux repères à 10m d'écart à 200m. Frappe 10 balles dans le couloir. Compte tes réussites.", youtube_url: null, category: 'driving', difficulty: 'intermediate', duration_minutes: 20 },
  { id: '13', title: 'Routine de putting mental', description: "10 putts de 2m. Avant chaque putt: visualise la ligne, 2 pratiques, target focus. Zéro précipitation.", youtube_url: null, category: 'mental', difficulty: 'beginner', duration_minutes: 15 },
  { id: '14', title: 'Simulation de trou', description: "Au practice, joue un trou imaginaire. Drive, approche, chip, putt. Tout avec la même routine qu'en compet.", youtube_url: null, category: 'mental', difficulty: 'advanced', duration_minutes: 30 },
  { id: '15', title: 'Respiration avant coup', description: "Sur 20 coups, impose-toi 3 respirations profondes avant chaque swing. Observe l'effet sur la précision.", youtube_url: null, category: 'mental', difficulty: 'beginner', duration_minutes: 20 },
];

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

  useEffect(() => { fetchCompletions(); }, []);

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
                const labels: Record<string, string> = { putting: 'Putting', short_game: 'Petit jeu', approach: 'Approches', driving: 'Mise en jeu', mental: 'Mental' };
                return labels[c] ?? c;
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
            onMarkDone={() => user && markDone(drill.id, user.id)}
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
  const diffColors: Record<string, string> = { beginner: Colors.primary, intermediate: Colors.warning, advanced: Colors.error };
  const diffLabels: Record<string, string> = { beginner: 'Débutant', intermediate: 'Intermédiaire', advanced: 'Avancé' };

  return (
    <AppCard style={[styles.card, doneToday && styles.cardDone]} accent={doneToday ? 'highlight' : 'default'}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{drill.title}</Text>
        <View style={[styles.diffBadge, { borderColor: diffColors[drill.difficulty] }]}>
          <Text style={[styles.diffText, { color: diffColors[drill.difficulty] }]}>
            {diffLabels[drill.difficulty]}
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
  statBadgeValue: { fontSize: 18, fontWeight: '800', color: Colors.primary },
  statBadgeLabel: { fontSize: 10, color: Colors.textDim, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.8 },
  recommendBanner: { marginBottom: 12 },
  recommendEyebrow: { fontSize: 12, color: Colors.textDim, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  recommendText: { fontSize: 15, color: Colors.text, lineHeight: 22, fontWeight: '700' },
  filterScroll: { maxHeight: 46, marginBottom: 12 },
  filterContent: { gap: 8, alignItems: 'center' },
  filterChip: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 22, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  filterChipActive: { backgroundColor: Colors.surfaceAccent, borderColor: Colors.primary },
  filterChipText: { color: Colors.textMuted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
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
  cardCount: { fontSize: 12, color: Colors.primary },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  youtubeLink: { fontSize: 12, color: Colors.primary, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  doneButton: { minHeight: 40, paddingHorizontal: 14 },
  emptyCard: { marginTop: 6 },
  emptyTitle: { color: Colors.text, fontSize: 16, fontWeight: '800', marginBottom: 6 },
  emptyText: { color: Colors.textMuted, fontSize: 14, lineHeight: 21 },
});
