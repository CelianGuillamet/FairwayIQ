import { Directory, File, Paths } from 'expo-file-system';
import type { ExportFile } from './export-document';

const EXPORT_DIRECTORY = 'fairwayiq-export';

export function writeExportFile(file: ExportFile): string {
  const directory = new Directory(Paths.cache, EXPORT_DIRECTORY);
  directory.create({ intermediates: true, idempotent: true });

  // Earlier exports hold personal data: keep only the current one in the cache.
  for (const entry of directory.list()) {
    entry.delete();
  }

  const target = new File(directory, file.name);
  target.create();
  target.write(file.content);

  return target.uri;
}
