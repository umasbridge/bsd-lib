/**
 * Canonicalize inline styles to ensure consistent formatting
 *
 * Normalizes:
 * - Font weights (bold -> 700, normal -> 400)
 * - Colors (rgb -> hex, lowercase)
 * - Font sizes (all to px, rounded integers)
 * - Property ordering (alphabetical)
 */

/**
 * Convert RGB/RGBA color to hex format
 */
function rgbToHex(rgb) {
  const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (!match) return rgb;

  const r = parseInt(match[1]);
  const g = parseInt(match[2]);
  const b = parseInt(match[3]);
  const a = match[4] ? parseFloat(match[4]) : 1;

  if (a < 1) {
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }

  const toHex = (n) => n.toString(16).padStart(2, '0');
  const hex = `#${toHex(r)}${toHex(g)}${toHex(b)}`;

  if (hex[1] === hex[2] && hex[3] === hex[4] && hex[5] === hex[6]) {
    return `#${hex[1]}${hex[3]}${hex[5]}`;
  }

  return hex;
}

function normalizeFontWeight(weight) {
  const normalized = {
    'bold': '700',
    'bolder': '900',
    'lighter': '300',
    'normal': '400',
  };
  return normalized[weight.toLowerCase()] || weight;
}

function normalizeFontSize(size) {
  if (size.endsWith('px')) {
    return Math.round(parseFloat(size)) + 'px';
  }
  if (size.endsWith('pt')) {
    return Math.round(parseFloat(size) * 1.333) + 'px';
  }
  return size;
}

function normalizeColor(color) {
  if (color.startsWith('rgb')) {
    return rgbToHex(color).toLowerCase();
  }
  if (color.startsWith('#')) {
    const hex = color.toLowerCase();
    if (hex.length === 7 && hex[1] === hex[2] && hex[3] === hex[4] && hex[5] === hex[6]) {
      return `#${hex[1]}${hex[3]}${hex[5]}`;
    }
    return hex;
  }
  return color.toLowerCase();
}

function normalizeFontFamily(fontFamily) {
  return fontFamily.replace(/['"]/g, '').trim();
}

/**
 * Canonicalize inline style object
 * @param {CSSStyleDeclaration} style
 * @returns {Record<string, string>}
 */
export function canonicalizeInlineStyle(style) {
  const result = {};

  const relevantProps = [
    'background-color',
    'color',
    'font-family',
    'font-size',
    'font-style',
    'font-weight',
    'text-align',
    'text-decoration',
  ];

  for (const prop of relevantProps) {
    const value = style.getPropertyValue(prop);
    if (!value) continue;

    let normalized = value;

    switch (prop) {
      case 'font-weight':
        normalized = normalizeFontWeight(value);
        break;
      case 'font-size':
        normalized = normalizeFontSize(value);
        break;
      case 'color':
      case 'background-color':
        normalized = normalizeColor(value);
        break;
      case 'font-family':
        normalized = normalizeFontFamily(value);
        break;
    }

    if (normalized && normalized !== 'normal' && normalized !== 'inherit') {
      result[prop] = normalized;
    }
  }

  return result;
}

/**
 * Convert a style record back to a style string
 * @param {Record<string, string>} styleRecord
 * @returns {string}
 */
export function styleRecordToString(styleRecord) {
  return Object.entries(styleRecord)
    .map(([prop, value]) => `${prop}: ${value}`)
    .join('; ');
}

/**
 * Compare two style records for equality
 * @param {Record<string, string>} style1
 * @param {Record<string, string>} style2
 * @returns {boolean}
 */
export function areStylesEqual(style1, style2) {
  const keys1 = Object.keys(style1).sort();
  const keys2 = Object.keys(style2).sort();

  if (keys1.length !== keys2.length) return false;

  for (let i = 0; i < keys1.length; i++) {
    if (keys1[i] !== keys2[i]) return false;
    if (style1[keys1[i]] !== style2[keys2[i]]) return false;
  }

  return true;
}
