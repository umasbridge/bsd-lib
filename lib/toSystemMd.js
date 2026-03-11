/**
 * toSystemMd.js — Intermediate Structure → Markdown
 *
 * Serializes the intermediate bidding system object back to a system.md string.
 * This is the reverse of parseSystemMd.
 */

import { replaceSuitAbbreviations } from './suitSymbols.js';

/**
 * Write table rows as pipe-delimited lines with indentation for nesting.
 * Each nesting level adds 2 spaces in the bid column.
 */
function sanitizeRowText(text) {
  // MD rows must be single-line; collapse newlines and extra spaces
  let clean = (text || '').replace(/[\n\r]+/g, ' ').replace(/\s+/g, ' ').trim();
  // Convert suit abbreviations to Unicode symbols
  return replaceSuitAbbreviations(clean);
}

function writeRows(rows, level) {
  let md = '';
  for (const row of rows) {
    const indent = '  '.repeat(level);
    if (row.columns && row.columns.length > 1) {
      // Multi-column: | bid | col1 | col2 | ... |
      const colParts = row.columns.map(c => ` ${sanitizeRowText(c)} `).join('|');
      md += `| ${indent}${sanitizeRowText(row.bid)} |${colParts}|\n`;
    } else {
      md += `| ${indent}${sanitizeRowText(row.bid)} | ${sanitizeRowText(row.meaning)} |\n`;
    }
    if (row.children && row.children.length > 0) {
      md += writeRows(row.children, level + 1);
    }
  }
  return md;
}

/**
 * Write elements (notes and tables) to markdown.
 */
function writeElements(elements) {
  let md = '';
  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    if (el.type === 'note') {
      md += replaceSuitAbbreviations(el.content) + '\n\n';
      // Separate consecutive notes with --- so they stay as distinct elements on re-parse
      if (i + 1 < elements.length && elements[i + 1].type === 'note') {
        md += '---\n\n';
      }
    } else if (el.type === 'html') {
      md += '~~~html\n';
      md += el.content + '\n';
      md += '~~~\n\n';
    } else if (el.type === 'table') {
      md += `## ${el.name || ''}\n`;
      md += writeRows(el.rows || [], 0);
      md += '\n';
    }
  }
  return md;
}

/**
 * Serialize the intermediate structure to a markdown string.
 * All pages are written as # headings in order.
 *
 * @param {{ systemName: string, description: string, pages: object[] }} system
 * @returns {string}
 */
export function toSystemMd(system) {
  let md = '---\n';
  md += `system: ${system.systemName || ''}\n`;
  md += `description: ${system.description || ''}\n`;
  md += '---\n\n';

  // Root elements (before any page heading)
  md += writeElements(system.rootElements || []);

  for (const page of system.pages || []) {
    md += `# ${page.name}\n\n`;
    md += writeElements(page.elements || []);
  }

  // Clean up: collapse multiple blank lines into at most two
  md = md.replace(/\n{3,}/g, '\n\n');

  return md.trim() + '\n';
}
