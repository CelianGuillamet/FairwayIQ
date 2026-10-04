import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { formatScoreToPar } from '../../lib/score-labels';
import type { Round, RoundAggregate } from '../../types';

const MISSING = '–';
const PERCENT = ' %';

export function describeScoreToPar(scoreToPar: number): string {
  return scoreToPar === 0 ? 'Au par' : `${formatScoreToPar(scoreToPar)} par rapport au par`;
}

export function formatRoundDate(playedAt: string): string {
  const parsed = new Date(playedAt);

  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  const label = format(parsed, 'EEEE d MMMM yyyy', { locale: fr });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function buildRoundSubtitle(round: Pick<Round, 'holes' | 'tee_name'>): string {
  const parts = [`${round.holes} trous`];
  const tee = round.tee_name?.trim();

  if (tee) {
    parts.push(`départ ${tee}`);
  }

  return parts.join(' · ');
}

export type RoundStatKey = 'fairways' | 'gir' | 'putts' | 'penalties';

export type RoundStat = {
  key: RoundStatKey;
  label: string;
  value: string;
  suffix: string | null;
  accessibilityLabel: string;
};

type StatsRound = Pick<Round, 'holes' | 'putts' | 'gir' | 'fairways_hit' | 'fairways_total' | 'penalties'>;

function formatDecimal(value: number) {
  return value.toString().replace('.', ',');
}

function percentage(hit: number, total: number) {
  return `${Math.round((hit / total) * 100)}${PERCENT}`;
}

function buildRatioStat(
  key: RoundStatKey,
  label: string,
  spoken: string,
  hit: number | null | undefined,
  total: number | null | undefined,
): RoundStat {
  if (hit == null || total == null || total <= 0) {
    return { key, label, value: MISSING, suffix: null, accessibilityLabel: `${spoken} : non renseigné` };
  }

  return {
    key,
    label,
    value: String(hit),
    suffix: `/${total}`,
    accessibilityLabel: `${spoken} : ${hit} sur ${total}, ${percentage(hit, total)}`,
  };
}

export function buildRoundStats(round: StatsRound, aggregate: RoundAggregate | null): RoundStat[] {
  const fairways = buildRatioStat(
    'fairways',
    'Fairways',
    'Fairways',
    aggregate ? aggregate.fairways_hit : round.fairways_hit,
    aggregate ? aggregate.fairways_total : round.fairways_total,
  );

  const gir = buildRatioStat(
    'gir',
    'Greens en rég.',
    'Greens en régulation',
    aggregate ? aggregate.gir : round.gir,
    aggregate ? aggregate.holes : round.holes,
  );

  const putts = aggregate ? aggregate.putts : round.putts;
  const puttsPerHole = aggregate
    ? aggregate.average_putts_per_hole
    : round.putts != null
      ? Math.round((round.putts / round.holes) * 10) / 10
      : null;

  const puttsStat: RoundStat = putts == null
    ? { key: 'putts', label: 'Putts', value: MISSING, suffix: null, accessibilityLabel: 'Putts : non renseigné' }
    : {
        key: 'putts',
        label: 'Putts',
        value: String(putts),
        suffix: null,
        accessibilityLabel: `Putts : ${putts}${puttsPerHole != null ? `, ${formatDecimal(puttsPerHole)} par trou` : ''}`,
      };

  const penalties = aggregate ? aggregate.penalties : round.penalties ?? 0;
  const penaltiesStat: RoundStat = {
    key: 'penalties',
    label: 'Pénalités',
    value: String(penalties),
    suffix: null,
    accessibilityLabel: `Pénalités : ${penalties}`,
  };

  return [fairways, gir, puttsStat, penaltiesStat];
}
