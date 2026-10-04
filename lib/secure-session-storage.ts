import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// SecureStore warns above 2048 bytes per value; a Supabase session is larger.
const MAX_CHUNK_BYTES = 1800;

const SECURE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

type Manifest = { v: 1; id: string; n: number };

export type AuthStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

function byteLength(codePoint: number) {
  if (codePoint < 0x80) return 1;
  if (codePoint < 0x800) return 2;
  if (codePoint < 0x10000) return 3;
  return 4;
}

export function splitByBytes(value: string, maxBytes = MAX_CHUNK_BYTES): string[] {
  const chunks: string[] = [];
  let current = '';
  let currentBytes = 0;

  for (const char of value) {
    const size = byteLength(char.codePointAt(0)!);
    if (currentBytes + size > maxBytes) {
      chunks.push(current);
      current = '';
      currentBytes = 0;
    }
    current += char;
    currentBytes += size;
  }

  if (current) {
    chunks.push(current);
  }

  return chunks;
}

function chunkKey(key: string, id: string, index: number) {
  return `${key}.${id}.${index}`;
}

function newGenerationId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function parseManifest(raw: string): Manifest | null {
  try {
    const value = JSON.parse(raw) as Partial<Manifest> | null;
    const valid = !!value
      && value.v === 1
      && typeof value.id === 'string'
      && /^[A-Za-z0-9]+$/.test(value.id)
      && typeof value.n === 'number'
      && Number.isInteger(value.n)
      && value.n >= 0;
    return valid ? (value as Manifest) : null;
  } catch {
    return null;
  }
}

async function readManifest(key: string) {
  const raw = await SecureStore.getItemAsync(key, SECURE_OPTIONS);
  return raw === null ? null : parseManifest(raw);
}

async function deleteChunks(key: string, manifest: Manifest) {
  await Promise.all(
    Array.from({ length: manifest.n }, (_, index) =>
      SecureStore.deleteItemAsync(chunkKey(key, manifest.id, index), SECURE_OPTIONS)
    )
  );
}

// Chunks are written under a fresh generation id and only become visible once the manifest
// (stored at `key`) is swapped, so an interrupted write never leaves a half-readable session.
async function writeSecure(key: string, value: string) {
  const previous = await readManifest(key);
  const id = newGenerationId();
  const chunks = splitByBytes(value);

  await Promise.all(
    chunks.map((chunk, index) => SecureStore.setItemAsync(chunkKey(key, id, index), chunk, SECURE_OPTIONS))
  );
  const manifest: Manifest = { v: 1, id, n: chunks.length };
  await SecureStore.setItemAsync(key, JSON.stringify(manifest), SECURE_OPTIONS);

  if (previous) {
    await deleteChunks(key, previous).catch(() => undefined);
  }
}

async function readSecure(key: string): Promise<string | null | undefined> {
  const raw = await SecureStore.getItemAsync(key, SECURE_OPTIONS);
  if (raw === null) {
    return undefined;
  }

  const manifest = parseManifest(raw);
  if (!manifest) {
    return null;
  }

  const parts = await Promise.all(
    Array.from({ length: manifest.n }, (_, index) =>
      SecureStore.getItemAsync(chunkKey(key, manifest.id, index), SECURE_OPTIONS)
    )
  );

  return parts.some((part) => part === null) ? null : parts.join('');
}

export const secureSessionStorage: AuthStorage = {
  async getItem(key) {
    const secureValue = await readSecure(key);
    if (secureValue !== undefined) {
      return secureValue;
    }

    // Sessions saved by older builds live in plaintext AsyncStorage; move them over on first read.
    const legacyValue = await AsyncStorage.getItem(key);
    if (legacyValue === null) {
      return null;
    }

    try {
      await writeSecure(key, legacyValue);
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.warn('[auth] Session migration to secure storage failed', {
        message: error instanceof Error ? error.message : String(error),
      });
    }

    return legacyValue;
  },

  async setItem(key, value) {
    await writeSecure(key, value);
    await AsyncStorage.removeItem(key);
  },

  async removeItem(key) {
    const manifest = await readManifest(key);
    await SecureStore.deleteItemAsync(key, SECURE_OPTIONS);
    if (manifest) {
      await deleteChunks(key, manifest).catch(() => undefined);
    }
    await AsyncStorage.removeItem(key);
  },
};

export const authStorage: AuthStorage = Platform.OS === 'web' ? AsyncStorage : secureSessionStorage;
