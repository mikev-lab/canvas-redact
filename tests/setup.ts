import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock window.URL methods
if (typeof window !== 'undefined') {
  window.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-video-url');
  window.URL.revokeObjectURL = vi.fn();

  // Mock requestAnimationFrame
  window.requestAnimationFrame = vi.fn().mockImplementation((cb: FrameRequestCallback) => {
    return setTimeout(() => cb(performance.now()), 16) as unknown as number;
  });
  window.cancelAnimationFrame = vi.fn().mockImplementation((id: number) => {
    clearTimeout(id);
  });

  // Polyfill PointerEvent for JSDOM
  if (!window.PointerEvent) {
    class MockPointerEvent extends MouseEvent {
      pointerId: number;
      pointerType: string;

      constructor(type: string, params: PointerEventInit = {}) {
        super(type, params);
        this.pointerId = params.pointerId || 0;
        this.pointerType = params.pointerType || 'mouse';
      }
    }
    // @ts-expect-error Polyfilling PointerEvent in JSDOM
    window.PointerEvent = MockPointerEvent;
    // @ts-expect-error Polyfilling PointerEvent in global
    global.PointerEvent = MockPointerEvent;
  }

  // Mock HTMLCanvasElement getContext('2d')
  HTMLCanvasElement.prototype.getContext = vi.fn().mockImplementation((contextId: string) => {
    if (contextId === '2d') {
      return {
        canvas: document.createElement('canvas'),
        fillRect: vi.fn(),
        clearRect: vi.fn(),
        strokeRect: vi.fn(),
        drawImage: vi.fn(),
        getImageData: vi.fn().mockReturnValue({ data: new Uint8ClampedArray(4) }),
        putImageData: vi.fn(),
        createImageData: vi.fn(),
        setTransform: vi.fn(),
        save: vi.fn(),
        restore: vi.fn(),
        beginPath: vi.fn(),
        closePath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        rect: vi.fn(),
        arc: vi.fn(),
        clip: vi.fn(),
        scale: vi.fn(),
        rotate: vi.fn(),
        translate: vi.fn(),
        transform: vi.fn(),
        fillText: vi.fn(),
        strokeText: vi.fn(),
        measureText: vi.fn().mockReturnValue({ width: 50 }),
        stroke: vi.fn(),
        fill: vi.fn(),
        filter: 'none',
        fillStyle: '#000000',
        strokeStyle: '#000000',
        lineWidth: 1,
        imageSmoothingEnabled: true,
      } as unknown as CanvasRenderingContext2D;
    }
    return null;
  });
}
