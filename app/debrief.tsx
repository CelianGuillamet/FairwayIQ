import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
import { Radius, Spacing, Typography } from '../constants';
import type { ThemeColors } from '../constants';
import { useTheme, useThemedStyles } from '../lib/theme';
import type { Profile, Round } from '../types';
import { AppButton } from '../components/ui/AppButton';
import { AiNotice } from '../components/ui/AiNotice';
import { Icon } from '../components/ui/Icon';
import { NoticeRow } from '../components/rounds-detail/NoticeRow';
import { useKeyboardVisible } from '../components/rounds-detail/useKeyboardVisible';

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
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const keyboardVisible = useKeyboardVisible();
  const [inputFocused, setInputFocused] = useState(false);
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
      <View style={styles.centered}>
        <Text style={styles.errorText}>Round introuvable.</Text>
      </View>
    );
  }

  if (!isPremium) {
    return (
      <View style={styles.container}>
        <DebriefHeader round={round} topInset={insets.top} />

        {subscriptionLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="small" color={colors.ink} />
          </View>
        ) : (
          <>
            <ScrollView contentContainerStyle={styles.upsell}>
              <View style={styles.lockBadge}>
                <Icon name="lock" size={22} color={colors.ink} />
              </View>
              <Text style={styles.upsellTitle} accessibilityRole="header">
                Le débrief conversationnel est réservé aux abonnés Premium
              </Text>
              <Text style={styles.upsellText}>
                Discute avec le coach IA après ton round pour isoler les coups qui t’ont coûté des points et savoir sur quoi travailler en priorité.
              </Text>
              <View style={styles.freeRow}>
                <View style={styles.freeMarker}>
                  <Icon name="check" size={13} strokeWidth={2.5} color={colors.green} />
                </View>
                <Text style={styles.freeText}>
                  Le diagnostic IA de ton round reste disponible gratuitement.
                </Text>
              </View>
            </ScrollView>

            <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, Spacing.sm) }]}>
              <AppButton label="Découvrir Premium" onPress={() => router.push('/paywall')} />
            </View>
          </>
        )}
      </View>
    );
  }

  const canSend = input.trim().length > 0 && !loading;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <DebriefHeader round={round} topInset={insets.top} />

      <AiNotice style={styles.aiNotice} />

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(message) => message.id}
        contentContainerStyle={styles.messageList}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={(
          <View style={styles.intro}>
            <Text style={styles.introTitle}>{round.course_name ?? 'Round enregistré'}</Text>
            <Text style={styles.introText}>
              Utilise ce chat pour isoler les vrais points de bascule du round et clarifier la priorité de travail.
            </Text>
          </View>
        )}
        renderItem={({ item }) => <MessageBubble message={item} />}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
      />

      {notice ? <NoticeRow message={notice} style={styles.notice} /> : null}

      {loading ? (
        <View style={styles.typingRow} accessibilityLiveRegion="polite">
          <ActivityIndicator size="small" color={colors.ink2} />
          <Text style={styles.typingText}>FairwayIQ répond...</Text>
        </View>
      ) : null}

      <View style={[styles.inputBar, { paddingBottom: keyboardVisible ? Spacing.sm : Math.max(insets.bottom, Spacing.sm) }]}>
        <TextInput
          style={[styles.input, inputFocused && styles.inputFocused]}
          placeholder="Pose ta question..."
          placeholderTextColor={colors.ink3}
          selectionColor={colors.ink}
          accessibilityLabel="Message pour le coach IA"
          value={input}
          onChangeText={setInput}
          onFocus={() => setInputFocused(true)}
          onBlur={() => setInputFocused(false)}
          multiline
          maxLength={500}
        />
        <Pressable
          style={({ pressed }) => [styles.sendButton, !canSend && styles.sendButtonDisabled, pressed && canSend && styles.pressed]}
          onPress={() => void sendMessage()}
          disabled={!canSend}
          accessibilityRole="button"
          accessibilityLabel="Envoyer"
          accessibilityState={{ disabled: !canSend, busy: loading }}
        >
          <Icon name="arrow-up" size={22} strokeWidth={2.25} color={canSend ? colors.onRed : colors.ink3} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function DebriefHeader({ round, topInset }: { round: Round; topInset: number }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={[styles.header, { paddingTop: topInset + Spacing.xs }]}>
      <Pressable
        onPress={() => router.back()}
        style={styles.backButton}
        accessibilityRole="button"
        accessibilityLabel="Retour"
      >
        <Icon name="chevron-left" size={24} color={colors.ink} />
      </Pressable>
      <View style={styles.headerInfo}>
        <Text style={styles.headerTitle} accessibilityRole="header">Débrief IA</Text>
        <Text style={styles.headerSub}>{round.total_score} coups · par {round.par}</Text>
      </View>
    </View>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const styles = useThemedStyles(createStyles);
  const isUser = message.role === 'user';

  return (
    <View
      style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}
      accessible
      accessibilityLabel={`${isUser ? 'Message envoyé' : 'Réponse du coach'} : ${message.content}`}
    >
      {!isUser ? <Text style={styles.bubbleLabel}>FairwayIQ</Text> : null}
      <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>{message.content}</Text>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    centered: {
      flex: 1,
      backgroundColor: colors.bg,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: Spacing.xl,
    },
    errorText: {
      ...Typography.bodyStrong,
      color: colors.error,
      textAlign: 'center',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingLeft: Spacing.xs,
      paddingRight: Spacing.md,
      paddingBottom: Spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.line,
      gap: Spacing.xxs,
    },
    backButton: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerInfo: {
      flex: 1,
    },
    headerTitle: {
      ...Typography.titleMd,
      fontSize: 20,
      lineHeight: 24,
      color: colors.ink,
    },
    headerSub: {
      ...Typography.body,
      fontSize: 13,
      lineHeight: 18,
      color: colors.ink2,
    },
    aiNotice: {
      paddingHorizontal: Spacing.md,
      paddingTop: Spacing.xs,
    },
    upsell: {
      padding: Spacing.lg,
      paddingTop: Spacing.xl,
      gap: Spacing.md,
    },
    lockBadge: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.sunk,
      alignItems: 'center',
      justifyContent: 'center',
    },
    upsellTitle: {
      ...Typography.title,
      color: colors.ink,
    },
    upsellText: {
      ...Typography.body,
      fontSize: 16,
      lineHeight: 24,
      color: colors.ink2,
    },
    freeRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: Spacing.sm,
      marginTop: Spacing.xs,
      paddingTop: Spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.line,
    },
    freeMarker: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: colors.greenBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    freeText: {
      ...Typography.body,
      flex: 1,
      color: colors.ink,
    },
    footer: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.line,
      backgroundColor: colors.bg,
    },
    messageList: {
      padding: Spacing.md,
      gap: Spacing.sm,
      paddingBottom: Spacing.xs,
    },
    intro: {
      marginBottom: Spacing.sm,
      gap: Spacing.xxs,
    },
    introTitle: {
      ...Typography.titleMd,
      fontSize: 20,
      lineHeight: 24,
      color: colors.ink,
    },
    introText: {
      ...Typography.body,
      color: colors.ink2,
    },
    bubble: {
      maxWidth: '86%',
      paddingVertical: Spacing.sm,
      paddingHorizontal: 14,
      borderRadius: Radius.xl,
    },
    bubbleAssistant: {
      alignSelf: 'flex-start',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.line,
      borderBottomLeftRadius: Radius.sm,
    },
    bubbleUser: {
      alignSelf: 'flex-end',
      backgroundColor: colors.ink,
      borderBottomRightRadius: Radius.sm,
    },
    bubbleLabel: {
      ...Typography.caption,
      color: colors.ink3,
      marginBottom: 2,
    },
    bubbleText: {
      ...Typography.body,
      lineHeight: 23,
      color: colors.ink,
    },
    bubbleTextUser: {
      color: colors.onInk,
    },
    notice: {
      marginHorizontal: Spacing.md,
      marginTop: Spacing.xs,
    },
    typingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.xs,
      gap: Spacing.xs,
    },
    typingText: {
      ...Typography.body,
      fontSize: 13,
      lineHeight: 18,
      color: colors.ink2,
    },
    inputBar: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      paddingHorizontal: Spacing.md,
      paddingTop: Spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.line,
      backgroundColor: colors.bg,
      gap: Spacing.xs,
    },
    input: {
      ...Typography.body,
      flex: 1,
      minHeight: 44,
      maxHeight: 112,
      fontSize: 16,
      color: colors.ink,
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.line,
      borderRadius: 22,
      paddingHorizontal: Spacing.md,
      paddingTop: 11,
      paddingBottom: 11,
    },
    inputFocused: {
      borderColor: colors.ink,
    },
    sendButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.red,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendButtonDisabled: {
      backgroundColor: colors.sunk,
    },
    pressed: {
      opacity: 0.8,
    },
  });
