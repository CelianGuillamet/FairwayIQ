import type { ReactElement } from 'react';
import { act } from 'react';
import { getChallenge, getChallengeProgress } from '../../lib/monthly-challenge';
import { MonthlyChallengeCard } from './MonthlyChallengeCard';
import { MonthlyChallengeSheet } from './MonthlyChallengeSheet';

jest.mock('../../lib/theme', () => {
  const colors = jest.requireActual('../../constants/theme').lightColors;
  return {
    useTheme: () => ({ colors }),
    useThemedStyles: (create: (themeColors: unknown) => unknown) => create(colors),
  };
});
jest.mock('../ui/Icon', () => ({ Icon: () => null }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

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

function labels(renderer: Renderer) {
  return renderer.root.findAll((node) => typeof node.props?.accessibilityLabel === 'string').map((node) => node.props.accessibilityLabel);
}

const challenge = getChallenge('rounds_three');
const NOW = new Date(2026, 9, 15, 12, 0, 0);
const rounds = [1, 5].map((day) => ({ id: `r${day}`, played_at: new Date(2026, 9, day, 10).toISOString(), holes: 18 as const }));
const ongoing = getChallengeProgress({ challenge, rounds, holesByRound: {}, completions: [], now: NOW });
const done = getChallengeProgress({
  challenge,
  rounds: [...rounds, { id: 'r9', played_at: new Date(2026, 9, 9, 10).toISOString(), holes: 18 as const }],
  holesByRound: {},
  completions: [],
  now: NOW,
});

describe('MonthlyChallengeCard', () => {
  it('shows the title, the description, the count and the days left', () => {
    const content = texts(render(<MonthlyChallengeCard challenge={challenge} progress={ongoing} onPress={jest.fn()} />).toJSON()).join(' ');

    expect(content).toContain('Défi du mois');
    expect(content).toContain('3 rounds ce mois-ci');
    expect(content).toContain(challenge.description);
    expect(content).toContain('2  sur  3');
    expect(content).toContain('Plus que 16 jours');
    expect(content).not.toContain('Défi relevé');
  });

  it('describes itself for screen readers and opens on press', () => {
    const onPress = jest.fn();
    const renderer = render(<MonthlyChallengeCard challenge={challenge} progress={ongoing} onPress={onPress} />);

    expect(labels(renderer)).toContain('Défi du mois : 3 rounds ce mois-ci. 2 sur 3. Plus que 16 jours');

    const button = renderer.root.findAll((node) => node.props?.accessibilityRole === 'button')[0];
    act(() => button.props.onPress());

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('shows Défi relevé instead of the count once done', () => {
    const content = texts(render(<MonthlyChallengeCard challenge={challenge} progress={done} onPress={jest.fn()} />).toJSON()).join(' ');

    expect(content).toContain('Défi relevé');
    expect(content).not.toContain('Plus que');
    expect(content).not.toContain('sur 3');
  });
});

describe('MonthlyChallengeSheet', () => {
  const baseProps = {
    visible: true,
    challenge,
    progress: ongoing,
    canChange: true,
    changeUsed: false,
    onChange: jest.fn(),
    onClose: jest.fn(),
  };

  beforeEach(() => {
    baseProps.onChange.mockReset();
    baseProps.onClose.mockReset();
  });

  function pressAction(renderer: Renderer, label: string) {
    const action = renderer.root.findAll((node) => node.props?.accessibilityLabel === label && typeof node.props?.onPress === 'function')[0];
    act(() => action.props.onPress());
  }

  it('explains the challenge and how it is counted', () => {
    const content = texts(render(<MonthlyChallengeSheet {...baseProps} />).toJSON()).join(' ');

    expect(content).toContain('3 rounds ce mois-ci');
    expect(content).toContain(challenge.description);
    expect(content).toContain('Comment c’est compté');
    expect(content).toContain(challenge.rule);
    expect(content).toContain('Plus que 16 jours');
    expect(content).toContain('Changer de défi');
  });

  it('asks for a confirmation before using the only change of the month', () => {
    const renderer = render(<MonthlyChallengeSheet {...baseProps} />);

    pressAction(renderer, 'Changer de défi');
    expect(baseProps.onChange).not.toHaveBeenCalled();
    expect(texts(renderer.toJSON()).join(' ')).toContain('Tu ne peux changer qu’une fois par mois');

    pressAction(renderer, 'Annuler');
    expect(texts(renderer.toJSON()).join(' ')).toContain('Changer de défi');

    pressAction(renderer, 'Changer de défi');
    pressAction(renderer, 'Confirmer le changement');
    expect(baseProps.onChange).toHaveBeenCalledTimes(1);
  });

  it('hides the change once it was used, and says so', () => {
    const content = texts(render(<MonthlyChallengeSheet {...baseProps} canChange={false} changeUsed />).toJSON()).join(' ');

    expect(content).not.toContain('Changer de défi');
    expect(content).toContain('Tu as déjà changé de défi ce mois-ci.');
  });

  it('shows Défi relevé once done', () => {
    const content = texts(render(<MonthlyChallengeSheet {...baseProps} progress={done} />).toJSON()).join(' ');

    expect(content).toContain('Défi relevé');
    expect(content).not.toContain('Plus que');
  });
});
