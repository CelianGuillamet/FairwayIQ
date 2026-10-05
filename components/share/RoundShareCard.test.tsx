import type { ReactElement } from 'react';
import { act } from 'react';
import { buildScorecardHalves } from '../rounds-detail/scorecard-model';
import { buildShareCardModel } from '../../lib/share-card';
import type { RoundDraftHole } from '../../types';
import { RoundShareCard } from './RoundShareCard';

jest.mock('../../lib/theme', () => ({
  useTheme: () => ({ colors: jest.requireActual('../../constants/theme').lightColors }),
}));

type Json = { type: string; props: Record<string, unknown>; children: Array<Json | string> | null };
type Renderer = { toJSON: () => Json };

const { create } = require('react-test-renderer') as { create: (element: ReactElement) => Renderer };

const round = {
  course_name: 'Golf de Saint-Cloud',
  played_at: '2026-10-03T12:00:00.000Z',
  holes: 18 as const,
  total_score: 81,
  par: 72,
  putts: 36,
  gir: 4,
  fairways_hit: 7,
  fairways_total: 14,
  penalties: 3,
};

function hole(number: number, score: number): RoundDraftHole {
  return {
    hole_number: number,
    par: 4,
    score,
    putts: 2,
    gir: false,
    fairway_hit: false,
    penalty: 0,
    completed: true,
  };
}

function render(model: ReturnType<typeof buildShareCardModel>) {
  let renderer: Renderer | undefined;
  act(() => {
    renderer = create(<RoundShareCard model={model} />);
  });
  return renderer!.toJSON();
}

function textOf(node: Json | string): string {
  if (typeof node === 'string') return node;
  return (node.children ?? []).map(textOf).join(' ');
}

function find(node: Json | string, predicate: (node: Json) => boolean, found: Json[] = []): Json[] {
  if (typeof node === 'string') return found;
  if (predicate(node)) found.push(node);
  (node.children ?? []).forEach((child) => find(child, predicate, found));
  return found;
}

function styleOf(node: Json) {
  return Object.assign({}, ...[node.props.style].flat(Infinity).filter(Boolean)) as Record<string, unknown>;
}

describe('RoundShareCard', () => {
  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  it('shows the course, the total, the score against par and the watermark', () => {
    const halves = buildScorecardHalves(Array.from({ length: 18 }, (_, index) => hole(index + 1, 5)), 18);
    const tree = render(buildShareCardModel({ round, aggregate: null, halves }));
    const text = textOf(tree);

    expect(text).toContain('Golf de Saint-Cloud');
    expect(text).toContain('Samedi 3 octobre 2026 · 18 trous');
    expect(text).toContain('81');
    expect(text).toContain('+9 par rapport au par');
    expect(text).toContain('Par 72');
    expect(text).toContain('FairwayIQ');
  });

  it('draws one mark per played hole, in the card ink and not the app theme', () => {
    const halves = buildScorecardHalves(Array.from({ length: 18 }, (_, index) => hole(index + 1, 5)), 18);
    const tree = render(buildShareCardModel({ round, aggregate: null, halves }));
    const marks = find(tree, (node) => styleOf(node).borderColor === '#F5F6F1' && node.type === 'View');

    expect(marks).toHaveLength(18);
    expect(find(tree, (node) => styleOf(node).borderColor === '#101A14')).toHaveLength(0);
  });

  it('shows 9 holes for a 9-hole round and none without hole data', () => {
    const nine = buildScorecardHalves(Array.from({ length: 9 }, (_, index) => hole(index + 1, 4)), 9);
    const withNine = render(buildShareCardModel({ round: { ...round, holes: 9 }, aggregate: null, halves: nine }));
    const withoutHoles = render(buildShareCardModel({ round, aggregate: null, halves: [] }));
    const numbers = (tree: Json) => find(tree, (node) => node.type === 'Text' && /^\d+$/.test(textOf(node))).map(textOf);

    expect(numbers(withNine)).not.toContain('10');
    expect(numbers(withNine)).toContain('9');
    expect(numbers(withoutHoles)).not.toContain('1');
  });

  it('omits the stats that are not recorded', () => {
    const bare = { ...round, putts: null, gir: null, fairways_hit: null, fairways_total: null, penalties: null };
    const text = textOf(render(buildShareCardModel({ round: bare, aggregate: null, halves: [] })));

    expect(text).not.toMatch(/Fairways|Greens|Putts|Pénalités/);
    expect(textOf(render(buildShareCardModel({ round, aggregate: null, halves: [] })))).toMatch(/Fairways.*Greens en rég\..*Putts.*Pénalités/);
  });

  it('uses the brand colours with red only on the flag', () => {
    const tree = render(buildShareCardModel({ round, aggregate: null, halves: [] }));
    const root = styleOf(tree);
    const redStyles = find(tree, (node) => Object.values(styleOf(node)).some((value) => value === '#D8392B'));

    expect(root.backgroundColor).toBe('#101A14');
    expect(root.width).toBe(360);
    expect(root.height).toBe(450);
    expect(redStyles).toHaveLength(0);
    expect(find(tree, (node) => node.type === 'RNSVGPath')).toHaveLength(1);
  });

  it('does not scale with the reader font size so the image is always the same', () => {
    const tree = render(buildShareCardModel({ round, aggregate: null, halves: [] }));
    const texts = find(tree, (node) => node.type === 'Text');
    const nestedTexts = texts.flatMap((node) => find(node, (child) => child !== node && child.type === 'Text'));
    const outerTexts = texts.filter((node) => !nestedTexts.includes(node));

    expect(outerTexts.length).toBeGreaterThan(0);
    expect(outerTexts.every((node) => node.props.allowFontScaling === false)).toBe(true);
  });
});
