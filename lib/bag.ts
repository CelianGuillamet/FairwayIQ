export const CLUBS = [
  { id: 'driver', label: 'Driver' },
  { id: 'wood3', label: 'Bois 3' },
  { id: 'wood5', label: 'Bois 5' },
  { id: 'hybrid', label: 'Hybride' },
  { id: 'iron4', label: 'Fer 4' },
  { id: 'iron5', label: 'Fer 5' },
  { id: 'iron6', label: 'Fer 6' },
  { id: 'iron7', label: 'Fer 7' },
  { id: 'iron8', label: 'Fer 8' },
  { id: 'iron9', label: 'Fer 9' },
  { id: 'pw', label: 'Pitching wedge' },
  { id: 'gw', label: 'Gap wedge' },
  { id: 'sw', label: 'Sand wedge' },
  { id: 'lw', label: 'Lob wedge' },
] as const;

export type ClubId = (typeof CLUBS)[number]['id'];
export type ClubDistances = Partial<Record<ClubId, number>>;

export const MIN_CARRY_M = 10;
export const MAX_CARRY_M = 400;

export const CARRY_RANGE_MESSAGE = `Saisis une distance entre ${MIN_CARRY_M} et ${MAX_CARRY_M} m.`;

const SESSION_MESSAGE = 'Ta session a expiré. Reconnecte-toi puis réessaie.';
const NETWORK_MESSAGE = 'Connexion impossible. Vérifie ton réseau puis réessaie.';
const INVALID_MESSAGE = `Cette distance n’est pas valide. ${CARRY_RANGE_MESSAGE}`;
const GENERIC_MESSAGES = {
  load: 'Impossible de charger ton sac pour le moment. Réessaie dans un instant.',
  save: 'Impossible d’enregistrer cette distance pour le moment. Réessaie dans un instant.',
  remove: 'Impossible d’effacer cette distance pour le moment. Réessaie dans un instant.',
} as const;

export type BagAction = keyof typeof GENERIC_MESSAGES;

const SESSION_CODES = new Set(['28000', '42501', 'PGRST301', 'PGRST302']);
const INVALID_CODES = new Set(['22003', '22P02', '23502', '23514']);
const NETWORK_MESSAGE_PATTERN = /network|fetch|timeout|timed out|abort|offline|connection/i;

export class BagError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BagError';
  }
}

export function invalidDistanceError() {
  return new BagError(INVALID_MESSAGE);
}

export function sessionError() {
  return new BagError(SESSION_MESSAGE);
}

function readString(value: unknown, key: string) {
  if (typeof value !== 'object' || value === null) {
    return '';
  }

  const field = (value as Record<string, unknown>)[key];
  return typeof field === 'string' ? field : '';
}

export function mapBagError(error: unknown, action: BagAction) {
  const code = readString(error, 'code');

  if (SESSION_CODES.has(code)) return SESSION_MESSAGE;
  if (INVALID_CODES.has(code)) return INVALID_MESSAGE;

  if (!code && NETWORK_MESSAGE_PATTERN.test(readString(error, 'message'))) {
    return NETWORK_MESSAGE;
  }

  return GENERIC_MESSAGES[action];
}

export function getBagErrorMessage(error: unknown, action: BagAction) {
  return error instanceof BagError ? error.message : mapBagError(error, action);
}

export function isClubId(value: unknown): value is ClubId {
  return CLUBS.some((club) => club.id === value);
}

export function getClubLabel(id: ClubId) {
  return CLUBS.find((club) => club.id === id)?.label ?? id;
}

export function isValidCarry(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= MIN_CARRY_M && value <= MAX_CARRY_M;
}

export type CarryInput =
  | { kind: 'empty' }
  | { kind: 'valid'; carryM: number }
  | { kind: 'invalid' };

export function readCarryInput(text: string): CarryInput {
  const cleaned = text.trim();

  if (cleaned === '') {
    return { kind: 'empty' };
  }

  if (!/^\d{1,3}$/.test(cleaned)) {
    return { kind: 'invalid' };
  }

  const carryM = Number(cleaned);
  return isValidCarry(carryM) ? { kind: 'valid', carryM } : { kind: 'invalid' };
}

export function sanitizeCarryText(text: string) {
  return text.replace(/\D/g, '').slice(0, 3);
}

export function toClubDistances(rows: ReadonlyArray<{ club: unknown; carry_m: unknown }> | null | undefined) {
  const distances: ClubDistances = {};

  for (const row of rows ?? []) {
    if (isClubId(row.club) && isValidCarry(row.carry_m)) {
      distances[row.club] = row.carry_m;
    }
  }

  return distances;
}

export function countClubs(distances: ClubDistances) {
  return CLUBS.filter((club) => isValidCarry(distances[club.id])).length;
}

export function formatClubCount(count: number) {
  if (count <= 0) return 'Aucun club renseigné';
  return count === 1 ? '1 club renseigné' : `${count} clubs renseignés`;
}
