import { parsePlanText } from './plan-text';

describe('parsePlanText', () => {
  it('keeps a single sentence as one paragraph', () => {
    expect(parsePlanText('Cette semaine, concentre-toi sur le putting.')).toEqual([
      { kind: 'paragraph', text: 'Cette semaine, concentre-toi sur le putting.' },
    ]);
  });

  it('splits lines and drops blanks and surrounding whitespace', () => {
    expect(parsePlanText('  Premier point.\r\n\r\n   Deuxième point.  \n')).toEqual([
      { kind: 'paragraph', text: 'Premier point.' },
      { kind: 'paragraph', text: 'Deuxième point.' },
    ]);
  });

  it('turns bullet lines into items', () => {
    expect(parsePlanText('Objectifs :\n- Putting 20 min\n• Approches 15 min\n* Mental')).toEqual([
      { kind: 'paragraph', text: 'Objectifs :' },
      { kind: 'item', marker: '•', text: 'Putting 20 min' },
      { kind: 'item', marker: '•', text: 'Approches 15 min' },
      { kind: 'item', marker: '•', text: 'Mental' },
    ]);
  });

  it('keeps the numbers of numbered lines', () => {
    expect(parsePlanText('1. Lundi : putting\n2) Jeudi : approches')).toEqual([
      { kind: 'item', marker: '1.', text: 'Lundi : putting' },
      { kind: 'item', marker: '2.', text: 'Jeudi : approches' },
    ]);
  });

  it('does not mistake a leading sign or figure for a list marker', () => {
    expect(parsePlanText('-5 coups à gagner\n18 trous à jouer\n3.5 putts de moyenne')).toEqual([
      { kind: 'paragraph', text: '-5 coups à gagner' },
      { kind: 'paragraph', text: '18 trous à jouer' },
      { kind: 'paragraph', text: '3.5 putts de moyenne' },
    ]);
  });

  it('returns nothing for empty text', () => {
    expect(parsePlanText('')).toEqual([]);
    expect(parsePlanText('  \n \n')).toEqual([]);
  });
});
