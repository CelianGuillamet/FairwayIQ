import {
  buildRoundStats,
  describeScoreToPar,
  formatRoundDate,
  type RoundStatKey,
} from '../components/rounds-detail/round-summary';
import type { ScorecardHalf } from '../components/rounds-detail/scorecard-model';
import type { Round, RoundAggregate } from '../types';

export type ShareHoleCell = {
  number: number;
  strokes: number | null;
  par: number | null;
};

export type ShareHoleRow = {
  key: ScorecardHalf['key'];
  cells: ShareHoleCell[];
};

export type ShareStat = {
  key: RoundStatKey;
  label: string;
  value: string;
  suffix: string | null;
};

export type ShareCardModel = {
  courseName: string;
  eyebrow: string;
  totalScore: number;
  toParLabel: string;
  parLabel: string;
  rows: ShareHoleRow[];
  stats: ShareStat[];
};

type ShareRound = Pick<
  Round,
  | 'course_name'
  | 'played_at'
  | 'holes'
  | 'total_score'
  | 'par'
  | 'putts'
  | 'gir'
  | 'fairways_hit'
  | 'fairways_total'
  | 'penalties'
>;

type ShareCardInput = {
  round: ShareRound;
  aggregate: RoundAggregate | null;
  halves: ScorecardHalf[];
};

const DEFAULT_COURSE_NAME = 'Parcours';

function isPlayed(cell: ShareHoleCell) {
  return cell.strokes != null && cell.par != null;
}

export function buildShareHoleRows(halves: ScorecardHalf[]): ShareHoleRow[] {
  return halves
    .map((half) => ({
      key: half.key,
      cells: half.cells.map((cell) => ({ number: cell.number, strokes: cell.strokes, par: cell.par })),
    }))
    .filter((row) => row.cells.some(isPlayed));
}

export function selectShareStats(round: ShareRound, aggregate: RoundAggregate | null): ShareStat[] {
  const source = aggregate ?? round;

  const recorded: Record<RoundStatKey, boolean> = {
    fairways: source.fairways_hit != null && (source.fairways_total ?? 0) > 0,
    gir: source.gir != null,
    putts: source.putts != null,
    penalties: aggregate != null || round.penalties != null,
  };

  return buildRoundStats(round, aggregate)
    .filter((stat) => recorded[stat.key])
    .map(({ key, label, value, suffix }) => ({ key, label, value, suffix }));
}

export function buildShareCardModel({ round, aggregate, halves }: ShareCardInput): ShareCardModel {
  const holes = aggregate?.holes ?? round.holes;
  const totalScore = aggregate?.total_score ?? round.total_score;
  const par = aggregate?.par ?? round.par;
  const eyebrow = [formatRoundDate(round.played_at), `${holes} trous`].filter(Boolean).join(' · ');

  return {
    courseName: round.course_name?.trim() || DEFAULT_COURSE_NAME,
    eyebrow,
    totalScore,
    toParLabel: describeScoreToPar(aggregate?.score_to_par ?? totalScore - par),
    parLabel: `Par ${par}`,
    rows: buildShareHoleRows(halves),
    stats: selectShareStats(round, aggregate),
  };
}
