import { createContext, useContext } from 'react';

/**
 * System-level editor context — provides page linking capabilities to any TextEl
 * in the tree without prop drilling through Page → BidTable → BidTableRow → TextEl.
 *
 * Provided by SystemEditor, consumed by TextEl/useTiptapEditor.
 */
const EditorContext = createContext({
  availablePages: [],
  onHyperlinkClick: null,
  onCreatePage: null,
  documentDiscussions: null,
  onCreateDiscussion: null,
  onAddToDiscussion: null,
  onDiscussionHighlightClick: null,
  onAfterDiscussionApply: null,
  onAddHighlightRef: null, // (highlight) => void — updates formattingRef._highlights
  conventionsPages: null, // [{ name, elements }] from Conventions doc
});

export const EditorProvider = EditorContext.Provider;

export function useEditorContext() {
  return useContext(EditorContext);
}
