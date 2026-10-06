import { FAQ_ITEMS } from './help-faq';
import { MAX_QUEUE_SIZE } from './round-save-queue';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

describe('FAQ_ITEMS', () => {
  it('holds between 6 and 8 questions', () => {
    expect(FAQ_ITEMS.length).toBeGreaterThanOrEqual(6);
    expect(FAQ_ITEMS.length).toBeLessThanOrEqual(8);
  });

  it('gives every entry a unique id, a question and an answer', () => {
    const ids = FAQ_ITEMS.map((item) => item.id);

    expect(new Set(ids).size).toBe(ids.length);
    for (const item of FAQ_ITEMS) {
      expect(item.id).toMatch(/^[a-z]+$/);
      expect(item.question.trim()).toBe(item.question);
      expect(item.question.endsWith('?')).toBe(true);
      expect(item.answer.trim()).toBe(item.answer);
      expect(item.answer.length).toBeGreaterThan(80);
    }
  });

  it('keeps questions unique', () => {
    const questions = FAQ_ITEMS.map((item) => item.question);
    expect(new Set(questions).size).toBe(questions.length);
  });

  it('covers the documented topics', () => {
    expect(FAQ_ITEMS.map((item) => item.id)).toEqual(
      expect.arrayContaining(['offline', 'handicap', 'gps', 'reminders', 'data', 'premium', 'password']),
    );
  });

  it('states the limits of the estimates', () => {
    const answer = (id: string) => FAQ_ITEMS.find((item) => item.id === id)?.answer ?? '';

    expect(answer('handicap')).toContain('WHS');
    expect(answer('handicap')).toContain('pas officiel');
    expect(answer('gps')).toContain('estimations');
  });

  it('quotes the real offline queue size', () => {
    const offline = FAQ_ITEMS.find((item) => item.id === 'offline');
    expect(offline?.answer).toContain(`${MAX_QUEUE_SIZE} en attente`);
  });

  it('never mentions an email address or a way to contact support', () => {
    for (const item of FAQ_ITEMS) {
      const text = `${item.question} ${item.answer}`.toLowerCase();

      expect(text).not.toContain('@');
      expect(text).not.toMatch(/support|contacte|écris-nous|ecris-nous/);
    }
  });

  it('writes in French sentence case without emoji', () => {
    for (const item of FAQ_ITEMS) {
      expect(item.question[0]).toBe(item.question[0].toUpperCase());
      expect(`${item.question}${item.answer}`).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });
});
