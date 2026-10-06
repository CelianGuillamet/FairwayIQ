import {
  COURSE_DATA_ATTRIBUTION,
  COURSE_SEARCH_ATTRIBUTION,
  ODBL_URL,
  OPEN_SOURCE_CREDITS,
  OSM_COPYRIGHT_URL,
  hasOpenStreetMapCourse,
} from './credits';

const manifest = require('../package.json') as { dependencies: Record<string, string> };

describe('OPEN_SOURCE_CREDITS', () => {
  it('gives every entry a name and a licence', () => {
    expect(OPEN_SOURCE_CREDITS.length).toBeGreaterThanOrEqual(10);
    expect(OPEN_SOURCE_CREDITS.length).toBeLessThanOrEqual(15);

    for (const credit of OPEN_SOURCE_CREDITS) {
      expect(credit.name.trim()).not.toBe('');
      expect(credit.licence.trim()).not.toBe('');
    }
  });

  it('lists each package once', () => {
    const packages = OPEN_SOURCE_CREDITS.map((credit) => credit.packageName);
    const names = OPEN_SOURCE_CREDITS.map((credit) => credit.name);

    expect(new Set(packages).size).toBe(packages.length);
    expect(new Set(names).size).toBe(names.length);
  });

  it('only lists packages the app depends on', () => {
    for (const credit of OPEN_SOURCE_CREDITS) {
      expect(Object.keys(manifest.dependencies)).toContain(credit.packageName);
    }
  });

  it('matches the licence declared by each installed package', () => {
    for (const credit of OPEN_SOURCE_CREDITS) {
      const installed = require(`../node_modules/${credit.packageName}/package.json`) as { license?: string };

      expect(installed.license ?? '').toContain(credit.spdx);
    }
  });

  it('credits the two fonts under the SIL Open Font License', () => {
    const fonts = OPEN_SOURCE_CREDITS.filter((credit) => credit.packageName.startsWith('@expo-google-fonts/'));

    expect(fonts.map((credit) => credit.name)).toEqual(['Newsreader (police)', 'Hanken Grotesk (police)']);
    for (const font of fonts) {
      expect(font.licence).toBe('SIL Open Font License 1.1');
    }
  });
});

describe('course data attribution', () => {
  it('names the contributors and the ODbL licence', () => {
    expect(COURSE_DATA_ATTRIBUTION).toContain('©');
    expect(COURSE_DATA_ATTRIBUTION).toContain('OpenStreetMap');
    expect(COURSE_DATA_ATTRIBUTION).toContain('ODbL');
    expect(COURSE_SEARCH_ATTRIBUTION).toBe('Parcours : © OpenStreetMap');
  });

  it('links to the OpenStreetMap copyright page and the ODbL text', () => {
    expect(OSM_COPYRIGHT_URL).toBe('https://www.openstreetmap.org/copyright');
    expect(ODBL_URL).toBe('https://opendatacommons.org/licenses/odbl/');
  });
});

describe('hasOpenStreetMapCourse', () => {
  it('is true when at least one course comes from OpenStreetMap', () => {
    expect(hasOpenStreetMapCourse([{ provider: null }, { provider: 'openstreetmap' }])).toBe(true);
  });

  it('is false for other providers, built-in and manual courses', () => {
    expect(hasOpenStreetMapCourse([{ provider: 'golfapi' }, {}, { provider: null }])).toBe(false);
  });

  it('is false without results', () => {
    expect(hasOpenStreetMapCourse([])).toBe(false);
  });
});
