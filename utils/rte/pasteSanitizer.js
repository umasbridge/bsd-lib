/**
 * Paste Sanitization
 *
 * Cleans pasted HTML from external sources (Google Docs, Word, etc.)
 * to ensure consistent formatting and remove unwanted metadata.
 */

const ALLOWED_ELEMENTS = new Set([
  'SPAN', 'BR', 'DIV', 'P', 'UL', 'OL', 'LI',
  'STRONG', 'B', 'EM', 'I', 'U', 'A', 'IMG',
]);

// Note: font-family intentionally excluded so pasted text uses app's default font
const ALLOWED_STYLES = new Set([
  'color', 'background-color', 'font-weight',
  'font-style', 'text-decoration', 'text-align',
]);

const STRIP_ELEMENTS = new Set([
  'SCRIPT', 'STYLE', 'META', 'LINK',
  'OBJECT', 'EMBED', 'IFRAME',
]);

const OFFICE_ARTIFACTS = new Set([
  'O:P', 'W:SDT', 'W:SDTPR', 'W:SDTCONTENT',
  'V:SHAPE', 'V:IMAGEDATA',
]);

function sanitizeStyle(styleAttr) {
  const styles = [];
  const declarations = styleAttr.split(';');

  for (const decl of declarations) {
    const [prop, value] = decl.split(':').map(s => s.trim());
    if (!prop || !value) continue;

    if (ALLOWED_STYLES.has(prop)) {
      if (!prop.startsWith('-webkit-') && !prop.startsWith('-moz-') && !prop.startsWith('-ms-')) {
        styles.push(`${prop}: ${value}`);
      }
    }
  }

  return styles.join('; ');
}

function convertLegacyTag(elem) {
  const span = document.createElement('span');
  const tagName = elem.tagName.toUpperCase();

  switch (tagName) {
    case 'STRONG':
    case 'B':
      span.style.fontWeight = '700';
      break;
    case 'EM':
    case 'I':
      span.style.fontStyle = 'italic';
      break;
    case 'U':
      span.style.textDecoration = 'underline';
      break;
  }

  if (elem.hasAttribute('style')) {
    const existingStyle = sanitizeStyle(elem.getAttribute('style') || '');
    const mergedStyle = span.getAttribute('style') + '; ' + existingStyle;
    span.setAttribute('style', mergedStyle);
  }

  while (elem.firstChild) {
    span.appendChild(elem.firstChild);
  }

  for (const attr of Array.from(elem.attributes)) {
    if (attr.name.startsWith('data-') && attr.name !== 'data-kix' && !attr.name.startsWith('data-kix-')) {
      span.setAttribute(attr.name, attr.value);
    }
  }

  return span;
}

function sanitizeNode(node, isRoot = false) {
  if (node.nodeType === Node.TEXT_NODE) {
    let text = node.textContent || '';
    text = text.replace(/\s+/g, ' ');
    if (!isRoot) {
      text = text.trim();
    }
    if (!text) return null;
    return document.createTextNode(text);
  }

  if (node.nodeType === Node.ELEMENT_NODE) {
    const elem = node;
    const tagName = elem.tagName.toUpperCase();

    if (STRIP_ELEMENTS.has(tagName) || OFFICE_ARTIFACTS.has(tagName)) {
      return null;
    }

    // Strip Google Docs metadata spans
    if (tagName === 'SPAN' && elem.className && elem.className.includes('kix-')) {
      const fragment = document.createDocumentFragment();
      for (const child of Array.from(elem.childNodes)) {
        const sanitized = sanitizeNode(child);
        if (sanitized) fragment.appendChild(sanitized);
      }
      return fragment;
    }

    // Convert block elements to inline + BR
    if (tagName === 'DIV' || tagName === 'P') {
      const fragment = document.createDocumentFragment();
      for (const child of Array.from(elem.childNodes)) {
        const sanitized = sanitizeNode(child);
        if (sanitized) fragment.appendChild(sanitized);
      }
      if (!isRoot) {
        fragment.appendChild(document.createElement('br'));
      }
      return fragment;
    }

    // Convert legacy formatting tags
    if (tagName === 'STRONG' || tagName === 'B' || tagName === 'EM' || tagName === 'I' || tagName === 'U') {
      const span = convertLegacyTag(elem);
      const children = Array.from(span.childNodes);
      span.innerHTML = '';
      for (const child of children) {
        const sanitized = sanitizeNode(child);
        if (sanitized) span.appendChild(sanitized);
      }
      return span;
    }

    if (!ALLOWED_ELEMENTS.has(tagName)) {
      const fragment = document.createDocumentFragment();
      for (const child of Array.from(elem.childNodes)) {
        const sanitized = sanitizeNode(child);
        if (sanitized) fragment.appendChild(sanitized);
      }
      return fragment;
    }

    const cleaned = document.createElement(tagName);

    if (elem.hasAttribute('style')) {
      const sanitizedStyle = sanitizeStyle(elem.getAttribute('style') || '');
      if (sanitizedStyle) {
        cleaned.setAttribute('style', sanitizedStyle);
      }
    }

    if (tagName === 'A' && elem.hasAttribute('href')) {
      cleaned.setAttribute('href', elem.getAttribute('href') || '');
    }

    if (tagName === 'IMG') {
      for (const attr of ['src', 'width', 'height', 'alt']) {
        if (elem.hasAttribute(attr)) cleaned.setAttribute(attr, elem.getAttribute(attr) || '');
      }
    }

    for (const child of Array.from(elem.childNodes)) {
      const sanitized = sanitizeNode(child);
      if (sanitized) cleaned.appendChild(sanitized);
    }

    return cleaned;
  }

  return null;
}

/**
 * Sanitize pasted HTML and return a clean DocumentFragment
 * @param {string} html
 * @returns {DocumentFragment}
 */
export function sanitizePastedHTML(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const fragment = document.createDocumentFragment();
  const body = doc.body;
  if (!body) return fragment;

  for (const child of Array.from(body.childNodes)) {
    const sanitized = sanitizeNode(child, true);
    if (sanitized) {
      fragment.appendChild(sanitized);
    }
  }

  const lastChild = fragment.lastChild;
  if (lastChild && lastChild.nodeType === Node.ELEMENT_NODE) {
    if (lastChild.tagName === 'BR') {
      lastChild.remove();
    }
  }

  return fragment;
}

/**
 * Get pasted content from clipboard event
 * @param {ClipboardEvent} event
 * @returns {string}
 */
export function getClipboardContent(event) {
  const clipboardData = event.clipboardData;
  if (!clipboardData) return '';

  const html = clipboardData.getData('text/html');
  if (html) return html;

  const text = clipboardData.getData('text/plain');
  if (text) {
    return text.split('\n').join('<br>');
  }

  return '';
}
