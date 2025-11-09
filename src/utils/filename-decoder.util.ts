/**
 * Utility function to decode filenames with proper UTF-8 handling
 * Fixes issues with Cyrillic characters (Ukrainian, Russian) in filenames
 * 
 * Common issue: UTF-8 bytes are interpreted as Latin-1 (ISO-8859-1)
 * Example: "План онбордингу" becomes "ÐŸÐ»Ð°Ð½ Ð¾Ð½Ð±Ð¾Ñ€Ð´Ñ–Ð½Ð³Ñƒ"
 */
export function decodeFilename(filename: string): string {
  if (!filename) {
    return filename;
  }

  try {
    // Step 1: Try to decode if it looks like URL-encoded
    if (filename.includes('%')) {
      try {
        const decoded = decodeURIComponent(filename);
        if (decoded !== filename && isValidUTF8(decoded)) {
          return decoded;
        }
      } catch (e) {
        // If URL decoding fails, continue with other methods
      }
    }

    // Step 2: Most common issue - UTF-8 bytes interpreted as Latin-1
    // This happens when multer receives UTF-8 encoded filenames but interprets them as Latin-1
    try {
      // Convert the string as if it were Latin-1, then interpret as UTF-8
      const buffer = Buffer.from(filename, 'latin1');
      const decoded = buffer.toString('utf8');
      
      // Check if decoding produced valid results
      // If the decoded string contains Cyrillic characters, it's likely the correct decoding
      if (decoded !== filename && isValidUTF8(decoded)) {
        // If original doesn't contain Cyrillic but decoded does, use decoded
        if (containsCyrillic(decoded) && !containsCyrillic(filename)) {
          return decoded;
        }
        // If decoded contains fewer invalid characters (mojibake), prefer it
        if (countInvalidChars(decoded) < countInvalidChars(filename)) {
          return decoded;
        }
      }
    } catch (e) {
      // If this method fails, continue
    }

    // Step 3: Try Windows-1252 to UTF-8 conversion (similar to Latin-1 but handles some special chars)
    try {
      const buffer = Buffer.from(filename, 'binary');
      const decoded = buffer.toString('utf8');
      if (decoded !== filename && isValidUTF8(decoded) && containsCyrillic(decoded)) {
        return decoded;
      }
    } catch (e) {
      // If this method fails, continue
    }

    // If no decoding method worked, return original filename
    return filename;
  } catch (error) {
    console.error('Error decoding filename:', error);
    return filename;
  }
}

/**
 * Check if string contains Cyrillic characters
 */
function containsCyrillic(str: string): boolean {
  // Cyrillic Unicode range: U+0400 to U+04FF
  return /[\u0400-\u04FF]/.test(str);
}

/**
 * Check if string is valid UTF-8
 */
function isValidUTF8(str: string): boolean {
  try {
    // Try to encode and decode to check if it's valid UTF-8
    const encoded = Buffer.from(str, 'utf8');
    const decoded = encoded.toString('utf8');
    return decoded === str;
  } catch (e) {
    return false;
  }
}

/**
 * Count invalid/weird characters that might indicate encoding issues
 * (e.g., sequences like ÐŸ, Ð», Ð° which are common in misencoded Cyrillic)
 */
function countInvalidChars(str: string): number {
  // Count sequences that look like misencoded UTF-8 (common mojibake patterns)
  const mojibakePattern = /Ð[ÐÑ-ÿ]/g;
  const matches = str.match(mojibakePattern);
  return matches ? matches.length : 0;
}

