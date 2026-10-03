const REDACTED = '[redacted]';
const UNPARSEABLE = '[unparseable url]';

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function isSensitiveName(rawName: string): boolean {
  const name = safeDecode(rawName.slice(rawName.lastIndexOf('/') + 1)).toLowerCase();
  return name === 'code' || name.includes('token') || name.includes('secret');
}

// Plain string splitting on purpose: URL() throws on malformed input and is unreliable for custom schemes in React Native.
export function redactUrlForLogging(url: string): string {
  if (typeof url !== 'string') {
    return UNPARSEABLE;
  }

  return url
    .split(/([?&#])/)
    .map((part, index) => {
      if (index % 2 === 1) {
        return part;
      }
      const eq = part.indexOf('=');
      if (eq === -1 || !isSensitiveName(part.slice(0, eq))) {
        return part;
      }
      return `${part.slice(0, eq + 1)}${REDACTED}`;
    })
    .join('');
}
