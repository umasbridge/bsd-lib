import { useState, useRef, useEffect } from 'react';
import { Search, Plus } from 'lucide-react';
import { useEditorContext } from '../EditorContext';

/**
 * Discussion menu - shown when user clicks the discussion button in TextFormatPanel.
 * Allows selecting an existing discussion or creating a new one.
 * Pattern follows HyperlinkMenu.jsx.
 */
export function DiscussionMenu({
  selectedText,
  position,
  onApply,
  onClose,
}) {
  const { documentDiscussions } = useEditorContext();
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [selectedDiscussionId, setSelectedDiscussionId] = useState(
    documentDiscussions.length > 0 ? documentDiscussions[0].id : null
  );
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [adjustedPosition, setAdjustedPosition] = useState({ x: position.x, y: position.y });
  const [creatingNew, setCreatingNew] = useState(documentDiscussions.length === 0);
  const [newName, setNewName] = useState(selectedText || '');
  const menuRef = useRef(null);
  const searchInputRef = useRef(null);
  const newNameInputRef = useRef(null);

  const filteredDiscussions = documentDiscussions.filter(d =>
    d.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedDiscussion = documentDiscussions.find(d => d.id === selectedDiscussionId);

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
    if (showSearch && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [showSearch]);

  useEffect(() => {
    if (creatingNew && newNameInputRef.current) {
      newNameInputRef.current.focus();
    }
  }, [creatingNew]);

  const handleApply = () => {
    if (creatingNew) {
      if (!newName.trim()) return;
      onApply({ isNew: true, discussionName: newName.trim() });
      return;
    }

    if (!selectedDiscussionId) return;
    onApply({ discussionId: selectedDiscussionId });
  };

  return (
    <div
      ref={menuRef}
      data-discussion-menu=""
      className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-xl py-5 px-5"
      style={{
        left: adjustedPosition.x,
        top: adjustedPosition.y,
        width: 340,
      }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
    >
      {creatingNew ? (
        <>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-[13px] font-medium text-gray-500 shrink-0">New discussion</span>
            <input
              ref={newNameInputRef}
              type="text"
              placeholder="Discussion name..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleApply(); }}
              className="flex-1 h-8 px-2.5 text-[13px] border border-gray-300 rounded-md focus:outline-none focus:border-blue-400"
            />
          </div>
          {documentDiscussions.length > 0 && (
            <button
              className="text-[12px] text-blue-600 hover:text-blue-800 mb-4 cursor-pointer"
              onClick={() => setCreatingNew(false)}
            >
              ← Add to existing discussion
            </button>
          )}
        </>
      ) : (
        <>
          {/* Select existing discussion */}
          <div className="flex items-center gap-2 mb-4">
            <span className="text-[13px] font-medium text-gray-500 shrink-0">Discussion</span>
            <button
              className="flex-1 flex items-center justify-between border border-gray-300 rounded-md px-2.5 py-1.5 text-[13px] bg-gray-50 hover:bg-gray-100 cursor-pointer min-w-0"
              onClick={() => setDropdownOpen(!dropdownOpen)}
            >
              <span className={`truncate ${selectedDiscussion ? 'text-gray-900' : 'text-gray-400'}`}>
                {selectedDiscussion ? selectedDiscussion.name : 'Select discussion...'}
              </span>
              <svg className={`h-3.5 w-3.5 text-gray-500 shrink-0 ml-1 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            <button
              className={`shrink-0 w-[30px] h-[30px] flex items-center justify-center border rounded-md cursor-pointer ${
                showSearch ? 'border-blue-400 bg-blue-50' : 'border-gray-300 bg-gray-50 hover:bg-gray-100'
              }`}
              onClick={() => {
                setShowSearch(!showSearch);
                if (showSearch) setSearchQuery('');
              }}
              title="Search discussions"
            >
              <Search className="h-3.5 w-3.5 text-gray-500" />
            </button>
          </div>

          {/* Search bar */}
          {showSearch && (
            <div className="mb-3">
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search discussions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-7 px-2 text-[13px] border border-gray-300 rounded-md focus:outline-none focus:border-blue-400"
              />
            </div>
          )}

          {/* Discussion list dropdown */}
          {dropdownOpen && (
            <div className="border border-gray-200 rounded-md max-h-[160px] overflow-y-auto mb-4">
              {filteredDiscussions.length === 0 ? (
                <div className="py-2 text-[13px] text-gray-400 text-center">
                  {documentDiscussions.length === 0 ? 'No discussions yet' : 'No matching discussions'}
                </div>
              ) : (
                filteredDiscussions.map(d => (
                  <button
                    key={d.id}
                    className={`w-full px-3 py-2 text-left text-[13px] border-b border-gray-100 last:border-b-0 ${
                      selectedDiscussionId === d.id
                        ? 'bg-blue-50 text-blue-600'
                        : 'hover:bg-gray-50'
                    }`}
                    onClick={() => {
                      setSelectedDiscussionId(d.id);
                      setDropdownOpen(false);
                    }}
                  >
                    <div className="truncate">{d.name}</div>
                    {d.highlighted_text && (
                      <div className="text-[11px] text-gray-400 truncate mt-0.5">"{d.highlighted_text}"</div>
                    )}
                  </button>
                ))
              )}
            </div>
          )}

          {/* Create new discussion link */}
          <button
            className="flex items-center gap-1 text-[12px] text-blue-600 hover:text-blue-800 mb-4 cursor-pointer"
            onClick={() => setCreatingNew(true)}
          >
            <Plus className="h-3 w-3" /> Create new discussion
          </button>
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
          onClick={handleApply}
          disabled={creatingNew ? !newName.trim() : !selectedDiscussionId}
        >
          Apply
        </button>
      </div>
    </div>
  );
}
