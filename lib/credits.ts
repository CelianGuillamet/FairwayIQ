export const OPENSTREETMAP_PROVIDER = 'openstreetmap';
export const OSM_COPYRIGHT_URL = 'https://www.openstreetmap.org/copyright';
export const ODBL_URL = 'https://opendatacommons.org/licenses/odbl/';

export const COURSE_DATA_ATTRIBUTION = 'Données de parcours : © les contributeurs d’OpenStreetMap, licence ODbL';
export const COURSE_SEARCH_ATTRIBUTION = 'Parcours : © OpenStreetMap';
export const DISTANCE_ESTIMATE_NOTE =
  'Les distances sont des estimations : elles dépendent des données du parcours et de la précision de ton téléphone. Une distance marquée « Estimée » ne vient pas du catalogue du parcours.';

export type OpenSourceCredit = {
  name: string;
  packageName: string;
  licence: string;
  spdx: string;
};

// The font packages are MIT wrappers around OFL-1.1 font files (see their LICENSE_FONT).
export const OPEN_SOURCE_CREDITS: readonly OpenSourceCredit[] = [
  { name: 'React Native', packageName: 'react-native', licence: 'MIT', spdx: 'MIT' },
  { name: 'React', packageName: 'react', licence: 'MIT', spdx: 'MIT' },
  { name: 'Expo', packageName: 'expo', licence: 'MIT', spdx: 'MIT' },
  { name: 'Expo Router', packageName: 'expo-router', licence: 'MIT', spdx: 'MIT' },
  { name: 'Supabase JS', packageName: '@supabase/supabase-js', licence: 'MIT', spdx: 'MIT' },
  { name: 'Zustand', packageName: 'zustand', licence: 'MIT', spdx: 'MIT' },
  { name: 'date-fns', packageName: 'date-fns', licence: 'MIT', spdx: 'MIT' },
  { name: 'React Native SVG', packageName: 'react-native-svg', licence: 'MIT', spdx: 'MIT' },
  { name: 'Lucide (icônes)', packageName: 'lucide-react-native', licence: 'ISC', spdx: 'ISC' },
  { name: 'Sentry', packageName: '@sentry/react-native', licence: 'MIT', spdx: 'MIT' },
  { name: 'RevenueCat', packageName: 'react-native-purchases', licence: 'MIT', spdx: 'MIT' },
  {
    name: 'Newsreader (police)',
    packageName: '@expo-google-fonts/newsreader',
    licence: 'SIL Open Font License 1.1',
    spdx: 'OFL-1.1',
  },
  {
    name: 'Hanken Grotesk (police)',
    packageName: '@expo-google-fonts/hanken-grotesk',
    licence: 'SIL Open Font License 1.1',
    spdx: 'OFL-1.1',
  },
];

export function hasOpenStreetMapCourse(courses: ReadonlyArray<{ provider?: string | null }>) {
  return courses.some((course) => course.provider === OPENSTREETMAP_PROVIDER);
}
