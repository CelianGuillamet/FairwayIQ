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
import { buildOpeningMessage, sortDebriefMessages } from '../lib/debrief-messages';
import { getErrorCode } from '../lib/round-save';
import { AiCoachLimitError, AiCoachPremiumRequiredError, postRoundDebrief } from '../lib/claude';
import { useAuthStore } from '../stores/auth';
import { useRoundsStore } from '../stores/rounds';
import { useSubscriptionStore } from '../stores/subscription';
import { Colors } from '../constants';
import type { Profile, Round } from '../types';
import { DecorativeBackground } from '../components/ui/DecorativeBackground';
import { AppCard } from '../components/ui/AppCard';
import { AppButton } from '../components/ui/AppButton';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at?: string;
};

const PERSIST_FAILED_NOTICE = 'Cette conversation n’a pas pu être sauvegardée : elle ne sera pas retrouvée à la réouverture.';

function buildFallbackReply(score: number, par: number) {
  const scoreDiff = score - par;

  if (scoreDiff >= 12) {
    return 'Le coach IA est indisponible pour le moment. Repars des trous qui ont vraiment fait basculer le round: pénalités, trois-putts, mauvais choix de club.';
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
  const isPremium = useSubscriptionStore((state) => state.isPremium);
  const subscriptionLoading = useSubscriptionStore((state) => state.loading);
  const round = rounds.find((currentRound) => currentRound.id === roundId);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const sessionInitRef = useRef<{ roundId: string; promise: Promise<string | null> } | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const insets = useSafeAreaInsets();
  const resolvedRoundId = round?.id;
  const userId = user?.id;
  const profileId = profile?.id;

  useEffect(() => {
    if (!resolvedRoundId || !profileId || !userId || !isPremium) {
      return;
    }

    void ensureSession();
  }, [resolvedRoundId, profileId, userId, isPremium]);

  const ensureSession = (): Promise<string | null> => {
    if (!round || !profile || !user) {
      return Promise.resolve(null);
    }

    if (sessionInitRef.current?.roundId === round.id) {
      return sessionInitRef.current.promise;
    }

    const promise = initSession(round, profile, user.id).catch((error) => {
      console.warn('[debrief] failed to init session', getErrorCode(error));
      setNotice(PERSIST_FAILED_NOTICE);
      return null;
    });
    sessionInitRef.current = { roundId: round.id, promise };

    void promise.then((activeSessionId) => {
      if (!activeSessionId && sessionInitRef.current?.promise === promise) {
        sessionInitRef.current = null;
      }
    });

    return promise;
  };

  const initSession = async (currentRound: Round, currentProfile: Profile, currentUserId: string) => {
    const { data: existing, error: existingError } = await supabase
      .from('debrief_sessions')
      .select('id, debrief_messages(id, role, content, created_at)')
      .eq('round_id', currentRound.id)
      .maybeSingle();

    if (existingError) {
      console.warn('[debrief] failed to load session', getErrorCode(existingError));
    }

    if (existing) {
      setSessionId(existing.id);
      const existingMessages = ((existing as any).debrief_messages as Message[] | undefined) ?? [];

      if (existingMessages.length > 0) {
        setMessages(sortDebriefMessages(existingMessages));
        return existing.id;
      }
    }

    const opener: Message = {
      id: 'opener',
      role: 'assistant',
      content: buildOpeningMessage(currentRound.total_score, currentRound.par, currentProfile.display_name ?? 'Joueur'),
    };

    const activeSessionId = existing?.id ?? await createSession(currentRound.id, currentUserId);

    if (activeSessionId) {
      setSessionId(activeSessionId);

      const { error: openerError } = await supabase.from('debrief_messages').insert({
        session_id: activeSessionId,
        role: 'assistant',
        content: opener.content,
      });

      if (openerError) {
        console.warn('[debrief] failed to save opener', getErrorCode(openerError));
        setNotice(PERSIST_FAILED_NOTICE);
      }
    } else {
      setNotice(PERSIST_FAILED_NOTICE);
    }

    setMessages((previousMessages) => previousMessages.length === 0 ? [opener] : previousMessages);
    return activeSessionId;
  };

  const createSession = async (currentRoundId: string, currentUserId: string) => {
    const { data: session, error } = await supabase
      .from('debrief_sessions')
      .insert({ user_id: currentUserId, round_id: currentRoundId })
      .select('id')
      .single();

    if (error) {
      console.warn('[debrief] failed to create session', getErrorCode(error));
      return null;
    }

    return session.id as string;
  };

  // Two sequential inserts: a single multi-row insert gives both rows the same created_at,
  // which leaves their order undefined on reload.
  const persistExchange = async (activeSessionId: string, userText: string, assistantText: string) => {
    try {
      const { error: userError } = await supabase
        .from('debrief_messages')
        .insert({ session_id: activeSessionId, role: 'user', content: userText });

      if (userError) {
        console.warn('[debrief] failed to save user message', getErrorCode(userError));
        setNotice(PERSIST_FAILED_NOTICE);
        return;
      }

      const { error: assistantError } = await supabase
        .from('debrief_messages')
        .insert({ session_id: activeSessionId, role: 'assistant', content: assistantText });

      if (assistantError) {
        console.warn('[debrief] failed to save assistant message', getErrorCode(assistantError));
        setNotice(PERSIST_FAILED_NOTICE);
      }
    } catch (error) {
      console.warn('[debrief] failed to save messages', getErrorCode(error));
      setNotice(PERSIST_FAILED_NOTICE);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || loading || !round || !profile || !isPremium) {
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

      const activeSessionId = sessionId ?? await ensureSession();
      if (activeSessionId) {
        await persistExchange(activeSessionId, text, reply);
      } else {
        setNotice(PERSIST_FAILED_NOTICE);
      }
    } catch (error) {
      if (error instanceof AiCoachPremiumRequiredError) {
        useSubscriptionStore.getState().markFree();
        setMessages((previousMessages) => previousMessages.filter((message) => message.id !== userMsg.id));
        setInput(text);
        return;
      }

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

  if (!isPremium) {
    return (
      <View style={styles.container}>
        <DecorativeBackground />
        <DebriefHeader round={round} topInset={insets.top} />

        {subscriptionLoading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator size="small" color={Colors.text} />
          </View>
        ) : (
          <View style={styles.upsell}>
            <AppCard accent="highlight">
              <Text style={styles.summaryEyebrow}>Premium</Text>
              <Text style={styles.summaryTitle}>Le débrief conversationnel est réservé aux abonnés Premium</Text>
              <Text style={styles.summaryText}>
                Discute avec le coach IA après ton round pour isoler les coups qui t’ont coûté des points et savoir sur quoi travailler en priorité.
              </Text>
              <Text style={styles.summaryText}>
                Le diagnostic IA de ton round reste disponible gratuitement.
              </Text>
            </AppCard>
            <AppButton
              label="Découvrir Premium"
              variant="accent"
              onPress={() => router.push('/paywall')}
              style={styles.upsellAction}
            />
          </View>
        )}
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <DecorativeBackground />

      <DebriefHeader round={round} topInset={insets.top} />

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

      {notice ? <Text style={styles.noticeText}>{notice}</Text> : null}

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

function DebriefHeader({ round, topInset }: { round: Round; topInset: number }) {
  return (
    <View style={[styles.header, { paddingTop: topInset + 12 }]}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
        <Text style={styles.backBtnText}>Retour</Text>
      </TouchableOpacity>
      <View style={styles.headerInfo}>
        <Text style={styles.headerTitle}>Débrief IA</Text>
        <Text style={styles.headerSub}>{round.total_score} coups · par {round.par}</Text>
      </View>
    </View>
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
  upsell: {
    padding: 16,
    gap: 12,
  },
  upsellAction: {
    marginTop: 4,
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
  noticeText: {
    color: Colors.warning,
    fontSize: 13,
    paddingHorizontal: 20,
    paddingTop: 8,
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
