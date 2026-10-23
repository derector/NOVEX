export function splitLyricsIntoLines(value, options = {}) {
  const maxWords = Math.max(3, Math.min(12, Number(options.maxWords) || 6));
  const minWords = Math.max(2, Math.min(maxWords, Number(options.minWords) || 3));
  const text = String(value ?? '').replace(/\r\n?/gu, '\n').trim();
  if (!text) return [];

  const paragraphs = text
    .split(/\n+/u)
    .map((line) => line.trim().replace(/\s+/gu, ' '))
    .filter(Boolean);
  const lines = [];

  for (const paragraph of paragraphs) {
    const words = paragraph.split(' ');
    let pending = [];
    const paragraphLines = [];

    for (const word of words) {
      pending.push(word);
      const sentenceEnd = /[.!?…]$/u.test(word);
      if (pending.length >= maxWords || (pending.length >= minWords && sentenceEnd)) {
        paragraphLines.push(pending.join(' '));
        pending = [];
      }
    }

    if (pending.length) {
      const previous = paragraphLines.at(-1);
      const previousLength = previous ? previous.split(' ').length : maxWords;
      if (pending.length <= 2 && previous && previousLength + pending.length <= maxWords) {
        paragraphLines[paragraphLines.length - 1] += ` ${pending.join(' ')}`;
      } else {
        paragraphLines.push(pending.join(' '));
      }
    }
    lines.push(...paragraphLines);
  }

  return lines;
}
