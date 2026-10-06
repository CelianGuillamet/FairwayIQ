import { format } from 'date-fns';
import type { Round } from '../types';
import { compareRoundsNewestFirst } from './export-document';

// French Excel splits columns on semicolons: a comma-separated file opens as a single column.
export const CSV_DELIMITER = ';';
export const CSV_BOM = '﻿';

const LINE_BREAK = '\r\n';
const FORMULA_TRIGGERS = new Set(['=', '+', '-', '@', '\t', '\r']);

export const ROUNDS_CSV_HEADERS = [
  'Date',
  'Parcours',
  'Départ',
  'Trous',
  'Score',
  'Par',
  'Putts',
  'GIR',
  'Fairways touchés',
  'Fairways possibles',
  'Pénalités',
  'Notes',
] as const;

export type CsvCell = string | number | null | undefined;

export function escapeCsvCell(value: CsvCell): string {
  if (value == null) return '';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';

  // A leading = + - @ makes a spreadsheet run the cell as a formula, so text cells get a visible apostrophe.
  const text = FORMULA_TRIGGERS.has(value.charAt(0)) ? `'${value}` : value;

  return /[",;\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function formatPlayedDate(playedAt: string) {
  const date = new Date(playedAt);
  return Number.isNaN(date.getTime()) ? '' : format(date, 'yyyy-MM-dd');
}

function toRow(round: Round): CsvCell[] {
  return [
    formatPlayedDate(round.played_at),
    round.course_name,
    round.tee_name?.trim() || round.tee_key,
    round.holes,
    round.total_score,
    round.par,
    round.putts,
    round.gir,
    round.fairways_hit,
    round.fairways_total,
    round.penalties,
    round.notes,
  ];
}

export function buildRoundsCsv(rounds: readonly Round[]) {
  const lines = [ROUNDS_CSV_HEADERS, ...[...rounds].sort(compareRoundsNewestFirst).map(toRow)].map((row) =>
    row.map(escapeCsvCell).join(CSV_DELIMITER),
  );

  return `${CSV_BOM}${lines.join(LINE_BREAK)}${LINE_BREAK}`;
}
