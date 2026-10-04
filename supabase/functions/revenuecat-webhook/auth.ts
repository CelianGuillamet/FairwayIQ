async function sha256(value: string): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return new Uint8Array(digest);
}

// Digests have a fixed length, so neither the secret's length nor the position
// of the first differing byte is observable through timing.
export async function secretsMatch(provided: string | null, expected: string): Promise<boolean> {
  const [providedDigest, expectedDigest] = await Promise.all([sha256(provided ?? ''), sha256(expected)]);
  let difference = providedDigest.length ^ expectedDigest.length;

  for (let index = 0; index < expectedDigest.length; index++) {
    difference |= (providedDigest[index] ?? 0) ^ expectedDigest[index];
  }

  return difference === 0;
}
