import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCanvasInteraction, getCursorForHandle } from '../../src/hooks/useCanvasInteraction';
import { RedactionBox } from '../../src/types';

describe('useCanvasInteraction hook', () => {
  let mockCanvas: HTMLCanvasElement;
  let mockCanvasRect: DOMRect;

  beforeEach(() => {
    vi.clearAllMocks();

    mockCanvas = document.createElement('canvas');
    mockCanvas.width = 1000;
    mockCanvas.height = 500;

    mockCanvasRect = {
      left: 100,
      top: 50,
      width: 800,
      height: 400,
      right: 900,
      bottom: 450,
      x: 100,
      y: 50,
      toJSON: () => {}
    };

    vi.spyOn(mockCanvas, 'getBoundingClientRect').mockReturnValue(mockCanvasRect);
  });

  it('getCursorForHandle maps handle tokens to standard CSS cursor styles', () => {
    expect(getCursorForHandle('nw')).toBe('nwse-resize');
    expect(getCursorForHandle('se')).toBe('nwse-resize');
    expect(getCursorForHandle('ne')).toBe('nesw-resize');
    expect(getCursorForHandle('sw')).toBe('nesw-resize');
    expect(getCursorForHandle('n')).toBe('ns-resize');
    expect(getCursorForHandle('s')).toBe('ns-resize');
    expect(getCursorForHandle('e')).toBe('ew-resize');
    expect(getCursorForHandle('w')).toBe('ew-resize');
    expect(getCursorForHandle('move')).toBe('move');
    expect(getCursorForHandle(null)).toBe('crosshair');
  });

  it('initializes in idle mode with crosshair cursor', () => {
    const canvasRef = { current: mockCanvas };
    const { result } = renderHook(() =>
      useCanvasInteraction({
        canvasRef,
        activeRedactions: [],
        selectedId: null,
        currentTimeMs: 1000,
        videoDurationMs: 10000,
        onAddRedaction: vi.fn(),
        onUpdateRedaction: vi.fn(),
        onSelectRedaction: vi.fn()
      })
    );

    expect(result.current.mode).toBe('idle');
    expect(result.current.currentDragRect).toBeNull();
    expect(result.current.activeHandle).toBeNull();
    expect(result.current.hoveredHandle).toBeNull();
    expect(result.current.cursorStyle).toBe('crosshair');
  });

  it('updates cursor to move when hovering over active box', () => {
    const canvasRef = { current: mockCanvas };
    const activeRedactions: RedactionBox[] = [
      {
        id: 'box-1',
        label: 'Test',
        type: 'blur',
        startMs: 0,
        endMs: 5000,
        bbox: [0.1, 0.1, 0.3, 0.3] // Screen: left 100 + 80 = 180, top 50 + 40 = 90
      }
    ];

    const { result } = renderHook(() =>
      useCanvasInteraction({
        canvasRef,
        activeRedactions,
        selectedId: null,
        currentTimeMs: 1000,
        videoDurationMs: 10000,
        onAddRedaction: vi.fn(),
        onUpdateRedaction: vi.fn(),
        onSelectRedaction: vi.fn()
      })
    );

    // Hover inside box-1 (screen X: 200, Y: 100)
    act(() => {
      result.current.handleCanvasPointerMove({
        clientX: 200,
        clientY: 100
      } as unknown as React.PointerEvent<HTMLCanvasElement>);
    });

    expect(result.current.cursorStyle).toBe('move');

    // Hover outside (screen X: 500, Y: 400)
    act(() => {
      result.current.handleCanvasPointerMove({
        clientX: 500,
        clientY: 400
      } as unknown as React.PointerEvent<HTMLCanvasElement>);
    });

    expect(result.current.cursorStyle).toBe('crosshair');
  });

  it('draws a new bounding box when drag exceeds micro-drag threshold', () => {
    const canvasRef = { current: mockCanvas };
    const onAddRedaction = vi.fn().mockReturnValue('new-box-id');

    const { result } = renderHook(() =>
      useCanvasInteraction({
        canvasRef,
        activeRedactions: [],
        selectedId: null,
        currentTimeMs: 2000,
        videoDurationMs: 10000,
        onAddRedaction,
        onUpdateRedaction: vi.fn(),
        onSelectRedaction: vi.fn()
      })
    );

    // 1. Pointer down at (100, 50) -> norm (0, 0)
    act(() => {
      result.current.handlePointerDown({
        clientX: 100,
        clientY: 50
      } as unknown as React.PointerEvent<HTMLCanvasElement>);
    });

    // 2. Micro-drag <= 5px (e.g. 102, 52)
    act(() => {
      window.dispatchEvent(new PointerEvent('pointermove', { clientX: 102, clientY: 52 }));
    });

    expect(result.current.mode).toBe('idle');
    expect(result.current.currentDragRect).toBeNull();

    // 3. Significant drag > 5px (e.g. 300, 250) -> norm (0.25, 0.5)
    act(() => {
      window.dispatchEvent(new PointerEvent('pointermove', { clientX: 300, clientY: 250 }));
    });

    expect(result.current.mode).toBe('drawing');
    expect(result.current.currentDragRect).toEqual([0, 0, 0.25, 0.5]);

    // 4. Pointer up commits box
    act(() => {
      window.dispatchEvent(new PointerEvent('pointerup'));
    });

    expect(onAddRedaction).toHaveBeenCalledWith({
      label: 'Redaction',
      type: 'blur',
      startMs: 2000,
      endMs: 5000,
      bbox: [0, 0, 0.25, 0.5]
    });

    expect(result.current.mode).toBe('idle');
    expect(result.current.currentDragRect).toBeNull();
  });

  it('selects and translates an existing bounding box', () => {
    const canvasRef = { current: mockCanvas };
    const onSelectRedaction = vi.fn();
    const onUpdateRedaction = vi.fn();

    const activeRedactions: RedactionBox[] = [
      {
        id: 'box-move',
        label: 'Target',
        type: 'pixelate',
        startMs: 0,
        endMs: 5000,
        bbox: [0.1, 0.1, 0.2, 0.2] // Screen: left 180, top 90, width 160, height 80
      }
    ];

    const { result } = renderHook(() =>
      useCanvasInteraction({
        canvasRef,
        activeRedactions,
        selectedId: null,
        currentTimeMs: 1000,
        videoDurationMs: 10000,
        onAddRedaction: vi.fn(),
        onUpdateRedaction,
        onSelectRedaction
      })
    );

    // Pointer down inside box-move at (200, 100)
    act(() => {
      result.current.handlePointerDown({
        clientX: 200,
        clientY: 100
      } as unknown as React.PointerEvent<HTMLCanvasElement>);
    });

    expect(onSelectRedaction).toHaveBeenCalledWith('box-move');
    expect(result.current.mode).toBe('moving');

    // Drag by +80px horizontal (+0.1 norm), +40px vertical (+0.1 norm)
    act(() => {
      window.dispatchEvent(new PointerEvent('pointermove', { clientX: 280, clientY: 140 }));
    });

    expect(result.current.currentDragRect).toEqual([0.2, 0.2, 0.2, 0.2]);

    // Pointer up commits moved box
    act(() => {
      window.dispatchEvent(new PointerEvent('pointerup'));
    });

    expect(onUpdateRedaction).toHaveBeenCalledWith('box-move', {
      bbox: [0.2, 0.2, 0.2, 0.2]
    });
    expect(result.current.mode).toBe('idle');
  });

  it('resizes a bounding box with handle inversion', () => {
    const canvasRef = { current: mockCanvas };
    const onUpdateRedaction = vi.fn();

    const activeRedactions: RedactionBox[] = [
      {
        id: 'box-resize',
        label: 'Face',
        type: 'blur',
        startMs: 0,
        endMs: 5000,
        bbox: [0.2, 0.2, 0.2, 0.2] // Norm: [0.2, 0.2, 0.2, 0.2] -> Screen: 260, 130, 160, 80 -> SE corner at (420, 210)
      }
    ];

    const { result } = renderHook(() =>
      useCanvasInteraction({
        canvasRef,
        activeRedactions,
        selectedId: 'box-resize',
        currentTimeMs: 1000,
        videoDurationMs: 10000,
        onAddRedaction: vi.fn(),
        onUpdateRedaction,
        onSelectRedaction: vi.fn()
      })
    );

    // Click on SE handle (around 420, 210)
    act(() => {
      result.current.handlePointerDown({
        clientX: 420,
        clientY: 210
      } as unknown as React.PointerEvent<HTMLCanvasElement>);
    });

    expect(result.current.mode).toBe('resizing');
    expect(result.current.activeHandle).toBe('se');

    // Drag SE corner to the right and down: clientX 500, clientY 290 -> norm (0.5, 0.6)
    act(() => {
      window.dispatchEvent(new PointerEvent('pointermove', { clientX: 500, clientY: 290 }));
    });

    expect(result.current.currentDragRect).toEqual([0.2, 0.2, 0.3, 0.4]);

    // Handle inversion: drag SE corner *past* the NW origin (to clientX 180, clientY 90 -> norm 0.1, 0.1)
    act(() => {
      window.dispatchEvent(new PointerEvent('pointermove', { clientX: 180, clientY: 90 }));
    });

    // Inverted bounds should re-normalize so origin is NW (0.1, 0.1) and dimensions are positive (0.1, 0.1)
    expect(result.current.currentDragRect).toEqual([0.1, 0.1, 0.1, 0.1]);

    // Pointer up commits normalized box
    act(() => {
      window.dispatchEvent(new PointerEvent('pointerup'));
    });

    expect(onUpdateRedaction).toHaveBeenCalledWith('box-resize', {
      bbox: [0.1, 0.1, 0.1, 0.1]
    });
    expect(result.current.mode).toBe('idle');
  });

  it('cancels active drag gesture and deselects on Escape key', () => {
    const canvasRef = { current: mockCanvas };
    const onSelectRedaction = vi.fn();

    const { result } = renderHook(() =>
      useCanvasInteraction({
        canvasRef,
        activeRedactions: [],
        selectedId: 'box-1',
        currentTimeMs: 1000,
        videoDurationMs: 10000,
        onAddRedaction: vi.fn(),
        onUpdateRedaction: vi.fn(),
        onSelectRedaction
      })
    );

    act(() => {
      result.current.handlePointerDown({
        clientX: 100,
        clientY: 50
      } as unknown as React.PointerEvent<HTMLCanvasElement>);
    });

    act(() => {
      window.dispatchEvent(new PointerEvent('pointermove', { clientX: 300, clientY: 200 }));
    });

    expect(result.current.mode).toBe('drawing');

    // Press Escape
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(result.current.mode).toBe('idle');
    expect(result.current.currentDragRect).toBeNull();
    expect(onSelectRedaction).toHaveBeenCalledWith(null);
  });
});
