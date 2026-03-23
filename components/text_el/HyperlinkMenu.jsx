import { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Plus, BookOpen } from 'lucide-react';
import { useEditorContext } from '../EditorContext';

/**
 * Hyperlink creation menu - shown when user clicks the link button
 * Allows selecting a target page, creating a new page, and choosing link mode:
 *   - popup: opens target page in a popup overlay
 *   - split: opens target page in a split pane
 *   - newtab: opens target page in a new browser tab
 *   - url: links to an external URL (opens in new tab)
 */
export function HyperlinkMenu({
  pageId,
  selectedText,
  position,
  onApply,
  onClose,
  fixedMode,
}) {
  const { availablePages, conventionsPages } = useEditorContext();
  // Filter out the current page (can't link to yourself)
  const linkablePages = availablePages.filter(p => p.id !== pageId);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [selectedPageId, setSelectedPageId] = useState(
    linkablePages.length > 0 ? linkablePages[0].id : null
  );
  const [selectedMode, setSelectedMode] = useState(fixedMode || 'popup');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [adjustedPosition, setAdjustedPosition] = useState({ x: position.x, y: position.y });
  const [creatingNewPage, setCreatingNewPage] = useState(false);
  const [newPageName, setNewPageName] = useState(selectedText || '');
  const [urlValue, setUrlValue] = useState('');
  const [showConventions, setShowConventions] = useState(false);
  const [selectedConvention, setSelectedConvention] = useState(null); // { name, elements }
  const menuRef = useRef(null);
  const searchInputRef = useRef(null);
  const newPageInputRef = useRef(null);
  const urlInputRef = useRef(null);

  const filteredPages = linkablePages.filter(page =>
    page.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedPage = linkablePages.find(p => p.id === selectedPageId);

  const isUrlMode = selectedMode === 'url';

  // Position menu to the right of the page container
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
    if (creatingNewPage && newPageInputRef.current) {
      newPageInputRef.current.focus();
    }
  }, [creatingNewPage]);

  useEffect(() => {
    if (isUrlMode && urlInputRef.current) {
      urlInputRef.current.focus();
    }
  }, [isUrlMode]);

  const handleApply = () => {
    // URL mode: external link
    if (isUrlMode) {
      const url = urlValue.trim();
      if (!url) return;
      onApply({ url, mode: 'url' });
      return;
    }

    // Create new page mode (blank or from conventions)
    if (creatingNewPage) {
      if (!newPageName.trim()) return;
      onApply({
        pageName: newPageName.trim(),
        mode: selectedMode,
        isNewPage: true,
        sourceElements: selectedConvention?.elements || undefined,
      });
      return;
    }

    // Existing page link
    if (!selectedPageId) return;
    const page = linkablePages.find(p => p.id === selectedPageId);
    if (!page) return;

    onApply({
      pageId: selectedPageId,
      pageName: page.name,
      mode: selectedMode,
    });
  };

  const MODE_LABELS = {
    popup: 'Popup',
    split: 'Split',
    newtab: 'New Tab',
    url: 'URL',
  };

  return (
    <div
      ref={menuRef}
      data-hyperlink-menu=""
      className="fixed bg-white border border-gray-200 rounded-lg shadow-xl py-5 px-5"
      style={{
        zIndex: 300,
        left: adjustedPosition.x,
        top: adjustedPosition.y,
        width: 340,
      }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
    >
      {isUrlMode ? (
        /* URL input */
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[13px] font-medium text-gray-500 shrink-0">URL</span>
            <input
              ref={urlInputRef}
              type="text"
              placeholder="https://..."
              value={urlValue}
              onChange={(e) => setUrlValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleApply(); }}
              className="flex-1 h-8 px-2.5 text-[13px] border border-gray-300 rounded-md focus:outline-none focus:border-blue-400"
            />
          </div>
          <div className="text-[11px] text-gray-400">Selected text will become the link label</div>
        </div>
      ) : creatingNewPage ? (
        <>
          {/* New page name input */}
          <div className="flex items-center gap-2 mb-4">
            <span className="text-[13px] font-medium text-gray-500 shrink-0">New page</span>
            <input
              ref={newPageInputRef}
              type="text"
              placeholder="Page name..."
              value={newPageName}
              onChange={(e) => setNewPageName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleApply(); }}
              className="flex-1 h-8 px-2.5 text-[13px] border border-gray-300 rounded-md focus:outline-none focus:border-blue-400"
            />
          </div>
          {selectedConvention && (
            <div className="text-[11px] text-green-600 mb-2">
              From convention: {selectedConvention.name}
            </div>
          )}
          <button
            className="text-[12px] text-blue-600 hover:text-blue-800 mb-4 cursor-pointer"
            onClick={() => { setCreatingNewPage(false); setSelectedConvention(null); }}
          >
            ← Link to existing page
          </button>
        </>
      ) : (
        <>
          {/* Link to + dropdown + search icon */}
          <div className="flex items-center gap-2 mb-4">
            <span className="text-[13px] font-medium text-gray-500 shrink-0">Link to</span>
            <button
              className="flex-1 flex items-center justify-between border border-gray-300 rounded-md px-2.5 py-1.5 text-[13px] bg-gray-50 hover:bg-gray-100 cursor-pointer min-w-0"
              onClick={() => setDropdownOpen(!dropdownOpen)}
            >
              <span className={`truncate ${selectedPage ? 'text-gray-900' : 'text-gray-400'}`}>
                {selectedPage ? selectedPage.name : 'Select page...'}
              </span>
              <ChevronDown className={`h-3.5 w-3.5 text-gray-500 shrink-0 ml-1 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            <button
              className={`shrink-0 w-[30px] h-[30px] flex items-center justify-center border rounded-md cursor-pointer ${
                showSearch ? 'border-blue-400 bg-blue-50' : 'border-gray-300 bg-gray-50 hover:bg-gray-100'
              }`}
              onClick={() => {
                setShowSearch(!showSearch);
                if (showSearch) setSearchQuery('');
              }}
              title="Search pages"
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
                placeholder="Search pages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-7 px-2 text-[13px] border border-gray-300 rounded-md focus:outline-none focus:border-blue-400"
              />
            </div>
          )}

          {/* Page list dropdown */}
          {dropdownOpen && (
            <div className="border border-gray-200 rounded-md max-h-[160px] overflow-y-auto mb-4">
              {filteredPages.length === 0 ? (
                <div className="py-2 text-[13px] text-gray-400 text-center">
                  {linkablePages.length === 0 ? 'No pages available' : 'No matching pages'}
                </div>
              ) : (
                filteredPages.map(page => (
                  <button
                    key={page.id}
                    className={`w-full px-3 py-2 text-left text-[13px] border-b border-gray-100 last:border-b-0 ${
                      selectedPageId === page.id
                        ? 'bg-blue-50 text-blue-600'
                        : 'hover:bg-gray-50'
                    }`}
                    onClick={() => {
                      setSelectedPageId(page.id);
                      setDropdownOpen(false);
                    }}
                  >
                    {page.name}
                  </button>
                ))
              )}
            </div>
          )}

          {/* Create new page link */}
          <div className="flex items-center gap-3 mb-4">
            <button
              className="flex items-center gap-1 text-[12px] text-blue-600 hover:text-blue-800 cursor-pointer"
              onClick={() => { setCreatingNewPage(true); setSelectedConvention(null); setShowConventions(false); }}
            >
              <Plus className="h-3 w-3" /> Create new page
            </button>
            {conventionsPages && conventionsPages.length > 0 && (
              <button
                className="flex items-center gap-1 text-[12px] text-green-600 hover:text-green-800 cursor-pointer"
                onClick={() => setShowConventions(!showConventions)}
              >
                <BookOpen className="h-3 w-3" /> Conventions
              </button>
            )}
          </div>

          {/* Conventions page picker */}
          {showConventions && conventionsPages && (
            <div className="border border-gray-200 rounded-md max-h-[160px] overflow-y-auto mb-4">
              {conventionsPages.map((cp, i) => (
                <button
                  key={i}
                  className={`w-full px-3 py-2 text-left text-[13px] border-b border-gray-100 last:border-b-0 ${
                    selectedConvention?.name === cp.name
                      ? 'bg-green-50 text-green-700'
                      : 'hover:bg-gray-50'
                  }`}
                  onClick={() => {
                    setSelectedConvention(cp);
                    setCreatingNewPage(true);
                    setShowConventions(false);
                    setNewPageName(selectedText || cp.name);
                  }}
                >
                  {cp.name}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* Mode selection — hidden for TOC bid column (fixedMode), simplified for others */}
      {!fixedMode && (
        <div className="flex items-center gap-2 mb-7 flex-wrap">
          {['newtab', 'url'].map((m) => (
            <button
              key={m}
              className={`px-3 py-1.5 rounded text-xs cursor-pointer ${
                selectedMode === m
                  ? 'bg-blue-600 text-white border border-blue-600'
                  : 'bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200'
              }`}
              onClick={() => setSelectedMode(prev => prev === m ? 'popup' : m)}
            >
              {MODE_LABELS[m]}
            </button>
          ))}
        </div>
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
          disabled={isUrlMode ? !urlValue.trim() : (creatingNewPage ? !newPageName.trim() : !selectedPageId)}
        >
          Apply
        </button>
      </div>
    </div>
  );
}
