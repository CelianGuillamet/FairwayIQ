import { parseDiagnosisParam, parseDiagnosticResult } from './diagnostic-shape';

const VALID = {
  strengths: ['Bon putting'],
  weaknesses: ['Départs irréguliers'],
  weekly_plan: 'Travailler les départs.',
  raw_analysis: 'Round solide.',
  recommended_categories: ['putting', 'driving'],
};

describe('parseDiagnosticResult', () => {
  it('accepts a well-formed diagnostic', () => {
    expect(parseDiagnosticResult(VALID)).toEqual(VALID);
  });

  it('defaults to no recommended categories when they are missing', () => {
    const { recommended_categories: _omitted, ...rest } = VALID;

    expect(parseDiagnosticResult(rest)?.recommended_categories).toEqual([]);
  });

  it('drops unknown and duplicate categories', () => {
    const parsed = parseDiagnosticResult({
      ...VALID,
      recommended_categories: ['putting', 'putting', 'hack', 42, null],
    });

    expect(parsed?.recommended_categories).toEqual(['putting']);
  });

  it('caps list length and text length', () => {
    const parsed = parseDiagnosticResult({
      ...VALID,
      strengths: Array.from({ length: 50 }, (_, index) => `s${index}`),
      raw_analysis: 'x'.repeat(10000),
    });

    expect(parsed?.strengths).toHaveLength(10);
    expect(parsed?.raw_analysis).toHaveLength(4000);
  });

  it.each([
    ['null', null],
    ['an array', []],
    ['a string', 'text'],
    ['missing raw_analysis', { ...VALID, raw_analysis: undefined }],
    ['numeric weekly_plan', { ...VALID, weekly_plan: 12 }],
    ['strengths that is not a list', { ...VALID, strengths: 'nope' }],
    ['strengths with a non-string item', { ...VALID, strengths: ['ok', { evil: true }] }],
    ['missing weaknesses', { ...VALID, weaknesses: undefined }],
  ])('rejects %s', (_label, value) => {
    expect(parseDiagnosticResult(value)).toBeNull();
  });
});

describe('parseDiagnosisParam', () => {
  it('parses a JSON param', () => {
    expect(parseDiagnosisParam(JSON.stringify(VALID))).toEqual(VALID);
  });

  it('uses the first value of a repeated param', () => {
    expect(parseDiagnosisParam([JSON.stringify(VALID), 'garbage'])).toEqual(VALID);
  });

  it.each([
    ['undefined', undefined],
    ['empty', ''],
    ['not JSON', '{oops'],
    ['JSON of the wrong shape', '{"strengths":1}'],
    ['JSON null', 'null'],
    ['oversized', JSON.stringify({ ...VALID, raw_analysis: 'x'.repeat(30000) })],
  ])('returns null for %s', (_label, value) => {
    expect(parseDiagnosisParam(value)).toBeNull();
  });
});
