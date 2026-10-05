import type { ClubDistances } from './bag';
import { adviseClub, describeAdviceReadiness, describeClubAdvice, formatClubAdvice, MIN_CLUBS_FOR_ADVICE, type ClubAdvice } from './club-advice';

const BAG: ClubDistances = {
  driver: 230,
  wood3: 210,
  iron5: 165,
  iron6: 155,
  iron7: 145,
  iron8: 135,
  iron9: 125,
  pw: 110,
  sw: 85,
};

describe('adviseClub', () => {
  it('recommends the club whose carry is closest to the distance', () => {
    expect(adviseClub(146, BAG)).toEqual({ club: 'iron7', label: 'Fer 7', carryM: 145, gapM: -1 });
    expect(adviseClub(131, BAG)).toMatchObject({ club: 'iron8', carryM: 135, gapM: 4 });
    expect(adviseClub(212, BAG)).toMatchObject({ club: 'wood3', gapM: -2 });
  });

  it('reports a positive gap when the club carries past the distance', () => {
    expect(adviseClub(142, BAG)).toMatchObject({ club: 'iron7', carryM: 145, gapM: 3 });
  });

  it('prefers the longer club when the closest two are tied', () => {
    expect(adviseClub(140, BAG)).toMatchObject({ club: 'iron7', carryM: 145, gapM: 5 });
    expect(adviseClub(150, BAG)).toMatchObject({ club: 'iron6', carryM: 155 });
  });

  it('prefers the longer club when another carry sits within 3 m of the closest one', () => {
    const bag: ClubDistances = { iron4: 168, hybrid: 170, iron6: 150, pw: 110 };

    expect(adviseClub(168, bag)).toMatchObject({ club: 'hybrid', carryM: 170, gapM: 2 });
    expect(adviseClub(169, bag)).toMatchObject({ club: 'hybrid', carryM: 170 });
  });

  it('keeps the closest club when the longer one is more than 3 m further', () => {
    const bag: ClubDistances = { iron4: 168, hybrid: 172, iron6: 150, pw: 110 };

    expect(adviseClub(168, bag)).toMatchObject({ club: 'iron4', carryM: 168, gapM: 0 });
  });

  it('does not jump to a longer club that is far from the distance', () => {
    expect(adviseClub(144, BAG)).toMatchObject({ club: 'iron7' });
    expect(adviseClub(137, BAG)).toMatchObject({ club: 'iron8' });
  });

  it('breaks an equal carry by the first club in bag order', () => {
    const bag: ClubDistances = { hybrid: 150, iron4: 150, pw: 100 };

    expect(adviseClub(150, bag)).toMatchObject({ club: 'hybrid' });
  });

  it('returns null with fewer than 3 clubs filled', () => {
    expect(MIN_CLUBS_FOR_ADVICE).toBe(3);
    expect(adviseClub(140, {})).toBeNull();
    expect(adviseClub(140, { iron7: 140 })).toBeNull();
    expect(adviseClub(140, { iron7: 140, iron8: 130 })).toBeNull();
    expect(adviseClub(140, { iron7: 140, iron8: 130, iron9: 120 })).not.toBeNull();
  });

  it('ignores clubs with an invalid carry when counting the bag', () => {
    const bag = { iron7: 140, iron8: 130, iron9: 5, pw: Number.NaN, sw: 450, lw: 100.5 } as ClubDistances;

    expect(adviseClub(135, bag)).toBeNull();
  });

  it('returns null when the distance is shorter than the shortest carry by more than 15 m', () => {
    expect(adviseClub(70, BAG)).toMatchObject({ club: 'sw' });
    expect(adviseClub(69, BAG)).toBeNull();
    expect(adviseClub(20, BAG)).toBeNull();
  });

  it('returns null when the distance is longer than the longest carry by more than 10 m', () => {
    expect(adviseClub(240, BAG)).toMatchObject({ club: 'driver', carryM: 230, gapM: -10 });
    expect(adviseClub(241, BAG)).toBeNull();
    expect(adviseClub(400, BAG)).toBeNull();
  });

  it('returns null without a usable GPS distance', () => {
    expect(adviseClub(null, BAG)).toBeNull();
    expect(adviseClub(undefined, BAG)).toBeNull();
    expect(adviseClub(Number.NaN, BAG)).toBeNull();
    expect(adviseClub(Number.POSITIVE_INFINITY, BAG)).toBeNull();
    expect(adviseClub(0, BAG)).toBeNull();
    expect(adviseClub(-12, BAG)).toBeNull();
  });

  it('rounds the gap when the distance is fractional', () => {
    expect(adviseClub(144.4, BAG)).toMatchObject({ club: 'iron7', gapM: 1 });
  });
});

describe('formatClubAdvice', () => {
  const advice: ClubAdvice = { club: 'iron7', label: 'Fer 7', carryM: 140, gapM: 0 };

  it('names the club in lower case with its carry', () => {
    expect(formatClubAdvice(advice, false)).toBe('Conseil : fer 7 (140 m)');
    expect(formatClubAdvice({ ...advice, club: 'sw', label: 'Sand wedge' }, false)).toBe('Conseil : sand wedge (140 m)');
  });

  it('says it is indicative when the distance is estimated', () => {
    expect(formatClubAdvice(advice, true)).toBe('Conseil : fer 7 (140 m), à titre indicatif');
  });

  it('spells the distance out for screen readers', () => {
    expect(describeClubAdvice(advice, false)).toBe('Conseil de club : fer 7, 140 mètres');
    expect(describeClubAdvice(advice, true)).toBe('Conseil de club : fer 7, 140 mètres, à titre indicatif');
  });
});

describe('describeAdviceReadiness', () => {
  it('asks for 3 clubs when the bag is empty', () => {
    expect(describeAdviceReadiness(0)).toBe(
      'Renseigne au moins 3 clubs pour recevoir un conseil pendant tes rounds, quand la distance au green est connue.',
    );
  });

  it('says how many are missing while the bag is too small', () => {
    expect(describeAdviceReadiness(1)).toBe('Il en faut au moins 3 pour recevoir un conseil pendant tes rounds.');
    expect(describeAdviceReadiness(2)).toBe('Il en faut au moins 3 pour recevoir un conseil pendant tes rounds.');
  });

  it('explains where the advice shows up once the bag is big enough', () => {
    expect(describeAdviceReadiness(3)).toBe('Le conseil s’affiche pendant un round, sous la distance au green.');
    expect(describeAdviceReadiness(14)).toBe('Le conseil s’affiche pendant un round, sous la distance au green.');
  });
});
