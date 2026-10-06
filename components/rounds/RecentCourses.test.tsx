import type { ReactElement } from 'react';
import { act } from 'react';
import { Keyboard } from 'react-native';
import type { RecentCourse } from '../../lib/recent-courses';
import { RecentCourses } from './RecentCourses';

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

function rows(renderer: Renderer) {
  return renderer.root.findAll((node) => node.props?.accessibilityRole === 'button' && typeof node.props?.onPress === 'function');
}

const SAINT_CLOUD: RecentCourse = { key: 'id:saint-cloud', courseId: 'saint-cloud', name: 'Golf de Saint-Cloud', roundCount: 3 };
const UNKNOWN: RecentCourse = { key: 'id:golfapi:42', courseId: 'golfapi:42', name: 'Golf du Bois', roundCount: 1 };
const CUSTOM: RecentCourse = { key: 'name:golf du lac', courseId: null, name: 'Golf du Lac', roundCount: 2 };

describe('RecentCourses', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders nothing when the player has no course yet', () => {
    expect(render(<RecentCourses courses={[]} onSelect={jest.fn()} />).toJSON()).toBeNull();
  });

  it('shows the name, the city when it is known and the number of rounds', () => {
    const content = texts(render(<RecentCourses courses={[SAINT_CLOUD, UNKNOWN, CUSTOM]} onSelect={jest.fn()} />).toJSON());

    expect(content).toContain('Mes parcours');
    expect(content).toEqual(expect.arrayContaining([
      'Golf de Saint-Cloud', 'Saint-Cloud · 3 rounds',
      'Golf du Bois', '1 round',
      'Golf du Lac', '2 rounds',
    ]));
  });

  it('describes each row for screen readers', () => {
    const renderer = render(<RecentCourses courses={[SAINT_CLOUD, CUSTOM]} onSelect={jest.fn()} />);

    expect(rows(renderer).map((row) => row.props.accessibilityLabel)).toEqual([
      'Golf de Saint-Cloud, Saint-Cloud · 3 rounds',
      'Golf du Lac, 2 rounds',
    ]);
  });

  it('selects the tapped course and closes the keyboard', () => {
    const onSelect = jest.fn();
    const dismiss = jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => {});
    const renderer = render(<RecentCourses courses={[SAINT_CLOUD, CUSTOM]} onSelect={onSelect} />);

    act(() => rows(renderer)[1].props.onPress());

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(CUSTOM);
    expect(dismiss).toHaveBeenCalledTimes(1);
  });
});
