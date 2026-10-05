import {
  DEFAULT_RESULT_ATTEMPTS,
  MAX_RESULT_ATTEMPTS,
  compareResults,
  formatResult,
  formatSuccessRate,
  getBestResult,
  getCompletionResult,
  getDefaultAttempts,
  getDrillResults,
  getLastResult,
  getResultThisWeek,
  getSuccessRate,
  isTargetReached,
  parseResult,
  withAttempts,
  withMade,
  type CompletionWithResult,
} from './drill-results';

function completion(
  drillId: string,
  at: Date,
  made: number | null = null,
  attempts: number | null = null,
): CompletionWithResult {
  return { drill_id: drillId, completed_at: at.toISOString(), result_made: made, result_attempts: attempts };
}

const day = (dayOfMonth: number) => new Date(2026, 9, dayOfMonth, 10, 0);

describe('parseResult', () => {
  it('accepts a result within its attempts', () => {
    expect(parseResult(7, 10)).toEqual({ made: 7, attempts: 10 });
    expect(parseResult(0, 10)).toEqual({ made: 0, attempts: 10 });
    expect(parseResult(10, 10)).toEqual({ made: 10, attempts: 10 });
    expect(parseResult(1, 1)).toEqual({ made: 1, attempts: 1 });
  });

  it('rejects more successes than attempts', () => {
    expect(parseResult(11, 10)).toBeNull();
  });

  it('rejects negative successes and empty attempts', () => {
    expect(parseResult(-1, 10)).toBeNull();
    expect(parseResult(0, 0)).toBeNull();
    expect(parseResult(0, -5)).toBeNull();
  });

  it('rejects attempts above the cap', () => {
    expect(parseResult(1, MAX_RESULT_ATTEMPTS)).not.toBeNull();
    expect(parseResult(1, MAX_RESULT_ATTEMPTS + 1)).toBeNull();
  });

  it('rejects fractions, non-numbers and missing values', () => {
    expect(parseResult(6.5, 10)).toBeNull();
    expect(parseResult(6, 10.5)).toBeNull();
    expect(parseResult('7', 10)).toBeNull();
    expect(parseResult(7, null)).toBeNull();
    expect(parseResult(undefined, undefined)).toBeNull();
    expect(parseResult(NaN, 10)).toBeNull();
    expect(parseResult(Infinity, Infinity)).toBeNull();
  });
});

describe('formatResult and formatSuccessRate', () => {
  it('writes a result as made/attempts', () => {
    expect(formatResult({ made: 7, attempts: 10 })).toBe('7/10');
  });

  it('writes a rate as a rounded percentage with a non-breaking space', () => {
    expect(formatSuccessRate(0.7)).toBe('70 %');
    expect(formatSuccessRate(2 / 3)).toBe('67 %');
    expect(formatSuccessRate(0)).toBe('0 %');
    expect(formatSuccessRate(1)).toBe('100 %');
  });
});

describe('getDefaultAttempts', () => {
  it('uses the attempts of the drill', () => {
    expect(getDefaultAttempts(20)).toBe(20);
  });

  it('falls back to 10 when the drill gives none or something unusable', () => {
    expect(getDefaultAttempts(undefined)).toBe(DEFAULT_RESULT_ATTEMPTS);
    expect(getDefaultAttempts(null)).toBe(DEFAULT_RESULT_ATTEMPTS);
    expect(getDefaultAttempts(0)).toBe(DEFAULT_RESULT_ATTEMPTS);
    expect(getDefaultAttempts(2.5)).toBe(DEFAULT_RESULT_ATTEMPTS);
    expect(getDefaultAttempts(MAX_RESULT_ATTEMPTS + 1)).toBe(DEFAULT_RESULT_ATTEMPTS);
  });
});

describe('withAttempts and withMade', () => {
  it('keeps made within the attempts when the attempts go down', () => {
    expect(withAttempts({ made: 9, attempts: 10 }, 7)).toEqual({ made: 7, attempts: 7 });
  });

  it('keeps made when the attempts go up', () => {
    expect(withAttempts({ made: 4, attempts: 10 }, 11)).toEqual({ made: 4, attempts: 11 });
  });

  it('never goes below one attempt or above the cap', () => {
    expect(withAttempts({ made: 0, attempts: 1 }, 0)).toEqual({ made: 0, attempts: 1 });
    expect(withAttempts({ made: 0, attempts: 100 }, 101)).toEqual({ made: 0, attempts: MAX_RESULT_ATTEMPTS });
  });

  it('keeps made between zero and the attempts', () => {
    expect(withMade({ made: 0, attempts: 10 }, -1)).toEqual({ made: 0, attempts: 10 });
    expect(withMade({ made: 10, attempts: 10 }, 11)).toEqual({ made: 10, attempts: 10 });
    expect(withMade({ made: 3, attempts: 10 }, 4)).toEqual({ made: 4, attempts: 10 });
  });

  it('always produces a result that parseResult accepts', () => {
    for (const attempts of [-3, 0, 1, 9, 100, 250]) {
      for (const made of [-2, 0, 5, 300]) {
        const result = withMade(withAttempts({ made: 0, attempts: 10 }, attempts), made);

        expect(parseResult(result.made, result.attempts)).toEqual(result);
      }
    }
  });
});

describe('getCompletionResult', () => {
  it('reads the result of a completion', () => {
    expect(getCompletionResult(completion('1', day(1), 7, 10))).toEqual({ made: 7, attempts: 10 });
  });

  it('returns null for a completion without result, including rows from before the columns existed', () => {
    expect(getCompletionResult(completion('1', day(1)))).toBeNull();
    expect(getCompletionResult({ drill_id: '1', completed_at: day(1).toISOString() })).toBeNull();
  });

  it('ignores a result that breaks the rules instead of showing it', () => {
    expect(getCompletionResult(completion('1', day(1), 12, 10))).toBeNull();
    expect(getCompletionResult(completion('1', day(1), 7, null))).toBeNull();
  });
});

describe('getDrillResults and getLastResult', () => {
  const completions = [
    completion('1', day(1), 5, 10),
    completion('1', day(3), 7, 10),
    completion('1', day(2)),
    completion('2', day(4), 9, 10),
  ];

  it('lists the results of one drill, newest first, skipping completions without result', () => {
    expect(getDrillResults('1', completions)).toEqual([
      { made: 7, attempts: 10 },
      { made: 5, attempts: 10 },
    ]);
  });

  it('does not depend on the order of the completions', () => {
    expect(getDrillResults('1', [...completions].reverse())).toEqual(getDrillResults('1', completions));
  });

  it('returns the most recent result', () => {
    expect(getLastResult('1', completions)).toEqual({ made: 7, attempts: 10 });
  });

  it('skips a newer completion that has no result', () => {
    expect(getLastResult('1', [completion('1', day(6)), ...completions])).toEqual({ made: 7, attempts: 10 });
  });

  it('returns null when the drill has no result', () => {
    expect(getLastResult('1', [completion('1', day(1))])).toBeNull();
    expect(getLastResult('3', completions)).toBeNull();
    expect(getLastResult('1', [])).toBeNull();
  });
});

describe('compareResults and getBestResult', () => {
  it('compares by success rate, not by raw count', () => {
    expect(compareResults({ made: 8, attempts: 10 }, { made: 9, attempts: 20 })).toBeGreaterThan(0);
    expect(compareResults({ made: 6, attempts: 10 }, { made: 7, attempts: 10 })).toBeLessThan(0);
  });

  it('breaks a tie in favour of more attempts', () => {
    expect(compareResults({ made: 18, attempts: 20 }, { made: 9, attempts: 10 })).toBeGreaterThan(0);
    expect(compareResults({ made: 9, attempts: 10 }, { made: 9, attempts: 10 })).toBe(0);
  });

  it('picks the best rate across sessions', () => {
    const completions = [
      completion('1', day(1), 9, 10),
      completion('1', day(2), 7, 10),
      completion('1', day(3), 10, 20),
    ];

    expect(getBestResult('1', completions)).toEqual({ made: 9, attempts: 10 });
  });

  it('prefers the larger session when two rates are equal', () => {
    const completions = [completion('1', day(1), 9, 10), completion('1', day(2), 18, 20)];

    expect(getBestResult('1', completions)).toEqual({ made: 18, attempts: 20 });
  });

  it('returns null without results', () => {
    expect(getBestResult('1', [completion('1', day(1))])).toBeNull();
  });
});

describe('getSuccessRate', () => {
  it('weights every session by its attempts', () => {
    const completions = [completion('1', day(1), 5, 10), completion('1', day(2), 15, 20)];

    expect(getSuccessRate('1', completions)).toBeCloseTo(20 / 30);
  });

  it('is exact for a single session', () => {
    expect(getSuccessRate('1', [completion('1', day(1), 7, 10)])).toBeCloseTo(0.7);
  });

  it('can be zero', () => {
    expect(getSuccessRate('1', [completion('1', day(1), 0, 10)])).toBe(0);
  });

  it('ignores completions without result and other drills', () => {
    const completions = [completion('1', day(1)), completion('2', day(1), 10, 10)];

    expect(getSuccessRate('1', completions)).toBeNull();
  });
});

describe('isTargetReached', () => {
  const target = { attempts: 10, success_threshold: 6 };

  it('is true at and above the threshold', () => {
    expect(isTargetReached({ made: 6, attempts: 10 }, target)).toBe(true);
    expect(isTargetReached({ made: 9, attempts: 10 }, target)).toBe(true);
  });

  it('is false below the threshold', () => {
    expect(isTargetReached({ made: 5, attempts: 10 }, target)).toBe(false);
  });

  it('scales the threshold when the player recorded other attempts', () => {
    expect(isTargetReached({ made: 12, attempts: 20 }, target)).toBe(true);
    expect(isTargetReached({ made: 11, attempts: 20 }, target)).toBe(false);
    expect(isTargetReached({ made: 3, attempts: 5 }, target)).toBe(true);
  });
});

describe('getResultThisWeek', () => {
  const now = new Date(2026, 9, 7, 12, 0);

  it('returns the latest result recorded since Monday', () => {
    const completions = [completion('1', new Date(2026, 9, 5, 9, 0), 4, 10), completion('1', new Date(2026, 9, 6, 9, 0), 8, 10)];

    expect(getResultThisWeek('1', completions, now)).toEqual({ made: 8, attempts: 10 });
  });

  it('ignores a result from a previous week', () => {
    const lastWeek = completion('1', new Date(2026, 9, 4, 20, 0), 9, 10);

    expect(getResultThisWeek('1', [lastWeek], now)).toBeNull();
  });

  it('returns null when this week completion has no result', () => {
    const completions = [completion('1', new Date(2026, 9, 6, 9, 0)), completion('1', new Date(2026, 9, 4, 20, 0), 9, 10)];

    expect(getResultThisWeek('1', completions, now)).toBeNull();
  });
});
