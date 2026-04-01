/**
 * suitSymbols.js — Convert suit abbreviations ↔ Unicode symbols ↔ colored HTML.
 *
 * Flow:
 *   On save:  "1c", "2d", "3h", "4s" → "1♣", "2♦", "3♥", "4♠"  (replaceSuitAbbreviations)
 *             "spades" → "♠", "sp" → "♠", "dia" → "♦", "cl" → "♣", etc.
 *   On load:  "1♣" → "1<span style='color:#007700'>♣</span>"     (colorizeSuitSymbols)
 */

const SUIT_MAP = {
  c: '♣', C: '♣',
  d: '♦', D: '♦',
  h: '♥', H: '♥',
  s: '♠', S: '♠',
};

// Multi-char abbreviations after a digit (e.g., "4sp", "3dia", "5cl")
const MULTI_ABBREV_MAP = {
  sp: '♠',
  dia: '♦',
  cl: '♣',
};

// Full suit words (case-insensitive)
const WORD_MAP = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spade: '♠',
  heart: '♥',
  diamond: '♦',
  club: '♣',
};

const SUIT_COLORS = {
  '♣': '#000000',
  '♦': '#cc0000',
  '♥': '#cc0000',
  '♠': '#000000',
};

/**
 * Replace suit abbreviations with Unicode symbols in bidding contexts.
 *
 * Patterns handled (in order):
 *   1. digit + multi-char abbrev: "4sp" → "4♠", "3dia" → "3♦"
 *   2. digit + single letter:     "1c" → "1♣", "2d" → "2♦", "3h" → "3♥", "4s" → "4♠"
 *   3. Full words:                "spades" → "♠", "hearts" → "♥", etc.
 *
 * Does NOT replace: 1M, 1m, NT, Dbl
 */
export function replaceSuitAbbreviations(text) {
  if (!text) return text;

  // 1. Multi-char abbreviations after a digit (with optional + and space): "4sp", "3dia", "5cl", "5+sp", "6+ sp"
  let result = text.replace(/(\d\+?\s?)(sp|dia|cl)(?![a-zA-Z])/gi, (match, prefix, abbrev) => {
    const sym = MULTI_ABBREV_MAP[abbrev.toLowerCase()];
    return sym ? prefix + sym : match;
  });

  // 2. Suit/suit slash patterns after a digit (with optional + and space): "4 c/d", "5+ h/s", "6+ d/h/s"
  result = result.replace(/(\d\+?\s?)([cdhs](?:\/[cdhs])+)(?![a-zA-Z])/gi, (match, prefix, chain) => {
    const converted = chain.replace(/[cdhs]/gi, (s) => SUIT_MAP[s] || SUIT_MAP[s.toLowerCase()] || s);
    return prefix + converted;
  });

  // 3. Single letter after a digit (with optional + and space): "1c", "2d", "3h", "4s", "5+c", "6+ h"
  //    Also matches before "/" when followed by non-suit char: "1s/1n" → "1♠/1n"
  result = result.replace(/(\d\+?\s?)([cdhs])(?![a-zA-Z]|\/[cdhs](?![a-zA-Z]))/gi, (match, prefix, suit) => {
    return prefix + SUIT_MAP[suit];
  });

  // 4. Slash patterns: "h/s", "c/d/h", "♣/d", "sp/dia", "cl/sp", "♠/dia", etc.
  result = result.replace(/(?:sp|dia|cl|[cdhs♣♦♥♠])(?:\/(?:sp|dia|cl|[cdhs♣♦♥♠]))+(?![a-zA-Z])/gi, (match) => {
    const resolve = (s) => SUIT_MAP[s] || SUIT_MAP[s.toLowerCase()] || MULTI_ABBREV_MAP[s.toLowerCase()] || (/[♣♦♥♠]/.test(s) ? s : null);
    const parts = match.split('/');
    const converted = parts.map(p => resolve(p));
    return converted.every(Boolean) ? converted.join('/') : match;
  });

  // 5. Standalone multi-char abbreviations (no digit prefix): "transfer to sp", "bid dia", "5+ cl"
  result = result.replace(/(?<=[\s(,;:!?]|^)(sp|dia|cl)(?![a-zA-Z])/gi, (match, abbrev) => {
    return MULTI_ABBREV_MAP[abbrev.toLowerCase()] || match;
  });

  // 6. Standalone single suit letter: "transfer to h" → "transfer to ♥", "bid c" → "bid ♣"
  //    Must be surrounded by whitespace/punctuation (not inside words like "each", "the")
  result = result.replace(/(?<=[\s(,;:!?\/]|^)([cdhs])(?=[\s),;:.!?<]|$)/gi, (match, suit) => {
    return SUIT_MAP[suit] || SUIT_MAP[suit.toLowerCase()] || match;
  });

  // 6. Full suit words (standalone): "spades" → "♠", "hearts" → "♥", etc.
  result = result.replace(/\b(spades?|hearts?|diamonds?|clubs?)\b/gi, (match) => {
    return WORD_MAP[match.toLowerCase()] || match;
  });

  return result;
}

/**
 * Wrap Unicode suit symbols in colored HTML spans.
 * Called during forward transform (load) to add colors to the rendered HTML.
 */
export function colorizeSuitSymbols(text) {
  if (!text) return text;
  return text.replace(/[♣♦♥♠]/g, (sym) => {
    const color = SUIT_COLORS[sym];
    return `<span style="color:${color}">${sym}</span>`;
  });
}

/**
 * Strip HTML color spans from suit symbols, leaving just the Unicode character.
 * Called during reverse transform (save) to clean HTML back to plain text.
 */
export function stripSuitColorSpans(html) {
  if (!html) return html;
  // Remove <span style="color:...">♣</span> → ♣
  return html.replace(/<span\s+style="color:[^"]*">([♣♦♥♠])<\/span>/g, '$1');
}
