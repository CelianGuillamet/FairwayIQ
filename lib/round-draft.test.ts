import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearRoundDraft, loadRoundDraft, saveRoundDraft } from './round-draft';
import { createDefaultScorecard } from './rounds';

jest.mock('./supabase', () => ({ supabase: {} }));

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

const baseDraft = {
  courseId: null,
  courseName: 'Golf de Test',
  holes: 18 as const,
  teeKey: 'yellow' as const,
  currentHoleNumber: 3,
  notes: '',
  scorecard: createDefaultScorecard(18),
};

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('round draft', () => {
  it('round-trips the client request id used to make the final save idempotent', async () => {
    await saveRoundDraft('user-1', { ...baseDraft, clientRequestId: '11111111-1111-4111-8111-111111111111' });

    const draft = await loadRoundDraft('user-1');

    expect(draft?.clientRequestId).toBe('11111111-1111-4111-8111-111111111111');
    expect(draft?.courseName).toBe('Golf de Test');
  });

  it('still loads a draft saved before the client request id existed', async () => {
    await saveRoundDraft('user-1', baseDraft);

    const draft = await loadRoundDraft('user-1');

    expect(draft).not.toBeNull();
    expect(draft?.clientRequestId).toBeUndefined();
  });

  it('discards a draft whose client request id is not a string', async () => {
    await saveRoundDraft('user-1', { ...baseDraft, clientRequestId: 42 as unknown as string });

    expect(await loadRoundDraft('user-1')).toBeNull();
    expect(await AsyncStorage.getItem('fairwayiq:round-draft:user-1')).toBeNull();
  });

  it('clears the stored draft', async () => {
    await saveRoundDraft('user-1', baseDraft);
    await clearRoundDraft('user-1');

    expect(await loadRoundDraft('user-1')).toBeNull();
  });
});
