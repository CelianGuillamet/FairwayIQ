import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { AiCoachLimitError, postRoundDebrief } from '../lib/claude';
import { useAuthStore } from '../stores/auth';
import { useRoundsStore } from '../stores/rounds';
import { Colors } from '../constants';
import { DecorativeBackground } from '../components/ui/DecorativeBackground';
import { AppCard } from '../components/ui/AppCard';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at?: string;
};

const OPENING_MESSAGE = (score: number, par: number, name: string): string =>
  `Bonjour ${name}. J'ai analyse ton round de ${score} coups (${score > par ? '+' : ''}${score - par}). Qu'est-ce qui t'a le plus marque aujourd'hui ?`;

function buildFallbackReply(score: number, par: number) {
  const scoreDiff = score - par;

  if (scoreDiff >= 12) {
    return 'Le coach IA est indisponible pour le moment. Repars des trous qui ont vraiment fait basculer le round: penalites, trois-putts, mauvais choix de club.';
  }

  if (scoreDiff >= 5) {
    return 'Le coach IA est indisponible pour le moment. Le meilleur angle d’analyse reste de repérer les segments où tu perds 1 à 2 coups sans t’en rendre compte.';
  }

  return 'Le coach IA est indisponible pour le moment. Le round semble avoir une base saine. Cherche surtout ce qui est reproductible et réellement stable.';
}

export default function DebriefScreen() {
  const { roundId } = useLocalSearchParams<{ roundId: string }>();
  const { profile, user } = useAuthStore();
  const { rounds } = useRoundsStore();
  const round = rounds.find((currentRound) => currentRound.id === roundId);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!round || !profile || !user) {
      return;
    }

    void initSession();
  }, [round, profile, user]);

  const initSession = async () => {
    if (!round || !profile || !user) {
      return null;
    }

    const { data: existing, error: existingError } = await supabase
      .from('debrief_sessions')
      .select('id, debrief_messages(id, role, content, created_at)')
      .eq('round_id', round.id)
      .maybeSingle();

    if (existingError) {
      console.warn('[debrief] failed to load session', existingError.message);
    }

    if (existing) {
      setSessionId(existing.id);
      const existingMessages = ((existing as any).debrief_messages as Message[] | undefined) ?? [];

      if (existingMessages.length > 0) {
        setMessages(
          [...existingMessages].sort((left, right) =>
            (left.created_at ?? '').localeCompare(right.created_at ?? '')
          )
        );
        return existing.id;
      }
    }

    const opener: Message = {
      id: 'opener',
      role: 'assistant',
      content: OPENING_MESSAGE(round.total_score, round.par, profile.display_name ?? 'Joueur'),
    };

    const activeSessionId = existing?.id ?? await (async () => {
      const { data: session, error } = await supabase
        .from('debrief_sessions')
        .insert({ user_id: user.id, round_id: round.id })
        .select('id')
        .single();

      if (error) {
        console.warn('[debrief] failed to create session', error.message);
        return null;
      }

      return session.id;
    })();

    if (activeSessionId) {
      setSessionId(activeSessionId);
      await supabase.from('debrief_messages').insert({
        session_id: activeSessionId,
        role: 'assistant',
        content: opener.content,
      });
    }

    setMessages((previousMessages) => previousMessages.length === 0 ? [opener] : previousMessages);
    return activeSessionId;
  };

  const sendMessage = async () => {
    if (!input.trim() || loading || !round || !profile) {
      return;
    }

    const text = input.trim();
    setInput('');

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text };
    setMessages((previousMessages) => [...previousMessages, userMsg]);
    setLoading(true);

    try {
      const history = messages
        .filter((message) => message.id !== 'opener')
        .map((message) => ({ role: message.role, content: message.content }));

      const reply = await postRoundDebrief(round, profile, text, history);
      const assistantMsg: Message = { id: (Date.now() + 1).toString(), role: 'assistant', content: reply };
      setMessages((previousMessages) => [...previousMessages, assistantMsg]);

      const activeSessionId = sessionId ?? await initSession();
      if (activeSessionId) {
        await supabase.from('debrief_messages').insert([
          { session_id: activeSessionId, role: 'user', content: text },
          { session_id: activeSessionId, role: 'assistant', content: reply },
        ]);
      }
    } catch (error) {
      setMessages((previousMessages) => [
        ...previousMessages,
        {
          id: `fallback-${Date.now()}`,
          role: 'assistant',
          content: error instanceof AiCoachLimitError
            ? error.message
            : buildFallbackReply(round.total_score, round.par),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (messages.length === 0) {
      return;
    }

    const timeout = setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    return () => clearTimeout(timeout);
  }, [messages]);

  if (!round || !profile) {
    return (
      <View style={styles.loadingState}>
        <DecorativeBackground />
        <Text style={styles.errorText}>Round introuvable.</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <DecorativeBackground />

      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Retour</Text>
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>Débrief IA</Text>
          <Text style={styles.headerSub}>{round.total_score} coups · par {round.par}</Text>
        </View>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(message) => message.id}
        contentContainerStyle={styles.messageList}
        ListHeaderComponent={(
          <AppCard accent="highlight" style={styles.summaryCard}>
            <Text style={styles.summaryEyebrow}>Session debrief</Text>
            <Text style={styles.summaryTitle}>{round.course_name ?? 'Round enregistré'}</Text>
            <Text style={styles.summaryText}>
              Utilise ce chat pour isoler les vrais points de bascule du round et clarifier la priorité de travail.
            </Text>
          </AppCard>
        )}
        renderItem={({ item }) => <MessageBubble message={item} />}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
      />

      {loading ? (
        <View style={styles.typingRow}>
          <ActivityIndicator size="small" color={Colors.text} />
          <Text style={styles.typingText}>FairwayIQ répond...</Text>
        </View>
      ) : null}

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Pose ta question..."
          placeholderTextColor={Colors.textDim}
          value={input}
          onChangeText={setInput}
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
          onPress={() => void sendMessage()}
          disabled={!input.trim() || loading}
        >
          <Text style={styles.sendBtnText}>↑</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';

  return (
    <View style={[styles.bubble, isUser ? styles.bubbleUser : undefined]}>
      {!isUser ? <Text style={styles.bubbleLabel}>FairwayIQ</Text> : null}
      <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>{message.content}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingState: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderStrong,
    gap: 12,
  },
  backBtn: {
    paddingVertical: 4,
    paddingRight: 8,
  },
  backBtnText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.text,
  },
  headerSub: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 2,
  },
  messageList: {
    padding: 16,
    gap: 12,
    paddingBottom: 8,
  },
  summaryCard: {
    marginBottom: 14,
  },
  summaryEyebrow: {
    color: Colors.textDim,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  summaryTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  summaryText: {
    color: Colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
  },
  bubble: {
    maxWidth: '82%',
    padding: 14,
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignSelf: 'flex-start',
  },
  bubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: Colors.surfaceAccent,
    borderColor: Colors.accentBlue,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 4,
  },
  bubbleLabel: {
    fontSize: 11,
    color: Colors.text,
    fontWeight: '800',
    marginBottom: 4,
  },
  bubbleText: {
    fontSize: 15,
    color: Colors.text,
    lineHeight: 22,
  },
  bubbleTextUser: {
    color: Colors.text,
  },
  typingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
    gap: 8,
  },
  typingText: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 12,
    borderTopWidth: 1,
    borderTopColor: Colors.borderStrong,
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: Colors.text,
    fontSize: 15,
    maxHeight: 100,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
  sendBtnText: {
    color: Colors.background,
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 24,
  },
  errorText: {
    color: Colors.error,
    textAlign: 'center',
    fontSize: 16,
  },
});
