import { normalizeSupportEmail } from './support-mail';

type ClientEnv = Record<string, string | undefined>;

// Literal process.env.EXPO_PUBLIC_* accesses on purpose: Metro only inlines statically named variables.
const CLIENT_ENV: ClientEnv = {
  EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  EXPO_PUBLIC_PRIVACY_POLICY_URL: process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL,
  EXPO_PUBLIC_TERMS_URL: process.env.EXPO_PUBLIC_TERMS_URL,
};

const OPTIONAL_CLIENT_ENV: ClientEnv = {
  EXPO_PUBLIC_SUPPORT_EMAIL: process.env.EXPO_PUBLIC_SUPPORT_EMAIL,
};

export function getMissingClientEnv(env: ClientEnv = CLIENT_ENV): string[] {
  return Object.keys(env).filter((name) => !env[name]?.trim());
}

export function getInvalidOptionalClientEnv(env: ClientEnv = OPTIONAL_CLIENT_ENV): string[] {
  const supportEmail = env.EXPO_PUBLIC_SUPPORT_EMAIL?.trim();
  return supportEmail && !normalizeSupportEmail(supportEmail) ? ['EXPO_PUBLIC_SUPPORT_EMAIL'] : [];
}

export function assertClientEnv(env: ClientEnv = CLIENT_ENV, optionalEnv: ClientEnv = OPTIONAL_CLIENT_ENV): void {
  const invalidOptional = getInvalidOptionalClientEnv(optionalEnv);
  if (invalidOptional.length > 0) {
    console.warn(`[env] Ignoring invalid optional client environment variables: ${invalidOptional.join(', ')}.`);
  }

  const missing = getMissingClientEnv(env);
  if (missing.length === 0) {
    return;
  }

  const message =
    `[env] Missing client environment variables: ${missing.join(', ')}. ` +
    'Set them in .env.local (local dev) or as EAS environment variables (cloud builds). See README.';

  if (__DEV__) {
    throw new Error(message);
  }
  console.error(message);
}
