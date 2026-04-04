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
  conventionsPages: null,
  // Discussion integration
  onCreateDiscussion: null,
  onAddToDiscussion: null,
  onDiscussionHighlightClick: null,
  documentDiscussions: null, // null (not []) so components without EditorProvider don't trigger stale cleanup
  onAfterDiscussionApply: null,
  unreadDiscussionIds: null, // ref object: { current: Set<string> }
});

export const EditorProvider = EditorContext.Provider;

export function useEditorContext() {
  return useContext(EditorContext);
}
