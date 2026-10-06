const mockEvents: string[] = [];
let mockEntries: { delete: jest.Mock }[] = [];
let mockWriteError: Error | null = null;
let mockCreateError: Error | null = null;

jest.mock('expo-file-system', () => {
  class Directory {
    uri: string;

    constructor(...parts: ({ uri: string } | string)[]) {
      this.uri = parts.map((part) => (typeof part === 'string' ? part : part.uri)).join('/');
    }

    create(options: unknown) {
      mockEvents.push(`dir.create ${JSON.stringify(options)}`);
    }

    list() {
      return mockEntries;
    }
  }

  class File {
    uri: string;

    constructor(...parts: ({ uri: string } | string)[]) {
      this.uri = parts.map((part) => (typeof part === 'string' ? part : part.uri)).join('/');
    }

    create() {
      if (mockCreateError) throw mockCreateError;
      mockEvents.push(`file.create ${this.uri}`);
    }

    write(content: string) {
      if (mockWriteError) throw mockWriteError;
      mockEvents.push(`file.write ${content}`);
    }
  }

  return { Directory, File, Paths: { cache: { uri: 'file:///cache' } } };
});

import { writeExportFile } from './export-files';

const FILE = {
  name: 'fairwayiq-rounds-2026-10-05.csv',
  content: '﻿Date;Parcours\r\n',
  mimeType: 'text/csv',
  uti: 'public.comma-separated-values-text',
};

beforeEach(() => {
  mockEvents.length = 0;
  mockEntries = [];
  mockWriteError = null;
  mockCreateError = null;
});

describe('writeExportFile', () => {
  it('writes the content, BOM included, into an export folder of the cache', () => {
    const uri = writeExportFile(FILE);

    expect(uri).toBe('file:///cache/fairwayiq-export/fairwayiq-rounds-2026-10-05.csv');
    expect(mockEvents).toEqual([
      'dir.create {"intermediates":true,"idempotent":true}',
      'file.create file:///cache/fairwayiq-export/fairwayiq-rounds-2026-10-05.csv',
      'file.write ﻿Date;Parcours\r\n',
    ]);
  });

  it('removes the previous exports before writing the new one', () => {
    mockEntries = [{ delete: jest.fn() }, { delete: jest.fn() }];
    const [first, second] = mockEntries;

    writeExportFile(FILE);

    expect(first.delete).toHaveBeenCalledTimes(1);
    expect(second.delete).toHaveBeenCalledTimes(1);
  });

  it('lets a failing write reach the caller', () => {
    mockWriteError = new Error('No space left on device');

    expect(() => writeExportFile(FILE)).toThrow('No space left on device');
  });

  it('lets a failing file creation reach the caller', () => {
    mockCreateError = new Error('Permission denied');

    expect(() => writeExportFile(FILE)).toThrow('Permission denied');
    expect(mockEvents.some((event) => event.startsWith('file.write'))).toBe(false);
  });
});
