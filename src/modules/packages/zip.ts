import { unzipSync, zipSync } from "fflate";

/**
 * The zip layer of a package. Reading goes through the central directory
 * first, so an entry's real size, its mode (symlinks) and its name are known
 * before a single byte is inflated; limits apply before decompression.
 */

export interface ZipEntry {
  name: string;
  uncompressedSize: number;
  compressedSize: number;
  isDirectory: boolean;
  isSymlink: boolean;
}

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const UNIX_SYMLINK = 0xa000;

export class ZipFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ZipFormatError";
  }
}

/** Lists the entries of a zip from its central directory without inflating anything. */
export function listZipEntries(bytes: Uint8Array): ZipEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const min = Math.max(0, bytes.length - 65_557);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= min; i--) {
    if (view.getUint32(i, true) === EOCD_SIGNATURE) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new ZipFormatError("not a zip archive");

  const count = view.getUint16(eocd + 10, true);
  const dirOffset = view.getUint32(eocd + 16, true);
  const entries: ZipEntry[] = [];
  let pos = dirOffset;
  const decoder = new TextDecoder();
  for (let i = 0; i < count; i++) {
    if (pos + 46 > bytes.length || view.getUint32(pos, true) !== CENTRAL_SIGNATURE) {
      throw new ZipFormatError("corrupt central directory");
    }
    const compressedSize = view.getUint32(pos + 20, true);
    const uncompressedSize = view.getUint32(pos + 24, true);
    const nameLength = view.getUint16(pos + 28, true);
    const extraLength = view.getUint16(pos + 30, true);
    const commentLength = view.getUint16(pos + 32, true);
    const externalAttrs = view.getUint32(pos + 38, true);
    const name = decoder.decode(bytes.subarray(pos + 46, pos + 46 + nameLength));
    const mode = externalAttrs >>> 16;
    entries.push({
      name,
      uncompressedSize,
      compressedSize,
      isDirectory: name.endsWith("/") || (externalAttrs & 0x10) !== 0,
      isSymlink: (mode & 0xf000) === UNIX_SYMLINK,
    });
    pos += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

/** Inflates the listed entries, refusing any whose declared size exceeds its limit. */
export function readZipEntries(bytes: Uint8Array, maxEntryBytes: (name: string) => number): Record<string, Uint8Array> {
  return unzipSync(bytes, {
    filter: (file) => file.originalSize <= maxEntryBytes(file.name),
  });
}

const FIXED_MTIME = new Date("1980-01-01T00:00:00Z");

/** Deterministic: the same entries always give the same bytes (no timestamps, sorted names). */
export function writeZip(entries: Record<string, Uint8Array>): Uint8Array {
  const sorted = Object.fromEntries(Object.entries(entries).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  return zipSync(sorted, { level: 6, mtime: FIXED_MTIME });
}
