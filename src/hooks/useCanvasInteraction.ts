/**
 * React hook governing direct mouse and pointer interaction on the HTML5 canvas overlay.
 * Encapsulates a 4-state finite state machine (idle, drawing, moving, resizing),
 * Euclidean micro-drag filtering, 8-point handle hit-testing, and window listener lifecycles.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { RedactionBox, NormalizedBBoxTuple, ResizeHandle, RedactionType } from '../types';
import {
  screenToNormalized,
  normalizeRect,
  getHandleAtPoint,
  isPointInBox,
  clamp
} from '../utils/coordinates';

export type InteractionMode = 'idle' | 'drawing' | 'moving' | 'resizing';

export interface UseCanvasInteractionOptions {
  /** Target canvas DOM reference */
  canvasRef: React.RefObject<HTMLCanvasElement>;
  /** Active redaction bounding boxes visible at current time */
  activeRedactions: RedactionBox[];
  /** Currently selected redaction ID or null */
  selectedId: string | null;
  /** Current playback time in milliseconds */
  currentTimeMs: number;
  /** Total video duration in milliseconds */
  videoDurationMs: number;
  /** Default lifespan in milliseconds for newly drawn boxes (default: 3000ms) */
  defaultSpanMs?: number;
  /** Default redaction filter category (default: 'blur') */
  defaultType?: RedactionType;
  /** Callback fired when a new redaction box is drawn and committed */
  onAddRedaction: (box: Omit<RedactionBox, 'id'>) => string;
  /** Callback fired when an existing box is moved or resized */
  onUpdateRedaction: (id: string, updates: Partial<Omit<RedactionBox, 'id'>>) => void;
  /** Callback fired when user selects or deselects a box */
  onSelectRedaction: (id: string | null) => void;
}

export interface UseCanvasInteractionReturn {
  /** Current interaction mode */
  mode: InteractionMode;
  /** Real-time bounding box preview during drawing, moving, or resizing */
  currentDragRect: NormalizedBBoxTuple | null;
  /** Currently active resize handle during resize gesture */
  activeHandle: ResizeHandle | null;
  /** Handle currently under mouse pointer */
  hoveredHandle: ResizeHandle | null;
  /** CSS cursor string to apply to the canvas overlay */
  cursorStyle: string;
  /** Event handler to bind to canvas onPointerDown */
  handlePointerDown: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  /** Event handler to bind to canvas onPointerMove (for hover cursor updates) */
  handleCanvasPointerMove: (e: React.PointerEvent<HTMLCanvasElement>) => void;
}

/**
 * Maps resize handle identifier to appropriate CSS cursor style.
 *
 * @param handle - Target handle direction or null.
 * @returns Standard CSS cursor string.
 */
export function getCursorForHandle(handle: ResizeHandle | null): string {
  switch (handle) {
    case 'nw':
    case 'se':
      return 'nwse-resize';
    case 'ne':
    case 'sw':
      return 'nesw-resize';
    case 'n':
    case 's':
      return 'ns-resize';
    case 'e':
    case 'w':
      return 'ew-resize';
    case 'move':
      return 'move';
    default:
      return 'crosshair';
  }
}

/**
 * Custom hook implementing pointer drag state machines for canvas bounding box operations.
 *
 * @param options - Configuration and callback parameters.
 * @returns Interaction states, active preview rect, and DOM event bindings.
 */
export function useCanvasInteraction(
  options: UseCanvasInteractionOptions
): UseCanvasInteractionReturn {
  const {
    canvasRef,
    activeRedactions,
    selectedId,
    currentTimeMs,
    videoDurationMs,
    defaultSpanMs = 3000,
    defaultType = 'blur',
    onAddRedaction,
    onUpdateRedaction,
    onSelectRedaction
  } = options;

  const [mode, setMode] = useState<InteractionMode>('idle');
  const [currentDragRect, setCurrentDragRect] = useState<NormalizedBBoxTuple | null>(null);
  const [activeHandle, setActiveHandle] = useState<ResizeHandle | null>(null);
  const [hoveredHandle, setHoveredHandle] = useState<ResizeHandle | null>(null);
  const [cursorStyle, setCursorStyle] = useState<string>('crosshair');

  // Drag session tracking refs (avoid stale closures in window listeners)
  const dragStartRef = useRef<{
    clientX: number;
    clientY: number;
    normX: number;
    normY: number;
  } | null>(null);

  const initialBboxRef = useRef<NormalizedBBoxTuple | null>(null);
  const targetIdRef = useRef<string | null>(null);
  const isDraggingRef = useRef(false);

  // Keep options synced in ref for stable window listener access
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  // Calculate new bounding box coordinates when resizing via a specific handle
  const calculateResizedBbox = useCallback(
    (
      handle: ResizeHandle,
      initialBbox: NormalizedBBoxTuple,
      currentNormX: number,
      currentNormY: number
    ): NormalizedBBoxTuple => {
      const [initX, initY, initW, initH] = initialBbox;
      const right = initX + initW;
      const bottom = initY + initH;

      let x1 = initX;
      let y1 = initY;
      let x2 = right;
      let y2 = bottom;

      switch (handle) {
        case 'nw':
          x1 = currentNormX;
          y1 = currentNormY;
          break;
        case 'n':
          y1 = currentNormY;
          break;
        case 'ne':
          x2 = currentNormX;
          y1 = currentNormY;
          break;
        case 'e':
          x2 = currentNormX;
          break;
        case 'se':
          x2 = currentNormX;
          y2 = currentNormY;
          break;
        case 's':
          y2 = currentNormY;
          break;
        case 'sw':
          x1 = currentNormX;
          y2 = currentNormY;
          break;
        case 'w':
          x1 = currentNormX;
          break;
      }

      return normalizeRect(x1, y1, x2, y2);
    },
    []
  );

  // Update hover cursor when pointer moves over canvas in idle mode
  const handleCanvasPointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (mode !== 'idle') return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const canvasRect = canvas.getBoundingClientRect();
      const selectedBox = activeRedactions.find(r => r.id === selectedId);

      // 1. Check if hovering over resize handles of selected box
      if (selectedBox) {
        const handle = getHandleAtPoint(e.clientX, e.clientY, selectedBox.bbox, canvasRect, 10);
        if (handle) {
          setHoveredHandle(handle);
          setCursorStyle(getCursorForHandle(handle));
          return;
        }
      }

      setHoveredHandle(null);

      // 2. Check if hovering inside any active bounding box (topmost first)
      for (let i = activeRedactions.length - 1; i >= 0; i--) {
        const box = activeRedactions[i];
        if (box && isPointInBox(e.clientX, e.clientY, box.bbox, canvasRect)) {
          setCursorStyle('move');
          return;
        }
      }

      // 3. Hovering over empty canvas
      setCursorStyle('crosshair');
    },
    [mode, canvasRef, activeRedactions, selectedId]
  );

  // Pointer down interaction dispatcher
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const canvasRect = canvas.getBoundingClientRect();
      const normPoint = screenToNormalized(e.clientX, e.clientY, canvasRect);

      dragStartRef.current = {
        clientX: e.clientX,
        clientY: e.clientY,
        normX: normPoint.normX,
        normY: normPoint.normY
      };
      isDraggingRef.current = false;

      const selectedBox = activeRedactions.find(r => r.id === selectedId);

      // Case 1: Clicked on a handle of the currently selected box
      if (selectedBox) {
        const handle = getHandleAtPoint(e.clientX, e.clientY, selectedBox.bbox, canvasRect, 10);
        if (handle && handle !== 'move') {
          setActiveHandle(handle);
          setMode('resizing');
          initialBboxRef.current = [...selectedBox.bbox];
          targetIdRef.current = selectedBox.id;
          setCurrentDragRect(selectedBox.bbox);
          setCursorStyle(getCursorForHandle(handle));
          return;
        }
      }

      // Case 2: Clicked inside an active bounding box (selection / move)
      for (let i = activeRedactions.length - 1; i >= 0; i--) {
        const box = activeRedactions[i];
        if (box && isPointInBox(e.clientX, e.clientY, box.bbox, canvasRect)) {
          onSelectRedaction(box.id);
          setActiveHandle('move');
          setMode('moving');
          initialBboxRef.current = [...box.bbox];
          targetIdRef.current = box.id;
          setCurrentDragRect(box.bbox);
          setCursorStyle('move');
          return;
        }
      }

      // Case 3: Clicked empty canvas (prepare drawing mode)
      onSelectRedaction(null);
      setActiveHandle(null);
      setMode('idle'); // Stays idle until micro-drag threshold is crossed
      initialBboxRef.current = null;
      targetIdRef.current = null;
      setCurrentDragRect(null);
      setCursorStyle('crosshair');
    },
    [canvasRef, activeRedactions, selectedId, onSelectRedaction]
  );

  // Window pointermove and pointerup listener management
  useEffect(() => {
    const handleWindowPointerMove = (e: PointerEvent) => {
      const dragStart = dragStartRef.current;
      const canvas = canvasRef.current;
      if (!dragStart || !canvas) return;

      const canvasRect = canvas.getBoundingClientRect();
      const normCurrent = screenToNormalized(e.clientX, e.clientY, canvasRect);

      // Calculate screen pixel Euclidean distance
      const deltaScreenX = e.clientX - dragStart.clientX;
      const deltaScreenY = e.clientY - dragStart.clientY;
      const euclideanDist = Math.sqrt(deltaScreenX * deltaScreenX + deltaScreenY * deltaScreenY);

      // If in idle state, check micro-drag threshold (> 5px) to activate drawing
      if (mode === 'idle') {
        if (euclideanDist > 5) {
          isDraggingRef.current = true;
          setMode('drawing');
          const rect = normalizeRect(dragStart.normX, dragStart.normY, normCurrent.normX, normCurrent.normY);
          setCurrentDragRect(rect);
        }
        return;
      }

      if (mode === 'drawing') {
        isDraggingRef.current = true;
        const rect = normalizeRect(dragStart.normX, dragStart.normY, normCurrent.normX, normCurrent.normY);
        setCurrentDragRect(rect);
      } else if (mode === 'moving') {
        isDraggingRef.current = true;
        const initialBbox = initialBboxRef.current;
        if (!initialBbox) return;

        const deltaNormX = (e.clientX - dragStart.clientX) / Math.max(1, canvasRect.width);
        const deltaNormY = (e.clientY - dragStart.clientY) / Math.max(1, canvasRect.height);

        const newX = clamp(initialBbox[0] + deltaNormX, 0, 1 - initialBbox[2]);
        const newY = clamp(initialBbox[1] + deltaNormY, 0, 1 - initialBbox[3]);
        const movedRect: NormalizedBBoxTuple = [newX, newY, initialBbox[2], initialBbox[3]];

        setCurrentDragRect(movedRect);
      } else if (mode === 'resizing') {
        isDraggingRef.current = true;
        const initialBbox = initialBboxRef.current;
        if (!initialBbox || !activeHandle) return;

        const resizedRect = calculateResizedBbox(
          activeHandle,
          initialBbox,
          normCurrent.normX,
          normCurrent.normY
        );
        setCurrentDragRect(resizedRect);
      }
    };

    const handleWindowPointerUp = () => {
      const currentMode = mode;
      const currentRect = currentDragRect;
      const targetId = targetIdRef.current;
      const isDragging = isDraggingRef.current;

      if (currentMode === 'drawing' && currentRect && isDragging) {
        // Discard zero-area micro boxes (< 0.5% of dimension)
        if (currentRect[2] > 0.005 && currentRect[3] > 0.005) {
          const startMs = currentTimeMs;
          const endMs = videoDurationMs > 0
            ? Math.min(currentTimeMs + defaultSpanMs, videoDurationMs)
            : currentTimeMs + defaultSpanMs;

          onAddRedaction({
            label: 'Redaction',
            type: defaultType,
            startMs,
            endMs,
            bbox: currentRect
          });
        }
      } else if (currentMode === 'moving' && currentRect && targetId && isDragging) {
        onUpdateRedaction(targetId, { bbox: currentRect });
      } else if (currentMode === 'resizing' && currentRect && targetId && isDragging) {
        onUpdateRedaction(targetId, { bbox: currentRect });
      }

      // Reset interaction state to idle
      setMode('idle');
      setCurrentDragRect(null);
      setActiveHandle(null);
      dragStartRef.current = null;
      initialBboxRef.current = null;
      targetIdRef.current = null;
      isDraggingRef.current = false;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Cancel active drag gesture or deselect
        setMode('idle');
        setCurrentDragRect(null);
        setActiveHandle(null);
        dragStartRef.current = null;
        initialBboxRef.current = null;
        targetIdRef.current = null;
        isDraggingRef.current = false;
        optionsRef.current.onSelectRedaction(null);
      }
    };

    window.addEventListener('pointermove', handleWindowPointerMove);
    window.addEventListener('pointerup', handleWindowPointerUp);
    window.addEventListener('pointercancel', handleWindowPointerUp);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('pointermove', handleWindowPointerMove);
      window.removeEventListener('pointerup', handleWindowPointerUp);
      window.removeEventListener('pointercancel', handleWindowPointerUp);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    mode,
    currentDragRect,
    activeHandle,
    canvasRef,
    currentTimeMs,
    videoDurationMs,
    defaultSpanMs,
    defaultType,
    calculateResizedBbox,
    onAddRedaction,
    onUpdateRedaction
  ]);

  return {
    mode,
    currentDragRect,
    activeHandle,
    hoveredHandle,
    cursorStyle,
    handlePointerDown,
    handleCanvasPointerMove
  };
}
