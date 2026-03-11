/**
 * DOM Tree Normalization Engine
 *
 * Ensures consistent, canonical DOM structure by:
 * - Flattening nested spans with identical styles
 * - Merging adjacent spans with identical styles
 * - Converting legacy tags to canonical spans
 * - Removing empty nodes
 * - Normalizing style values
 */

import {
  canonicalizeInlineStyle,
  styleRecordToString,
  areStylesEqual,
} from './canonicalizeStyle';

const PRESERVED_ELEMENTS = new Set(['A', 'IMG', 'BR', 'UL', 'OL', 'LI']);
const BLOCK_ELEMENTS = new Set(['DIV', 'P', 'UL', 'OL', 'LI']);

const LEGACY_INLINE_TAGS = {
  'B': { 'font-weight': '700' },
  'STRONG': { 'font-weight': '700' },
  'I': { 'font-style': 'italic' },
  'EM': { 'font-style': 'italic' },
  'U': { 'text-decoration': 'underline' },
};

function isWhitespaceTextNode(node) {
  return node.nodeType === Node.TEXT_NODE && !/\S/.test(node.textContent || '');
}

function isEmptyNode(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    return !node.textContent;
  }

  if (node.nodeType === Node.ELEMENT_NODE) {
    const elem = node;
    if (elem.tagName === 'BR') return false;
    if (elem.tagName === 'IMG') return false;
    if (elem.childNodes.length === 0) return true;
    if (elem.childNodes.length === 1 && isWhitespaceTextNode(elem.childNodes[0])) {
      return true;
    }
  }

  return false;
}

function getCanonicalStyle(elem) {
  return canonicalizeInlineStyle(elem.style);
}

function convertLegacyTag(elem) {
  const tagName = elem.tagName.toUpperCase();
  const legacyStyle = LEGACY_INLINE_TAGS[tagName];

  if (!legacyStyle) return null;

  const span = document.createElement('span');
  const existingStyle = getCanonicalStyle(elem);
  const mergedStyle = { ...legacyStyle, ...existingStyle };

  span.setAttribute('style', styleRecordToString(mergedStyle));

  while (elem.firstChild) {
    span.appendChild(elem.firstChild);
  }

  for (const attr of Array.from(elem.attributes)) {
    if (attr.name !== 'style') {
      span.setAttribute(attr.name, attr.value);
    }
  }

  return span;
}

function convertFontTag(elem) {
  const span = document.createElement('span');
  const style = {};

  const color = elem.getAttribute('color');
  const face = elem.getAttribute('face');
  const size = elem.getAttribute('size');

  if (color) style['color'] = color;
  if (face) style['font-family'] = face;
  if (size) {
    const sizeMap = {
      '1': '10px', '2': '13px', '3': '16px', '4': '18px',
      '5': '24px', '6': '32px', '7': '48px',
    };
    style['font-size'] = sizeMap[size] || '16px';
  }

  const existingStyle = getCanonicalStyle(elem);
  const mergedStyle = { ...style, ...existingStyle };

  if (Object.keys(mergedStyle).length > 0) {
    span.setAttribute('style', styleRecordToString(mergedStyle));
  }

  while (elem.firstChild) {
    span.appendChild(elem.firstChild);
  }

  return span;
}

function flattenNestedSpans(elem) {
  if (elem.tagName !== 'SPAN') return;

  const parentStyle = getCanonicalStyle(elem);
  const children = Array.from(elem.childNodes);

  for (const child of children) {
    if (child.nodeType !== Node.ELEMENT_NODE) continue;

    const childElem = child;
    if (childElem.tagName !== 'SPAN') continue;
    if (childElem.hasAttribute('data-rte-bookmark')) continue;

    const childStyle = getCanonicalStyle(childElem);

    if (Object.keys(childStyle).length === 0) {
      while (childElem.firstChild) {
        elem.insertBefore(childElem.firstChild, childElem);
      }
      childElem.remove();
      continue;
    }

    if (areStylesEqual(parentStyle, childStyle)) {
      while (childElem.firstChild) {
        elem.insertBefore(childElem.firstChild, childElem);
      }
      childElem.remove();
      continue;
    }

    if (Object.keys(parentStyle).length === 0) {
      elem.setAttribute('style', styleRecordToString(childStyle));
      while (childElem.firstChild) {
        elem.insertBefore(childElem.firstChild, childElem);
      }
      childElem.remove();
    }
  }
}

function mergeAdjacentSpans(parent) {
  const children = Array.from(parent.childNodes);

  for (let i = 0; i < children.length - 1; i++) {
    const current = children[i];
    const next = children[i + 1];

    if (current.nodeType !== Node.ELEMENT_NODE || next.nodeType !== Node.ELEMENT_NODE) {
      continue;
    }

    const currentElem = current;
    const nextElem = next;

    if (currentElem.tagName !== 'SPAN' || nextElem.tagName !== 'SPAN') continue;
    if (currentElem.hasAttribute('data-rte-bookmark') || nextElem.hasAttribute('data-rte-bookmark')) continue;

    const currentStyle = getCanonicalStyle(currentElem);
    const nextStyle = getCanonicalStyle(nextElem);

    if (!areStylesEqual(currentStyle, nextStyle)) continue;

    const currentAttrs = Array.from(currentElem.attributes).filter(a => a.name !== 'style');
    const nextAttrs = Array.from(nextElem.attributes).filter(a => a.name !== 'style');

    if (currentAttrs.length !== nextAttrs.length) continue;

    const attrsMatch = currentAttrs.every(attr =>
      nextElem.getAttribute(attr.name) === attr.value
    );

    if (!attrsMatch) continue;

    while (nextElem.firstChild) {
      currentElem.appendChild(nextElem.firstChild);
    }

    nextElem.remove();
    children.splice(i + 1, 1);
    i--;
  }
}

function collapseConsecutiveBRs(parent) {
  const children = Array.from(parent.childNodes);

  for (let i = 0; i < children.length - 1; i++) {
    const current = children[i];
    const next = children[i + 1];

    if (current.nodeType === Node.ELEMENT_NODE && next.nodeType === Node.ELEMENT_NODE) {
      if (current.tagName === 'BR' && next.tagName === 'BR') {
        next.remove();
        children.splice(i + 1, 1);
        i--;
      }
    }
  }
}

function normalizeRecursive(node) {
  if (node.nodeType !== Node.ELEMENT_NODE) return;

  const elem = node;
  const tagName = elem.tagName.toUpperCase();

  if (LEGACY_INLINE_TAGS[tagName]) {
    const span = convertLegacyTag(elem);
    if (span && elem.parentNode) {
      elem.parentNode.replaceChild(span, elem);
      normalizeRecursive(span);
      return;
    }
  }

  if (tagName === 'FONT') {
    const span = convertFontTag(elem);
    if (elem.parentNode) {
      elem.parentNode.replaceChild(span, elem);
      normalizeRecursive(span);
      return;
    }
  }

  if (tagName === 'SPAN' && elem.hasAttribute('style')) {
    const canonicalStyle = getCanonicalStyle(elem);
    if (Object.keys(canonicalStyle).length > 0) {
      elem.setAttribute('style', styleRecordToString(canonicalStyle));
    } else {
      elem.removeAttribute('style');
    }
  }

  const children = Array.from(elem.childNodes);
  for (const child of children) {
    normalizeRecursive(child);
  }

  for (const child of Array.from(elem.childNodes)) {
    if (isEmptyNode(child) && child.nodeType === Node.TEXT_NODE) {
      child.remove();
    }
  }

  if (tagName === 'SPAN') {
    flattenNestedSpans(elem);
  }

  mergeAdjacentSpans(elem);
  collapseConsecutiveBRs(elem);

  if (tagName === 'SPAN' && isEmptyNode(elem)) {
    elem.remove();
  }
}

/**
 * Main entry point: normalize a contenteditable DOM tree
 * @param {HTMLElement} root
 */
export function normalizeNodeTree(root) {
  const children = Array.from(root.childNodes);
  for (const child of children) {
    normalizeRecursive(child);
  }

  mergeAdjacentSpans(root);
  collapseConsecutiveBRs(root);

  for (const child of Array.from(root.childNodes)) {
    if (isEmptyNode(child) && child.nodeType === Node.TEXT_NODE) {
      child.remove();
    }
  }
}
