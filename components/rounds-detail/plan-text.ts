export type PlanBlock =
  | { kind: 'paragraph'; text: string }
  | { kind: 'item'; marker: string; text: string };

export const BULLET_MARKER = '•';

const BULLET = /^[-–—•*·]\s+(.+)$/;
const NUMBERED = /^(\d{1,2})[.)]\s+(.+)$/;

export function parsePlanText(text: string): PlanBlock[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line): PlanBlock => {
      const bullet = BULLET.exec(line);
      if (bullet) {
        return { kind: 'item', marker: BULLET_MARKER, text: bullet[1].trim() };
      }

      const numbered = NUMBERED.exec(line);
      if (numbered) {
        return { kind: 'item', marker: `${numbered[1]}.`, text: numbered[2].trim() };
      }

      return { kind: 'paragraph', text: line };
    });
}
