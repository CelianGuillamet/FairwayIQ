import type { ReactElement } from 'react';
import { act } from 'react';
import type { HoleViewData } from '../../lib/hole-view';
import type { TeeOption } from '../../lib/golf-courses';
import type { RoundDraftHole } from '../../types';
import { HoleOverviewCard } from './HoleOverviewCard';

jest.mock('../../lib/supabase', () => ({ supabase: {} }));
jest.mock('../../lib/theme', () => {
  const colors = jest.requireActual('../../constants/theme').lightColors;
  return {
    useTheme: () => ({ colors }),
    useThemedStyles: (create: (themeColors: unknown) => unknown) => create(colors),
  };
});
jest.mock('../ui/Icon', () => ({ Icon: () => null }));

type Json = { type: string; props: Record<string, any>; children: Array<Json | string> | null };
type Renderer = { toJSON: () => Json | Json[] | null; root: { findAll: (test: (node: any) => boolean) => any[] } };

const { create } = require('react-test-renderer') as { create: (element: ReactElement) => Renderer };

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function render(element: ReactElement) {
  let renderer!: Renderer;
  act(() => {
    renderer = create(element);
  });
  return renderer;
}

function texts(node: Json | Json[] | string | null): string[] {
  if (node === null) return [];
  if (typeof node === 'string') return [node];
  if (Array.isArray(node)) return node.flatMap(texts);

  return (node.children ?? []).flatMap(texts);
}

const HOLE: RoundDraftHole = {
  hole_number: 6,
  par: 4,
  score: 0,
  putts: 0,
  gir: false,
  fairway_hit: null,
  penalty: 0,
  completed: false,
};

const TEE: TeeOption = { key: 'yellow', label: 'Yellow', shortLabel: 'Y', color: '#fbbf24', distanceOffset: 0 };

const GREEN = { front: 140, center: 150, back: 160 };

function makeView(overrides: Partial<HoleViewData> = {}): HoleViewData {
  return {
    holeNumber: 6,
    par: 4,
    handicapIndex: 12,
    distanceByTee: { yellow: 340 },
    distanceSource: 'catalog',
    shape: 'straight',
    hazards: ['bunker'],
    difficultyLabel: 'Équilibré',
    summary: '',
    gpsPointCount: 3,
    gpsAvailable: true,
    gpsPoints: [],
    ...overrides,
  };
}

function renderCard(view: HoleViewData, liveGreenDistances: typeof GREEN | null = null) {
  return render(
    <HoleOverviewCard
      hole={HOLE}
      holeView={view}
      teeKey="yellow"
      teeOptions={[TEE]}
      onSelectTee={jest.fn()}
      liveGreenDistances={liveGreenDistances}
    />,
  );
}

function factsLabel(renderer: Renderer) {
  const facts = renderer.root.findAll(
    (node) => typeof node.props?.accessibilityLabel === 'string' && node.props.accessibilityLabel.startsWith('Trou '),
  );

  return facts[0]?.props.accessibilityLabel as string;
}

function gpsLabel(renderer: Renderer) {
  const blocks = renderer.root.findAll(
    (node) => typeof node.props?.accessibilityLabel === 'string' && node.props.accessibilityLabel.startsWith('Distance au green'),
  );

  return blocks[0]?.props.accessibilityLabel as string | undefined;
}

describe('HoleOverviewCard handicap', () => {
  it('shows the stroke index from the catalog', () => {
    const renderer = renderCard(makeView({ handicapIndex: 12 }));

    expect(texts(renderer.toJSON())).toEqual(expect.arrayContaining(['Hcp', '12']));
    expect(factsLabel(renderer)).toContain('handicap 12');
  });

  it('labels the missing stroke index instead of showing a number', () => {
    const renderer = renderCard(makeView({ handicapIndex: null }));
    const content = texts(renderer.toJSON());

    expect(content).toEqual(expect.arrayContaining(['Hcp', '—']));
    expect(factsLabel(renderer)).toContain('handicap non renseigné');
  });
});

describe('HoleOverviewCard estimates', () => {
  it('marks the hole distance and the green distances as estimated when the hole data is generated', () => {
    const renderer = renderCard(makeView({ distanceSource: 'generated' }), GREEN);

    expect(texts(renderer.toJSON()).filter((text) => text === 'Estimée')).toHaveLength(2);
    expect(gpsLabel(renderer)).toMatch(/^Distance au green estimée, avant 140 mètres/);
    expect(factsLabel(renderer)).toContain('distance estimée');
  });

  it('shows no estimate wording for catalog hole data', () => {
    const renderer = renderCard(makeView({ distanceSource: 'catalog' }), GREEN);

    expect(texts(renderer.toJSON())).not.toContain('Estimée');
    expect(gpsLabel(renderer)).toMatch(/^Distance au green, avant 140 mètres/);
  });

  it('shows no green distances without a position', () => {
    const renderer = renderCard(makeView({ distanceSource: 'generated' }), null);

    expect(gpsLabel(renderer)).toBeUndefined();
    expect(texts(renderer.toJSON()).filter((text) => text === 'Estimée')).toHaveLength(1);
  });
});
