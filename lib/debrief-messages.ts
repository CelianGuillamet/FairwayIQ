type TimedMessage = {
  role: 'user' | 'assistant';
  created_at?: string;
};

export function buildOpeningMessage(score: number, par: number, name: string) {
  const diff = score - par;

  return `Bonjour ${name}. J’ai analysé ton round de ${score} coups (${diff > 0 ? '+' : ''}${diff}). Qu’est-ce qui t’a le plus marqué aujourd’hui ?`;
}

function compareCreatedAt(left?: string, right?: string) {
  if (!left || !right) {
    return 0;
  }

  const leftTime = Date.parse(left);
  const rightTime = Date.parse(right);

  if (!Number.isNaN(leftTime) && !Number.isNaN(rightTime) && leftTime !== rightTime) {
    return leftTime - rightTime;
  }

  return left < right ? -1 : left > right ? 1 : 0;
}

// Rows saved together (same created_at) keep the conversation order: the question comes before its answer.
export function sortDebriefMessages<T extends TimedMessage>(messages: T[]): T[] {
  return [...messages].sort((left, right) => {
    const byTime = compareCreatedAt(left.created_at, right.created_at);

    if (byTime !== 0) {
      return byTime;
    }

    if (left.role === right.role) {
      return 0;
    }

    return left.role === 'user' ? -1 : 1;
  });
}
