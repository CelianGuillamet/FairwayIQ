import { buildOpeningMessage, sortDebriefMessages } from './debrief-messages';

describe('buildOpeningMessage', () => {
  it('uses proper French accents', () => {
    const message = buildOpeningMessage(88, 72, 'Camille');

    expect(message).toBe(
      'Bonjour Camille. J’ai analysé ton round de 88 coups (+16). Qu’est-ce qui t’a le plus marqué aujourd’hui ?',
    );
    expect(message).not.toMatch(/analyse ton|marque aujourd/);
  });

  it('omits the plus sign for scores at or under par', () => {
    expect(buildOpeningMessage(72, 72, 'Camille')).toContain('(0)');
    expect(buildOpeningMessage(70, 72, 'Camille')).toContain('(-2)');
  });
});

describe('sortDebriefMessages', () => {
  it('orders by created_at', () => {
    const sorted = sortDebriefMessages([
      { id: 'c', role: 'assistant' as const, created_at: '2026-05-01T10:00:03.000+00:00' },
      { id: 'a', role: 'assistant' as const, created_at: '2026-05-01T10:00:01.000+00:00' },
      { id: 'b', role: 'user' as const, created_at: '2026-05-01T10:00:02.000+00:00' },
    ]);

    expect(sorted.map((message) => message.id)).toEqual(['a', 'b', 'c']);
  });

  it('puts the question before its answer when both rows share a created_at', () => {
    const sharedAt = '2026-05-01T10:00:02.123456+00:00';
    const sorted = sortDebriefMessages([
      { id: 'opener', role: 'assistant' as const, created_at: '2026-05-01T10:00:00.000000+00:00' },
      { id: 'answer', role: 'assistant' as const, created_at: sharedAt },
      { id: 'question', role: 'user' as const, created_at: sharedAt },
    ]);

    expect(sorted.map((message) => message.id)).toEqual(['opener', 'question', 'answer']);
  });

  it('separates rows that differ only below the millisecond', () => {
    const sorted = sortDebriefMessages([
      { id: 'later', role: 'assistant' as const, created_at: '2026-05-01T10:00:02.123789+00:00' },
      { id: 'earlier', role: 'user' as const, created_at: '2026-05-01T10:00:02.123456+00:00' },
    ]);

    expect(sorted.map((message) => message.id)).toEqual(['earlier', 'later']);
  });

  it('does not mutate its input and keeps the order of rows without a date', () => {
    const input = [
      { id: 'a', role: 'assistant' as const },
      { id: 'b', role: 'assistant' as const },
    ];

    expect(sortDebriefMessages(input).map((message) => message.id)).toEqual(['a', 'b']);
    expect(input.map((message) => message.id)).toEqual(['a', 'b']);
  });
});
