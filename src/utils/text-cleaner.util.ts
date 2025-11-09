/**
 * Utility function to clean excessive line breaks from text
 * Replaces 3 or more consecutive line breaks with maximum 2 line breaks
 * 
 * Example:
 * "text\n\n\n\n\nmore text" becomes "text\n\nmore text"
 */
export function cleanTextLineBreaks(text: string): string {
  if (!text) {
    return text;
  }

  // Replace 3 or more consecutive newlines with exactly 2 newlines
  // This regex matches \n\n\n (3 newlines) or more and replaces with \n\n
  return text.replace(/\n{3,}/g, '\n\n');
}


