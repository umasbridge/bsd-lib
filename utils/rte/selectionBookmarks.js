/**
 * Selection Bookmark System
 *
 * Preserves selection across DOM mutations by inserting temporary marker elements.
 * Markers survive normalization because they have special data attributes.
 */

function generateBookmarkId() {
  return `rte-bookmark-${crypto.randomUUID()}`;
}

function createBookmark(id, type) {
  const marker = document.createElement('span');
  marker.id = id;
  marker.setAttribute('data-rte-bookmark', type);
  marker.style.display = 'none';
  marker.textContent = '\u200C';
  return marker;
}

function insertBookmarkAtPosition(container, offset, marker) {
  if (container.nodeType === Node.TEXT_NODE) {
    const textNode = container;

    if (offset === 0) {
      textNode.parentNode?.insertBefore(marker, textNode);
    } else if (offset >= textNode.length) {
      if (textNode.nextSibling) {
        textNode.parentNode?.insertBefore(marker, textNode.nextSibling);
      } else {
        textNode.parentNode?.appendChild(marker);
      }
    } else {
      const secondHalf = textNode.splitText(offset);
      textNode.parentNode?.insertBefore(marker, secondHalf);
    }
  } else if (container.nodeType === Node.ELEMENT_NODE) {
    const elem = container;

    if (offset === 0) {
      elem.insertBefore(marker, elem.firstChild);
    } else if (offset >= elem.childNodes.length) {
      elem.appendChild(marker);
    } else {
      elem.insertBefore(marker, elem.childNodes[offset]);
    }
  }
}

function cleanupExistingBookmarks(root) {
  const existingMarkers = root.querySelectorAll('[data-rte-bookmark]');
  existingMarkers.forEach(marker => marker.remove());
}

function isSelectionInRoot(selection, root) {
  if (selection.rangeCount === 0) return false;
  const range = selection.getRangeAt(0);
  return root.contains(range.commonAncestorContainer);
}

/**
 * Save the current selection as bookmark markers
 * @param {HTMLElement} root
 * @returns {{ startId: string, endId: string, isCollapsed: boolean } | null}
 */
export function saveSelectionAsBookmarks(root) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;

  const range = selection.getRangeAt(0);
  if (!isSelectionInRoot(selection, root)) return null;

  cleanupExistingBookmarks(root);

  const startId = generateBookmarkId();
  const endId = generateBookmarkId();
  const isCollapsed = range.collapsed;

  try {
    const startMarker = createBookmark(startId, 'start');
    const endMarker = createBookmark(endId, 'end');

    if (isCollapsed) {
      insertBookmarkAtPosition(range.startContainer, range.startOffset, startMarker);
    } else {
      insertBookmarkAtPosition(range.endContainer, range.endOffset, endMarker);
      insertBookmarkAtPosition(range.startContainer, range.startOffset, startMarker);
    }

    return { startId, endId, isCollapsed };
  } catch (error) {
    console.warn('Failed to save selection bookmarks:', error);
    cleanupExistingBookmarks(root);
    return null;
  }
}

/**
 * Restore selection from bookmark markers
 * @param {HTMLElement} root
 * @param {{ startId: string, endId: string, isCollapsed: boolean }} bookmarks
 * @returns {boolean}
 */
export function restoreSelectionFromBookmarks(root, bookmarks) {
  try {
    const startMarker = root.querySelector(`#${bookmarks.startId}`);
    if (!startMarker) {
      cleanupExistingBookmarks(root);
      return false;
    }

    let endMarker = null;
    if (!bookmarks.isCollapsed) {
      endMarker = root.querySelector(`#${bookmarks.endId}`);
      if (!endMarker) {
        cleanupExistingBookmarks(root);
        return false;
      }
    }

    const range = document.createRange();
    const selection = window.getSelection();
    if (!selection) {
      cleanupExistingBookmarks(root);
      return false;
    }

    if (bookmarks.isCollapsed) {
      const parent = startMarker.parentNode;
      if (!parent) {
        cleanupExistingBookmarks(root);
        return false;
      }
      const startIndex = Array.from(parent.childNodes).indexOf(startMarker);
      range.setStart(parent, startIndex);
      range.setEnd(parent, startIndex);
    } else {
      const startParent = startMarker.parentNode;
      const endParent = endMarker.parentNode;

      if (!startParent || !endParent) {
        cleanupExistingBookmarks(root);
        return false;
      }

      const startIndex = Array.from(startParent.childNodes).indexOf(startMarker);
      const endIndex = Array.from(endParent.childNodes).indexOf(endMarker);

      range.setStart(startParent, startIndex);
      range.setEnd(endParent, endIndex);
    }

    selection.removeAllRanges();
    selection.addRange(range);

    startMarker.remove();
    if (endMarker) {
      endMarker.remove();
    }

    return true;
  } catch (error) {
    console.warn('Failed to restore selection from bookmarks:', error);
    cleanupExistingBookmarks(root);
    return false;
  }
}

/**
 * Clear all bookmarks from the root element
 * @param {HTMLElement} root
 */
export function clearBookmarks(root) {
  cleanupExistingBookmarks(root);
}
