import type { Diagnostic, Profile, Round, RoundHole } from '../types';
import {
  buildExportDocument,
  exportFileName,
  getExportFileType,
  serializeExportDocument,
  type ExportSource,
} from './export-document';

const USER_ID = 'user-1';
const NOW = new Date(2026, 9, 5, 9, 15, 30);

function round(overrides: Partial<Round> = {}): Round {
  return {
    id: 'round-1',
    user_id: USER_ID,
    played_at: new Date(2026, 9, 3, 14, 30).toISOString(),
    course_id: null,
    course_name: 'Golf de Test',
    course_provider: null,
    provider_course_id: null,
    tee_key: 'yellow',
    tee_set_id: null,
    tee_name: 'Jaune',
    tee_color: null,
    total_score: 90,
    par: 72,
    holes: 18,
    putts: 33,
    gir: 7,
    fairways_hit: 8,
    fairways_total: 14,
    penalties: 2,
    notes: null,
    created_at: '2026-10-03T18:00:00.000Z',
    ...overrides,
  };
}

function hole(roundId: string, holeNumber: number, overrides: Partial<RoundHole> = {}): RoundHole {
  return {
    id: `${roundId}-hole-${holeNumber}`,
    round_id: roundId,
    user_id: USER_ID,
    hole_number: holeNumber,
    par: 4,
    score: 5,
    putts: 2,
    gir: false,
    fairway_hit: true,
    penalty: 0,
    created_at: '2026-10-03T18:00:00.000Z',
    ...overrides,
  };
}

function diagnostic(id: string, roundId: string | null, overrides: Partial<Diagnostic> = {}): Diagnostic {
  return {
    id,
    user_id: USER_ID,
    round_id: roundId,
    strengths: ['Putting'],
    weaknesses: ['Driving'],
    weekly_plan: 'Plan',
    raw_analysis: 'Analyse',
    recommended_categories: ['driving'],
    created_at: '2026-10-04T08:00:00.000Z',
    ...overrides,
  };
}

const PROFILE: Profile = {
  id: 'profile-1',
  user_id: USER_ID,
  display_name: 'Camille',
  handicap: 18,
  play_frequency: 'weekly',
  goal: 'consistency',
  onboarding_complete: true,
  created_at: '2026-09-01T10:00:00.000Z',
};

function source(overrides: Partial<ExportSource> = {}): ExportSource {
  return {
    user: { id: USER_ID, email: 'camille@example.com' },
    profile: PROFILE,
    subscription: { is_premium: true, plan: 'annual', expires_at: '2027-01-01T00:00:00.000Z', updated_at: '2026-09-02T00:00:00.000Z' },
    rounds: [],
    roundHoles: [],
    diagnostics: [],
    drillCompletions: [],
    badges: [],
    clubDistances: [],
    debriefSessions: [],
    debriefMessages: [],
    ...overrides,
  };
}

const CONTEXT = { now: NOW, appVersion: '1.0.0' };

describe('exportFileName', () => {
  it('names the JSON export with the local date', () => {
    expect(exportFileName('json', NOW)).toBe('fairwayiq-donnees-2026-10-05.json');
  });

  it('names the CSV export with the local date', () => {
    expect(exportFileName('csv', NOW)).toBe('fairwayiq-rounds-2026-10-05.csv');
  });

  it('pads the month and the day', () => {
    expect(exportFileName('json', new Date(2026, 0, 2, 23, 59))).toBe('fairwayiq-donnees-2026-01-02.json');
  });

  it('only uses characters that are safe in a file name', () => {
    expect(exportFileName('json', NOW)).toMatch(/^[a-z0-9-]+\.json$/);
    expect(exportFileName('csv', NOW)).toMatch(/^[a-z0-9-]+\.csv$/);
  });
});

describe('getExportFileType', () => {
  it('gives each format its media type and UTI', () => {
    expect(getExportFileType('json')).toEqual({ mimeType: 'application/json', uti: 'public.json' });
    expect(getExportFileType('csv')).toEqual({ mimeType: 'text/csv', uti: 'public.comma-separated-values-text' });
  });
});

describe('buildExportDocument', () => {
  it('has the documented top-level structure', () => {
    const document = buildExportDocument(source(), CONTEXT);

    expect(Object.keys(document)).toEqual([
      'exportedAt',
      'app',
      'account',
      'profile',
      'subscription',
      'rounds',
      'diagnosticsWithoutRound',
      'drills',
      'badges',
      'bag',
      'debriefs',
    ]);
    expect(document.exportedAt).toBe(NOW.toISOString());
    expect(document.app).toEqual({ name: 'FairwayIQ', version: '1.0.0' });
  });

  it('keeps the app version null when it is unknown', () => {
    expect(buildExportDocument(source(), { now: NOW, appVersion: null }).app.version).toBeNull();
  });

  it('includes the account email and the profile without repeating the user id', () => {
    const document = buildExportDocument(source(), CONTEXT);

    expect(document.account).toEqual({ id: USER_ID, email: 'camille@example.com' });
    expect(document.profile).toEqual({
      id: 'profile-1',
      display_name: 'Camille',
      handicap: 18,
      play_frequency: 'weekly',
      goal: 'consistency',
      onboarding_complete: true,
      created_at: '2026-09-01T10:00:00.000Z',
    });
  });

  it('copes with a missing profile, subscription and email', () => {
    const document = buildExportDocument(
      source({ profile: null, subscription: null, user: { id: USER_ID, email: null } }),
      CONTEXT,
    );

    expect(document.profile).toBeNull();
    expect(document.subscription).toBeNull();
    expect(document.account.email).toBeNull();
    expect(document.rounds).toEqual([]);
    expect(document.drills).toEqual([]);
    expect(document.badges).toEqual([]);
    expect(document.bag).toEqual([]);
    expect(document.debriefs).toEqual([]);
  });

  it('reports the subscription status and nothing else from its row', () => {
    const row = {
      is_premium: true,
      plan: 'monthly',
      expires_at: '2026-12-01T00:00:00.000Z',
      updated_at: '2026-11-01T00:00:00.000Z',
      last_event_at: '2026-11-01T00:00:00.000Z',
    };

    expect(buildExportDocument(source({ subscription: row }), CONTEXT).subscription).toEqual({
      is_premium: true,
      plan: 'monthly',
      expires_at: '2026-12-01T00:00:00.000Z',
      updated_at: '2026-11-01T00:00:00.000Z',
    });
  });

  it('copies only the id and email of the session user', () => {
    const sessionUser = {
      id: USER_ID,
      email: 'camille@example.com',
      access_token: 'secret-access',
      refresh_token: 'secret-refresh',
      encrypted_password: 'secret-hash',
      app_metadata: { provider: 'email' },
    };
    const json = serializeExportDocument(buildExportDocument(source({ user: sessionUser }), CONTEXT));

    expect(json).not.toMatch(/secret|access_token|refresh_token|password|app_metadata/);
    expect(JSON.parse(json).account).toEqual({ id: USER_ID, email: 'camille@example.com' });
  });

  it('nests each round with its scorecard in hole order and its diagnostic', () => {
    const document = buildExportDocument(
      source({
        rounds: [round()],
        roundHoles: [hole('round-1', 3), hole('round-1', 1), hole('round-1', 2)],
        diagnostics: [diagnostic('diag-1', 'round-1')],
      }),
      CONTEXT,
    );

    expect(document.rounds).toHaveLength(1);
    const [entry] = document.rounds;

    expect(entry.scorecard.map((item) => item.hole_number)).toEqual([1, 2, 3]);
    expect(entry.diagnostic).toMatchObject({ id: 'diag-1', strengths: ['Putting'], weekly_plan: 'Plan' });
    expect(entry).not.toHaveProperty('user_id');
    expect(entry.scorecard[0]).not.toHaveProperty('user_id');
    expect(entry.scorecard[0]).not.toHaveProperty('round_id');
    expect(entry.diagnostic).not.toHaveProperty('user_id');
    expect(entry.diagnostic).not.toHaveProperty('round_id');
  });

  it('keeps the number of holes played next to the scorecard', () => {
    const [nineHoles] = buildExportDocument(
      source({ rounds: [round({ holes: 9 })], roundHoles: [hole('round-1', 1)] }),
      CONTEXT,
    ).rounds;

    expect(nineHoles.holes).toBe(9);
    expect(nineHoles.scorecard).toHaveLength(1);
  });

  it('gives a round saved without a scorecard an empty one and no diagnostic', () => {
    const [entry] = buildExportDocument(source({ rounds: [round()] }), CONTEXT).rounds;

    expect(entry.scorecard).toEqual([]);
    expect(entry.diagnostic).toBeNull();
  });

  it('only attaches holes and diagnostics to their own round', () => {
    const document = buildExportDocument(
      source({
        rounds: [
          round({ id: 'round-1', played_at: '2026-10-03T12:00:00.000Z' }),
          round({ id: 'round-2', played_at: '2026-10-01T12:00:00.000Z' }),
        ],
        roundHoles: [hole('round-1', 1), hole('round-2', 1), hole('round-2', 2)],
        diagnostics: [diagnostic('diag-2', 'round-2')],
      }),
      CONTEXT,
    );

    expect(document.rounds.map((entry) => [entry.id, entry.scorecard.length, entry.diagnostic?.id ?? null])).toEqual([
      ['round-1', 1, null],
      ['round-2', 2, 'diag-2'],
    ]);
  });

  it('lists rounds newest first', () => {
    const document = buildExportDocument(
      source({
        rounds: [
          round({ id: 'a', played_at: '2026-08-01T10:00:00.000Z' }),
          round({ id: 'b', played_at: '2026-10-01T10:00:00.000Z' }),
          round({ id: 'c', played_at: '2026-09-01T10:00:00.000Z' }),
        ],
      }),
      CONTEXT,
    );

    expect(document.rounds.map((entry) => entry.id)).toEqual(['b', 'c', 'a']);
  });

  it('keeps the newest diagnostic of a round and lists the others apart', () => {
    const document = buildExportDocument(
      source({
        rounds: [round()],
        diagnostics: [
          diagnostic('old', 'round-1', { created_at: '2026-10-03T08:00:00.000Z' }),
          diagnostic('new', 'round-1', { created_at: '2026-10-04T08:00:00.000Z' }),
        ],
      }),
      CONTEXT,
    );

    expect(document.rounds[0].diagnostic?.id).toBe('new');
    expect(document.diagnosticsWithoutRound.map((item) => item.id)).toEqual(['old']);
  });

  it('keeps diagnostics whose round was deleted', () => {
    const document = buildExportDocument(
      source({
        rounds: [round()],
        diagnostics: [
          diagnostic('orphan', null, { created_at: '2026-09-10T08:00:00.000Z' }),
          diagnostic('dangling', 'round-gone', { created_at: '2026-09-11T08:00:00.000Z' }),
        ],
      }),
      CONTEXT,
    );

    expect(document.rounds[0].diagnostic).toBeNull();
    expect(document.diagnosticsWithoutRound.map((item) => [item.id, item.round_id])).toEqual([
      ['orphan', null],
      ['dangling', 'round-gone'],
    ]);
    expect(document.diagnosticsWithoutRound[0]).not.toHaveProperty('user_id');
  });

  it('lists drill completions oldest first with the drill title and the result', () => {
    const document = buildExportDocument(
      source({
        drillCompletions: [
          {
            id: 'c2',
            user_id: USER_ID,
            drill_id: '1',
            completed_at: '2026-10-02T10:00:00.000Z',
            result_made: 7,
            result_attempts: 10,
          },
          {
            id: 'c1',
            user_id: USER_ID,
            drill_id: 'inconnu',
            completed_at: '2026-10-01T10:00:00.000Z',
            result_made: null,
            result_attempts: null,
          },
        ],
      }),
      CONTEXT,
    );

    expect(document.drills).toEqual([
      {
        drill_id: 'inconnu',
        title: null,
        completed_at: '2026-10-01T10:00:00.000Z',
        result_made: null,
        result_attempts: null,
      },
      {
        drill_id: '1',
        title: expect.any(String),
        completed_at: '2026-10-02T10:00:00.000Z',
        result_made: 7,
        result_attempts: 10,
      },
    ]);
    expect(document.drills[1].title).not.toBe('');
  });

  it('writes a missing drill result as null', () => {
    const [drill] = buildExportDocument(
      source({
        drillCompletions: [
          { id: 'c1', user_id: USER_ID, drill_id: '1', completed_at: '2026-10-01T10:00:00.000Z' } as never,
        ],
      }),
      CONTEXT,
    ).drills;

    expect(drill.result_made).toBeNull();
    expect(drill.result_attempts).toBeNull();
  });

  it('lists earned badges oldest first with their title', () => {
    const document = buildExportDocument(
      source({
        badges: [
          { id: 'b2', user_id: USER_ID, badge_id: 'rounds_5', earned_at: '2026-10-02T10:00:00.000Z' },
          { id: 'b1', user_id: USER_ID, badge_id: 'first_round', earned_at: '2026-10-01T10:00:00.000Z' },
          { id: 'b3', user_id: USER_ID, badge_id: 'badge_futur', earned_at: '2026-10-03T10:00:00.000Z' },
        ],
      }),
      CONTEXT,
    );

    expect(document.badges).toEqual([
      { badge_id: 'first_round', title: 'Premier round', earned_at: '2026-10-01T10:00:00.000Z' },
      { badge_id: 'rounds_5', title: '5 rounds', earned_at: '2026-10-02T10:00:00.000Z' },
      { badge_id: 'badge_futur', title: null, earned_at: '2026-10-03T10:00:00.000Z' },
    ]);
  });

  it('lists the bag in club order with readable labels', () => {
    const document = buildExportDocument(
      source({
        clubDistances: [
          { id: 'k3', user_id: USER_ID, club: 'sw', carry_m: 80, updated_at: '2026-10-01T10:00:00.000Z' },
          { id: 'k1', user_id: USER_ID, club: 'driver', carry_m: 220, updated_at: '2026-10-01T10:00:00.000Z' },
          { id: 'k2', user_id: USER_ID, club: 'iron7', carry_m: 140, updated_at: '2026-10-01T10:00:00.000Z' },
        ],
      }),
      CONTEXT,
    );

    expect(document.bag.map((club) => [club.club, club.label, club.carry_m])).toEqual([
      ['driver', 'Driver', 220],
      ['iron7', 'Fer 7', 140],
      ['sw', 'Sand wedge', 80],
    ]);
  });

  it('groups debrief messages under their session in chronological order', () => {
    const document = buildExportDocument(
      source({
        debriefSessions: [
          { id: 's2', user_id: USER_ID, round_id: 'round-2', created_at: '2026-10-02T10:00:00.000Z' },
          { id: 's1', user_id: USER_ID, round_id: 'round-1', created_at: '2026-10-01T10:00:00.000Z' },
        ],
        debriefMessages: [
          { id: 'm3', session_id: 's1', role: 'assistant', content: 'Réponse', created_at: '2026-10-01T10:00:02.000Z' },
          { id: 'm1', session_id: 's1', role: 'user', content: 'Question', created_at: '2026-10-01T10:00:01.000Z' },
          { id: 'm4', session_id: 's2', role: 'user', content: 'Autre', created_at: '2026-10-02T10:00:01.000Z' },
        ],
      }),
      CONTEXT,
    );

    expect(document.debriefs.map((debrief) => debrief.id)).toEqual(['s1', 's2']);
    expect(document.debriefs[0].messages).toEqual([
      { role: 'user', content: 'Question', created_at: '2026-10-01T10:00:01.000Z' },
      { role: 'assistant', content: 'Réponse', created_at: '2026-10-01T10:00:02.000Z' },
    ]);
    expect(document.debriefs[1].messages).toHaveLength(1);
    expect(document.debriefs[0]).not.toHaveProperty('user_id');
  });

  it('drops debrief messages that belong to no session of the user', () => {
    const document = buildExportDocument(
      source({
        debriefSessions: [{ id: 's1', user_id: USER_ID, round_id: 'round-1', created_at: '2026-10-01T10:00:00.000Z' }],
        debriefMessages: [
          { id: 'm1', session_id: 's1', role: 'user', content: 'À moi', created_at: '2026-10-01T10:00:01.000Z' },
          { id: 'm2', session_id: 'someone-else', role: 'user', content: 'Pas à moi', created_at: '2026-10-01T10:00:02.000Z' },
        ],
      }),
      CONTEXT,
    );

    expect(JSON.stringify(document)).not.toContain('Pas à moi');
    expect(document.debriefs[0].messages.map((message) => message.content)).toEqual(['À moi']);
  });

  it('does not reorder or mutate the source', () => {
    const rounds = [
      round({ id: 'old', played_at: '2026-01-01T10:00:00.000Z' }),
      round({ id: 'new', played_at: '2026-06-01T10:00:00.000Z' }),
    ];
    const input = source({ rounds, roundHoles: [hole('new', 2), hole('new', 1)] });

    buildExportDocument(input, CONTEXT);

    expect(rounds.map((entry) => entry.id)).toEqual(['old', 'new']);
    expect(input.roundHoles.map((entry) => entry.hole_number)).toEqual([2, 1]);
    expect(input.rounds[0]).toHaveProperty('user_id');
  });
});

describe('serializeExportDocument', () => {
  it('writes readable JSON ending with a newline and round-trips', () => {
    const document = buildExportDocument(source({ rounds: [round({ notes: 'Accents : é à ç, “guillemets”\nsur deux lignes' })] }), CONTEXT);
    const json = serializeExportDocument(document);

    expect(json.startsWith('{\n  "exportedAt"')).toBe(true);
    expect(json.endsWith('}\n')).toBe(true);
    expect(JSON.parse(json)).toEqual(JSON.parse(JSON.stringify(document)));
    expect(JSON.parse(json).rounds[0].notes).toBe('Accents : é à ç, “guillemets”\nsur deux lignes');
  });

  it('has no BOM, which JSON parsers reject', () => {
    expect(serializeExportDocument(buildExportDocument(source(), CONTEXT)).charCodeAt(0)).toBe('{'.charCodeAt(0));
  });
});
