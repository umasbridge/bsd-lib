import { useState, useRef, useEffect } from 'react';
import { Search, Plus, BookOpen } from 'lucide-react';
import { useEditorContext } from '../EditorContext';

/**
 * Hyperlink creation menu - shown when user clicks the link button
 * Three tabs: Create New, Add to Existing, Conventions Library
 * Mode buttons: New Tab, URL
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
  const linkablePages = availablePages.filter(p => p.id !== pageId);
  const hasConventions = conventionsPages && conventionsPages.length > 0;

  const [tab, setTab] = useState('create'); // 'create' | 'existing' | 'conventions'
  const [newPageName, setNewPageName] = useState(selectedText || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPageId, setSelectedPageId] = useState(
    linkablePages.length > 0 ? linkablePages[0].id : null
  );
  const [selectedMode, setSelectedMode] = useState(fixedMode || 'popup');
  const [selectedConvention, setSelectedConvention] = useState(null);
  const [urlValue, setUrlValue] = useState('');
  const [conventionSearch, setConventionSearch] = useState('');
  const [adjustedPosition, setAdjustedPosition] = useState({ x: position.x, y: position.y });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const menuRef = useRef(null);
  const nameInputRef = useRef(null);
  const searchInputRef = useRef(null);
  const urlInputRef = useRef(null);

  const isUrlMode = selectedMode === 'url';

  const filteredPages = linkablePages.filter(page =>
    page.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
  }, [position, tab]);

  useEffect(() => {
    if (tab === 'create' && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [tab]);

  useEffect(() => {
    if (isUrlMode && urlInputRef.current) {
      urlInputRef.current.focus();
    }
  }, [isUrlMode]);

  // Drag support
  const handleDragStart = (e) => {
    if (e.target.closest('input, button, [class*="overflow-y-auto"]')) return;
    e.preventDefault();
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - adjustedPosition.x,
      y: e.clientY - adjustedPosition.y,
    });
  };

  useEffect(() => {
    if (!isDragging) return;
    const handleMouseMove = (e) => {
      setAdjustedPosition({
        x: Math.max(0, Math.min(window.innerWidth - 420, e.clientX - dragOffset.x)),
        y: Math.max(0, Math.min(window.innerHeight - 100, e.clientY - dragOffset.y)),
      });
    };
    const handleMouseUp = () => setIsDragging(false);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  const handleApply = () => {
    if (isUrlMode) {
      const url = urlValue.trim();
      if (!url) return;
      onApply({ url, mode: 'url' });
      return;
    }

    if (tab === 'create') {
      if (!newPageName.trim()) return;
      onApply({
        pageName: newPageName.trim(),
        mode: selectedMode,
        isNewPage: true,
        sourceElements: selectedConvention?.sourceElements || undefined,
        renderedPage: selectedConvention?.renderedPage || undefined,
      });
      return;
    }

    // existing tab
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
    newtab: 'New Tab',
    url: 'URL',
  };

  const tabBtnClass = (active) => `px-3 py-1.5 rounded text-xs cursor-pointer ${
    active
      ? 'bg-blue-600 text-white border border-blue-600'
      : 'bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200'
  }`;

  return (
    <div
      ref={menuRef}
      data-hyperlink-menu=""
      className="fixed bg-white border border-gray-200 rounded-lg shadow-xl py-5 px-5"
      style={{
        zIndex: 300,
        left: adjustedPosition.x,
        top: adjustedPosition.y,
        width: 420,
        cursor: isDragging ? 'grabbing' : undefined,
      }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => { e.stopPropagation(); handleDragStart(e); }}
      onMouseUp={(e) => { if (!isDragging) e.stopPropagation(); }}
    >
      {/* Tab buttons */}
      <div className="flex items-center gap-2 mb-4">
        <button className={tabBtnClass(tab === 'create' && !isUrlMode)} onClick={() => { setTab('create'); if (isUrlMode) setSelectedMode(fixedMode || 'popup'); }}>
          <Plus className="h-3 w-3 inline mr-1" />Create New
        </button>
        {linkablePages.length > 0 && (
          <button className={tabBtnClass(tab === 'existing' && !isUrlMode)} onClick={() => { setTab('existing'); if (isUrlMode) setSelectedMode(fixedMode || 'popup'); }}>
            Add to Existing
          </button>
        )}
        {hasConventions && (
          <button className={tabBtnClass(tab === 'conventions' && !isUrlMode)} onClick={() => { setTab('conventions'); if (isUrlMode) setSelectedMode(fixedMode || 'popup'); }}>
            <BookOpen className="h-3 w-3 inline mr-1" />Conventions
          </button>
        )}
      </div>

      {isUrlMode ? (
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
      ) : tab === 'create' ? (
        <>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-[13px] font-medium text-gray-500 shrink-0">Name</span>
            <input
              ref={nameInputRef}
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
          <div className="text-[11px] text-gray-400 mb-4">
            Selected text: "{selectedText}"
          </div>
        </>
      ) : tab === 'existing' ? (
        <>
          <div className="mb-3">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search pages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-7 pl-7 pr-2 text-[13px] border border-gray-300 rounded-md focus:outline-none focus:border-blue-400"
              />
            </div>
          </div>
          <div className="border border-gray-200 rounded-md max-h-[200px] overflow-y-auto mb-4">
            {filteredPages.length === 0 ? (
              <div className="py-3 text-[13px] text-gray-400 text-center">
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
                  onClick={() => setSelectedPageId(page.id)}
                >
                  {page.name}
                </button>
              ))
            )}
          </div>
        </>
      ) : (
        /* conventions tab */
        <>
          <div className="mb-3">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Search conventions..."
                value={conventionSearch}
                onChange={(e) => setConventionSearch(e.target.value)}
                className="w-full h-7 pl-7 pr-2 text-[13px] border border-gray-300 rounded-md focus:outline-none focus:border-blue-400"
              />
            </div>
          </div>
          <div className="border border-gray-200 rounded-md max-h-[200px] overflow-y-auto mb-4">
            {conventionsPages
              .filter(cp => cp.name.toLowerCase().includes(conventionSearch.toLowerCase()))
              .map((cp, i) => (
              <button
                key={i}
                className={`w-full px-3 py-2 text-left text-[13px] border-b border-gray-100 last:border-b-0 ${
                  selectedConvention?.name === cp.name
                    ? 'bg-green-50 text-green-700'
                    : 'hover:bg-gray-50'
                }`}
                onClick={() => {
                  setSelectedConvention(cp);
                  setNewPageName(selectedText || cp.name);
                  setTab('create');
                }}
              >
                {cp.name}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Mode buttons — New Tab / URL */}
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
              onClick={() => setSelectedMode(prev => prev === m ? (fixedMode || 'popup') : m)}
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
          disabled={isUrlMode ? !urlValue.trim() : (tab === 'create' ? !newPageName.trim() : !selectedPageId)}
        >
          {isUrlMode ? 'Apply' : tab === 'create' ? 'Create' : 'Apply'}
        </button>
      </div>
    </div>
  );
}
