import { useState, useRef, useEffect } from 'react';
import { Search, Plus } from 'lucide-react';
import { useEditorContext } from '../EditorContext';

/**
 * Discussion menu — shown when user clicks the discussion icon in TextFormatPanel.
 * Two modes:
 *   - Create New: enter a name, calls onCreateDiscussion
 *   - Add to Existing: pick from documentDiscussions, calls onAddToDiscussion
 *
 * Same positioning pattern as HyperlinkMenu.
 */
export function DiscussionMenu({
  pageId,
  selectedText,
  position,
  onApply,
  onClose,
}) {
  const { documentDiscussions } = useEditorContext();
  const [mode, setMode] = useState('create'); // 'create' | 'existing'
  const [name, setName] = useState(selectedText || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDiscussionId, setSelectedDiscussionId] = useState(null);
  const [adjustedPosition, setAdjustedPosition] = useState({ x: position.x, y: position.y });
  const menuRef = useRef(null);
  const nameInputRef = useRef(null);
  const searchInputRef = useRef(null);

  const discussions = documentDiscussions || [];
  const filtered = discussions.filter(d =>
    d.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Position menu to the right of the page container (same as HyperlinkMenu)
  useEffect(() => {
    if (menuRef.current) {
      const menuRect = menuRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      const pageEl = menuRef.current.closest('[class*="relative"]')?.closest('[style*="max-width"]')
        || document.querySelector('[class*="bg-white"][class*="shadow"]');

      let newX;
      let newY = position.y - 40;

      if (pageEl) {
        const pageRect = pageEl.getBoundingClientRect();
        newX = pageRect.right + 16;
        if (newX + menuRect.width > viewportWidth - 10) {
          newX = pageRect.left - menuRect.width - 16;
        }
        if (newX < 10) {
          newX = viewportWidth - menuRect.width - 10;
        }
      } else {
        newX = viewportWidth - menuRect.width - 20;
      }

      if (newY + menuRect.height > viewportHeight - 10) {
        newY = viewportHeight - menuRect.height - 10;
      }
      if (newY < 10) newY = 10;

      setAdjustedPosition({ x: newX, y: newY });
    }
  }, [position]);

  useEffect(() => {
    if (mode === 'create' && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [mode]);

  const handleCreate = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onApply({ action: 'create', name: trimmed, highlightedText: selectedText });
  };

  const handleAddToExisting = () => {
    if (!selectedDiscussionId) return;
    const disc = discussions.find(d => d.id === selectedDiscussionId);
    if (!disc) return;
    onApply({ action: 'add', discussionId: selectedDiscussionId, highlightedText: selectedText });
  };

  return (
    <div
      ref={menuRef}
      data-discussion-menu=""
      className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-xl py-5 px-5"
      style={{
        left: adjustedPosition.x,
        top: adjustedPosition.y,
        width: 320,
      }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
    >
      {/* Tab buttons */}
      <div className="flex items-center gap-2 mb-4">
        <button
          className={`px-3 py-1.5 rounded text-xs cursor-pointer ${
            mode === 'create'
              ? 'bg-blue-600 text-white border border-blue-600'
              : 'bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200'
          }`}
          onClick={() => setMode('create')}
        >
          <Plus className="h-3 w-3 inline mr-1" />
          Create New
        </button>
        {discussions.length > 0 && (
          <button
            className={`px-3 py-1.5 rounded text-xs cursor-pointer ${
              mode === 'existing'
                ? 'bg-blue-600 text-white border border-blue-600'
                : 'bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200'
            }`}
            onClick={() => setMode('existing')}
          >
            Add to Existing
          </button>
        )}
      </div>

      {mode === 'create' ? (
        <>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-[13px] font-medium text-gray-500 shrink-0">Name</span>
            <input
              ref={nameInputRef}
              type="text"
              placeholder="Discussion name..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
              className="flex-1 h-8 px-2.5 text-[13px] border border-gray-300 rounded-md focus:outline-none focus:border-blue-400"
            />
          </div>
          <div className="text-[11px] text-gray-400 mb-4">
            Selected text: "{selectedText}"
          </div>
        </>
      ) : (
        <>
          {/* Search */}
          <div className="mb-3">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search discussions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-7 pl-7 pr-2 text-[13px] border border-gray-300 rounded-md focus:outline-none focus:border-blue-400"
              />
            </div>
          </div>

          {/* Discussion list */}
          <div className="border border-gray-200 rounded-md max-h-[200px] overflow-y-auto mb-4">
            {filtered.length === 0 ? (
              <div className="py-3 text-[13px] text-gray-400 text-center">
                {discussions.length === 0 ? 'No discussions yet' : 'No matching discussions'}
              </div>
            ) : (
              filtered.map(d => (
                <button
                  key={d.id}
                  className={`w-full px-3 py-2 text-left text-[13px] border-b border-gray-100 last:border-b-0 ${
                    selectedDiscussionId === d.id
                      ? 'bg-blue-50 text-blue-600'
                      : 'hover:bg-gray-50'
                  }`}
                  onClick={() => setSelectedDiscussionId(d.id)}
                >
                  {d.name}
                  {d.highlighted_text && (
                    <span className="text-[11px] text-gray-400 block truncate">"{d.highlighted_text}"</span>
                  )}
                </button>
              ))
            )}
          </div>
        </>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <button
          className="px-3 py-1.5 text-[13px] border border-gray-300 rounded-md hover:bg-gray-50"
          onClick={onClose}
        >
          Cancel
        </button>
        <button
          className="px-3 py-1.5 text-[13px] bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={mode === 'create' ? handleCreate : handleAddToExisting}
          disabled={mode === 'create' ? !name.trim() : !selectedDiscussionId}
        >
          {mode === 'create' ? 'Create' : 'Add'}
        </button>
      </div>
    </div>
  );
}
