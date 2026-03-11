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
});

export const EditorProvider = EditorContext.Provider;

export function useEditorContext() {
  return useContext(EditorContext);
}
