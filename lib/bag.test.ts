import {
  BagError,
  CARRY_RANGE_MESSAGE,
  CLUBS,
  countClubs,
  formatClubCount,
  getBagErrorMessage,
  getClubLabel,
  isClubId,
  isValidCarry,
  mapBagError,
  readCarryInput,
  sanitizeCarryText,
  toClubDistances,
} from './bag';

describe('CLUBS', () => {
  it('lists the 14 clubs from the longest to the shortest', () => {
    expect(CLUBS.map((club) => club.id)).toEqual([
      'driver', 'wood3', 'wood5', 'hybrid',
      'iron4', 'iron5', 'iron6', 'iron7', 'iron8', 'iron9',
      'pw', 'gw', 'sw', 'lw',
    ]);
    expect(CLUBS.map((club) => club.label)).toEqual([
      'Driver', 'Bois 3', 'Bois 5', 'Hybride',
      'Fer 4', 'Fer 5', 'Fer 6', 'Fer 7', 'Fer 8', 'Fer 9',
      'Pitching wedge', 'Gap wedge', 'Sand wedge', 'Lob wedge',
    ]);
  });

  it('recognises club ids', () => {
    expect(isClubId('iron7')).toBe(true);
    expect(isClubId('putter')).toBe(false);
    expect(isClubId(undefined)).toBe(false);
    expect(getClubLabel('gw')).toBe('Gap wedge');
  });
});

describe('isValidCarry', () => {
  it('accepts whole meters from 10 to 400', () => {
    expect(isValidCarry(10)).toBe(true);
    expect(isValidCarry(400)).toBe(true);
    expect(isValidCarry(9)).toBe(false);
    expect(isValidCarry(401)).toBe(false);
    expect(isValidCarry(140.5)).toBe(false);
    expect(isValidCarry(Number.NaN)).toBe(false);
    expect(isValidCarry('140')).toBe(false);
    expect(isValidCarry(null)).toBe(false);
  });
});

describe('readCarryInput', () => {
  it('reads an empty field as a cleared club', () => {
    expect(readCarryInput('')).toEqual({ kind: 'empty' });
    expect(readCarryInput('   ')).toEqual({ kind: 'empty' });
  });

  it('reads whole meters in range', () => {
    expect(readCarryInput('140')).toEqual({ kind: 'valid', carryM: 140 });
    expect(readCarryInput(' 10 ')).toEqual({ kind: 'valid', carryM: 10 });
    expect(readCarryInput('400')).toEqual({ kind: 'valid', carryM: 400 });
    expect(readCarryInput('085')).toEqual({ kind: 'valid', carryM: 85 });
  });

  it('flags out of range and malformed values', () => {
    expect(readCarryInput('9')).toEqual({ kind: 'invalid' });
    expect(readCarryInput('0')).toEqual({ kind: 'invalid' });
    expect(readCarryInput('401')).toEqual({ kind: 'invalid' });
    expect(readCarryInput('1400')).toEqual({ kind: 'invalid' });
    expect(readCarryInput('14,5')).toEqual({ kind: 'invalid' });
    expect(readCarryInput('-20')).toEqual({ kind: 'invalid' });
    expect(readCarryInput('abc')).toEqual({ kind: 'invalid' });
  });

  it('states the accepted range in French', () => {
    expect(CARRY_RANGE_MESSAGE).toBe('Saisis une distance entre 10 et 400 m.');
  });
});

describe('sanitizeCarryText', () => {
  it('keeps at most three digits', () => {
    expect(sanitizeCarryText('14a0')).toBe('140');
    expect(sanitizeCarryText('1 4,5')).toBe('145');
    expect(sanitizeCarryText('12345')).toBe('123');
    expect(sanitizeCarryText('m')).toBe('');
  });
});

describe('toClubDistances', () => {
  it('maps rows by club and drops unknown clubs and invalid carries', () => {
    expect(
      toClubDistances([
        { club: 'iron7', carry_m: 140 },
        { club: 'putter', carry_m: 5 },
        { club: 'driver', carry_m: 999 },
        { club: 'pw', carry_m: '100' },
        { club: 'lw', carry_m: 75 },
      ]),
    ).toEqual({ iron7: 140, lw: 75 });
  });

  it('copes with a missing result', () => {
    expect(toClubDistances(null)).toEqual({});
    expect(toClubDistances(undefined)).toEqual({});
  });
});

describe('countClubs / formatClubCount', () => {
  it('counts only valid carries', () => {
    expect(countClubs({})).toBe(0);
    expect(countClubs({ iron7: 140, pw: 100, sw: 5 })).toBe(2);
  });

  it('writes the count in French with the right plural', () => {
    expect(formatClubCount(0)).toBe('Aucun club renseigné');
    expect(formatClubCount(1)).toBe('1 club renseigné');
    expect(formatClubCount(2)).toBe('2 clubs renseignés');
    expect(formatClubCount(14)).toBe('14 clubs renseignés');
  });
});

describe('mapBagError', () => {
  it('maps session and permission codes to the session message', () => {
    for (const code of ['42501', 'PGRST301', 'PGRST302', '28000']) {
      expect(mapBagError({ code, message: 'JWT expired' }, 'save')).toBe('Ta session a expiré. Reconnecte-toi puis réessaie.');
    }
  });

  it('maps constraint violations to the invalid distance message', () => {
    const message = mapBagError({ code: '23514', message: 'violates check constraint "club_distances_carry_m_check"' }, 'save');

    expect(message).toBe('Cette distance n’est pas valide. Saisis une distance entre 10 et 400 m.');
  });

  it('maps network failures to the connection message', () => {
    expect(mapBagError({ message: 'TypeError: Network request failed' }, 'load')).toBe(
      'Connexion impossible. Vérifie ton réseau puis réessaie.',
    );
  });

  it('falls back to a per-action message and never leaks backend text', () => {
    const raw = { code: 'XX000', message: 'relation "club_distances" does not exist' };

    expect(mapBagError(raw, 'load')).toBe('Impossible de charger ton sac pour le moment. Réessaie dans un instant.');
    expect(mapBagError(raw, 'save')).toBe('Impossible d’enregistrer cette distance pour le moment. Réessaie dans un instant.');
    expect(mapBagError(raw, 'remove')).toBe('Impossible d’effacer cette distance pour le moment. Réessaie dans un instant.');
    expect(mapBagError('boom', 'save')).not.toContain('boom');
    expect(mapBagError(null, 'save')).toContain('Impossible');
  });

  it('keeps the message of a BagError and maps anything else', () => {
    expect(getBagErrorMessage(new BagError('Message déjà en français.'), 'save')).toBe('Message déjà en français.');
    expect(getBagErrorMessage(new Error('raw backend text'), 'save')).not.toContain('raw backend text');
  });
});
