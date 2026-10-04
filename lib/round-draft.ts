import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RoundDraftHole } from '../types';
import { isTeeKey, type TeeKey } from './golf-courses';

const ROUND_DRAFT_VERSION = 1;

export type RoundDraftSnapshot = {
  version: typeof ROUND_DRAFT_VERSION;
  savedAt: string;
  courseId: string | null;
  courseName: string;
  holes: 9 | 18;
  teeKey: TeeKey;
  currentHoleNumber: number;
  notes: string;
  scorecard: RoundDraftHole[];
  clientRequestId?: string;
};

function getRoundDraftStorageKey(userId: string) {
  return `fairwayiq:round-draft:${userId}`;
}

function isRoundDraftHole(value: unknown): value is RoundDraftHole {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const hole = value as Record<string, unknown>;

  return typeof hole.hole_number === 'number'
    && typeof hole.par === 'number'
    && typeof hole.score === 'number'
    && typeof hole.putts === 'number'
    && typeof hole.gir === 'boolean'
    && (typeof hole.fairway_hit === 'boolean' || hole.fairway_hit === null)
    && typeof hole.penalty === 'number'
    && typeof hole.completed === 'boolean';
}

function isRoundDraftSnapshot(value: unknown): value is RoundDraftSnapshot {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const snapshot = value as Record<string, unknown>;

  return snapshot.version === ROUND_DRAFT_VERSION
    && typeof snapshot.savedAt === 'string'
    && (typeof snapshot.courseId === 'string' || snapshot.courseId === null)
    && typeof snapshot.courseName === 'string'
    && (snapshot.holes === 9 || snapshot.holes === 18)
    && isTeeKey(snapshot.teeKey)
    && typeof snapshot.currentHoleNumber === 'number'
    && typeof snapshot.notes === 'string'
    && (snapshot.clientRequestId === undefined || typeof snapshot.clientRequestId === 'string')
    && Array.isArray(snapshot.scorecard)
    && snapshot.scorecard.length === snapshot.holes
    && snapshot.currentHoleNumber >= 1
    && snapshot.currentHoleNumber <= snapshot.scorecard.length
    && snapshot.scorecard.every(isRoundDraftHole);
}

export async function loadRoundDraft(userId: string) {
  const rawDraft = await AsyncStorage.getItem(getRoundDraftStorageKey(userId));

  if (!rawDraft) {
    return null;
  }

  try {
    const parsedDraft = JSON.parse(rawDraft) as unknown;

    if (!isRoundDraftSnapshot(parsedDraft)) {
      await AsyncStorage.removeItem(getRoundDraftStorageKey(userId));
      return null;
    }

    return parsedDraft;
  } catch {
    await AsyncStorage.removeItem(getRoundDraftStorageKey(userId));
    return null;
  }
}

export async function saveRoundDraft(userId: string, snapshot: Omit<RoundDraftSnapshot, 'version' | 'savedAt'>) {
  const persistedSnapshot: RoundDraftSnapshot = {
    ...snapshot,
    version: ROUND_DRAFT_VERSION,
    savedAt: new Date().toISOString(),
  };

  await AsyncStorage.setItem(
    getRoundDraftStorageKey(userId),
    JSON.stringify(persistedSnapshot)
  );
}

export async function clearRoundDraft(userId: string) {
  await AsyncStorage.removeItem(getRoundDraftStorageKey(userId));
}
