import type { AssetContentType } from "./manifest";

/**
 * The real type of an asset comes from its bytes, never from its extension or
 * from what the manifest claims (platform-security: uploads are untrusted).
 */
export function sniffImageType(bytes: Uint8Array): AssetContentType | null {
  if (bytes.length < 12) return null;
  const b = bytes;
  if (
    b[0] === 0x89 &&
    b[1] === 0x50 &&
    b[2] === 0x4e &&
    b[3] === 0x47 &&
    b[4] === 0x0d &&
    b[5] === 0x0a &&
    b[6] === 0x1a &&
    b[7] === 0x0a
  ) {
    return "image/png";
  }
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (
    b[0] === 0x47 &&
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x38 &&
    (b[4] === 0x37 || b[4] === 0x39) &&
    b[5] === 0x61
  ) {
    return "image/gif";
  }
  if (
    b[0] === 0x52 &&
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x46 &&
    b[8] === 0x57 &&
    b[9] === 0x45 &&
    b[10] === 0x42 &&
    b[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

/** The extension an asset of this type is stored under inside a package. */
export function assetExtension(type: AssetContentType): string {
  switch (type) {
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
  }
}
