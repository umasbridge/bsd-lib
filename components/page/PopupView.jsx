import { useState, useRef, useEffect } from 'react';

/**
 * PopupView - Positioned floating container for popup pages.
 * Page component renders its own title/X/content/bottom bar inside.
 * This just provides positioning, drag, and shadow.
 *
 * @param {{ position: { x: number, y: number }, zIndex?: number, children: React.ReactNode }} props
 */
export function PopupView({
  position,
  zIndex = 100,
  children,
}) {
  const popupRef = useRef(null);
  const [pos, setPos] = useState({ x: position.x + 20, y: position.y });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [positioned, setPositioned] = useState(false);

  // After first render, measure actual size and position centered on click point
  useEffect(() => {
    if (!popupRef.current) return;

    requestAnimationFrame(() => {
      if (!popupRef.current) return;
      const rect = popupRef.current.getBoundingClientRect();
      const actualWidth = rect.width;
      const actualHeight = rect.height;

      // Slightly right of click point
      let x = position.x + 20;
      // Vertically centered on click point
      let y = position.y - actualHeight / 2;

      // Boundary adjustments
      if (x + actualWidth > window.innerWidth - 10) {
        x = position.x - actualWidth - 20;
      }
      if (x < 10) x = 10;
      if (y + actualHeight > window.innerHeight - 10) {
        y = window.innerHeight - actualHeight - 10;
      }
      if (y < 10) y = 10;

      setPos({ x, y });
      setPositioned(true);
    });
  }, [position]);

  // Handle drag start (only from data-popup-header)
  const handleMouseDown = (e) => {
    const target = e.target;
    if (!target.closest('[data-popup-header]')) return;
    if (target.closest('button')) return;

    e.preventDefault();
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - pos.x,
      y: e.clientY - pos.y,
    });
  };

  // Handle drag movement
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e) => {
      setPos({
        x: Math.max(0, Math.min(window.innerWidth - 400, e.clientX - dragOffset.x)),
        y: Math.max(0, Math.min(window.innerHeight - 100, e.clientY - dragOffset.y)),
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  // Keep popup in viewport on resize
  useEffect(() => {
    const handleResize = () => {
      setPos(prev => ({
        x: Math.min(prev.x, window.innerWidth - 400),
        y: Math.min(prev.y, window.innerHeight - 100),
      }));
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div
      ref={popupRef}
      style={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        zIndex,
        width: 'fit-content',
        maxWidth: window.innerWidth - 40,
        maxHeight: window.innerHeight - 40,
        opacity: positioned ? 1 : 0,
        overflow: 'hidden',
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        border: '1px solid #e5e7eb',
        display: 'flex',
        flexDirection: 'column',
      }}
      onMouseDown={handleMouseDown}
    >
      {children}
    </div>
  );
}
