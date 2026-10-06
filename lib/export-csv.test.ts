import type { Round } from '../types';
import { CSV_BOM, CSV_DELIMITER, ROUNDS_CSV_HEADERS, buildRoundsCsv, escapeCsvCell } from './export-csv';

function round(overrides: Partial<Round> = {}): Round {
  return {
    id: 'round-1',
    user_id: 'user-1',
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
    created_at: new Date(2026, 9, 3, 18, 0).toISOString(),
    ...overrides,
  };
}

function parseLines(csv: string) {
  return csv.slice(CSV_BOM.length).split('\r\n');
}

describe('escapeCsvCell', () => {
  it('leaves plain text and accents untouched', () => {
    expect(escapeCsvCell('Golf de Chantilly')).toBe('Golf de Chantilly');
    expect(escapeCsvCell('Départ arrière')).toBe('Départ arrière');
    expect(escapeCsvCell('Évian')).toBe('Évian');
  });

  it('writes null, undefined and non-finite numbers as an empty cell', () => {
    expect(escapeCsvCell(null)).toBe('');
    expect(escapeCsvCell(undefined)).toBe('');
    expect(escapeCsvCell(Number.NaN)).toBe('');
    expect(escapeCsvCell(Number.POSITIVE_INFINITY)).toBe('');
  });

  it('writes numbers as is, including zero and negatives', () => {
    expect(escapeCsvCell(0)).toBe('0');
    expect(escapeCsvCell(72)).toBe('72');
    expect(escapeCsvCell(-3)).toBe('-3');
  });

  it('keeps an empty string empty', () => {
    expect(escapeCsvCell('')).toBe('');
  });

  it('quotes cells holding a comma, a semicolon, a quote or a line break', () => {
    expect(escapeCsvCell('a,b')).toBe('"a,b"');
    expect(escapeCsvCell('a;b')).toBe('"a;b"');
    expect(escapeCsvCell('a\nb')).toBe('"a\nb"');
    expect(escapeCsvCell('a\r\nb')).toBe('"a\r\nb"');
    expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsvCell('"')).toBe('""""');
  });

  it.each(['=', '+', '-', '@', '\t', '\r'])('neutralises a cell that starts with %j', (trigger) => {
    const escaped = escapeCsvCell(`${trigger}SUM(A1:A9)`);

    expect(escaped.replace(/^"/, '').startsWith(`'${trigger}`)).toBe(true);
  });

  it('guards the usual formula payloads', () => {
    expect(escapeCsvCell('=1+1')).toBe("'=1+1");
    expect(escapeCsvCell('+33 6 12 34 56 78')).toBe("'+33 6 12 34 56 78");
    expect(escapeCsvCell('-5 sous le par')).toBe("'-5 sous le par");
    expect(escapeCsvCell('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(escapeCsvCell('=HYPERLINK("http://x.test","clic")')).toBe(`"'=HYPERLINK(""http://x.test"",""clic"")"`);
  });

  it('only guards the first character', () => {
    expect(escapeCsvCell('par = 72')).toBe('par = 72');
    expect(escapeCsvCell('trou 5 - bien joué')).toBe('trou 5 - bien joué');
    expect(escapeCsvCell('x@y')).toBe('x@y');
  });
});

describe('buildRoundsCsv', () => {
  it('starts with a UTF-8 byte order mark', () => {
    const csv = buildRoundsCsv([round()]);

    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.indexOf('﻿', 1)).toBe(-1);
  });

  it('writes the French header row, separated by the delimiter', () => {
    const [header] = parseLines(buildRoundsCsv([round()]));

    expect(header).toBe(
      'Date;Parcours;Départ;Trous;Score;Par;Putts;GIR;Fairways touchés;Fairways possibles;Pénalités;Notes',
    );
    expect(header.split(CSV_DELIMITER)).toEqual([...ROUNDS_CSV_HEADERS]);
  });

  it('writes one row per round in the header column order', () => {
    const lines = parseLines(buildRoundsCsv([round({ notes: 'Belle journée' })]));

    expect(lines).toHaveLength(3);
    expect(lines[1]).toBe('2026-10-03;Golf de Test;Jaune;18;90;72;33;7;8;14;2;Belle journée');
    expect(lines[2]).toBe('');
  });

  it('ends every line, the last one included, with CRLF', () => {
    const csv = buildRoundsCsv([round(), round({ id: 'round-2' })]);

    expect(csv.endsWith('\r\n')).toBe(true);
    expect(csv.replace(/\r\n/g, '').includes('\n')).toBe(false);
  });

  it('lists the newest round first and breaks ties by id', () => {
    const csv = buildRoundsCsv([
      round({ id: 'a', played_at: new Date(2026, 8, 1, 10).toISOString(), course_name: 'Septembre' }),
      round({ id: 'b', played_at: new Date(2026, 9, 3, 10).toISOString(), course_name: 'Octobre' }),
      round({ id: 'c', played_at: new Date(2026, 7, 1, 10).toISOString(), course_name: 'Août' }),
    ]);

    expect(parseLines(csv).slice(1, 4).map((line) => line.split(CSV_DELIMITER)[1])).toEqual([
      'Octobre',
      'Septembre',
      'Août',
    ]);
  });

  it('leaves missing values blank instead of writing null', () => {
    const csv = buildRoundsCsv([
      round({
        course_name: null,
        tee_name: null,
        tee_key: null,
        putts: null,
        gir: null,
        fairways_hit: null,
        fairways_total: null,
        penalties: null,
        notes: null,
      }),
    ]);

    expect(parseLines(csv)[1]).toBe('2026-10-03;;;18;90;72;;;;;;');
    expect(csv).not.toMatch(/null|undefined/);
  });

  it('keeps zero values', () => {
    const csv = buildRoundsCsv([round({ putts: 0, gir: 0, fairways_hit: 0, penalties: 0 })]);

    expect(parseLines(csv)[1]).toBe('2026-10-03;Golf de Test;Jaune;18;90;72;0;0;0;14;0;');
  });

  it('falls back to the tee key when the tee has no name', () => {
    expect(parseLines(buildRoundsCsv([round({ tee_name: ' ', tee_key: 'white' })]))[1].split(CSV_DELIMITER)[2]).toBe(
      'white',
    );
  });

  it('keeps the fairways in two numeric columns so a spreadsheet cannot read them as a date', () => {
    const cells = parseLines(buildRoundsCsv([round({ fairways_hit: 3, fairways_total: 12 })]))[1].split(CSV_DELIMITER);

    expect(cells[8]).toBe('3');
    expect(cells[9]).toBe('12');
  });

  it('quotes notes with line breaks, quotes and delimiters without breaking the row', () => {
    const notes = 'Départ "raté"; puis\nun birdie, enfin';
    const csv = buildRoundsCsv([round({ notes })]);

    expect(csv).toContain(`;"Départ ""raté""; puis\nun birdie, enfin"\r\n`);
  });

  it('neutralises a formula hidden in the course name or the notes', () => {
    const csv = buildRoundsCsv([round({ course_name: '=HYPERLINK("http://x.test")', notes: '@cmd' })]);
    const [, row] = parseLines(csv);

    expect(row).toContain(`"'=HYPERLINK(""http://x.test"")"`);
    expect(row.endsWith(";'@cmd")).toBe(true);
  });

  it('does not touch negative-looking numbers', () => {
    expect(parseLines(buildRoundsCsv([round({ penalties: -1 })]))[1].endsWith(';-1;')).toBe(true);
  });

  it('formats the date as the local calendar day', () => {
    const csv = buildRoundsCsv([round({ played_at: new Date(2026, 0, 5, 23, 45).toISOString() })]);

    expect(parseLines(csv)[1].startsWith('2026-01-05;')).toBe(true);
  });

  it('leaves the date blank when played_at is not a date', () => {
    expect(parseLines(buildRoundsCsv([round({ played_at: 'pas une date' })]))[1].startsWith(';Golf de Test')).toBe(true);
  });

  it('keeps only the header when there is no round', () => {
    expect(buildRoundsCsv([])).toBe(`${CSV_BOM}${ROUNDS_CSV_HEADERS.join(CSV_DELIMITER)}\r\n`);
  });

  it('does not reorder the input array', () => {
    const rounds = [
      round({ id: 'old', played_at: new Date(2026, 0, 1).toISOString() }),
      round({ id: 'new', played_at: new Date(2026, 5, 1).toISOString() }),
    ];

    buildRoundsCsv(rounds);

    expect(rounds.map((entry) => entry.id)).toEqual(['old', 'new']);
  });
});
