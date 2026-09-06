import { describe, it, expect } from 'vitest';
import {
  clamp,
  screenToNormalized,
  normalizedToScreen,
  normalizeRect,
  getHandlePositions,
  getHandleAtPoint,
  isPointInBox,
  isMicroDrag,
} from '../../src/utils/coordinates';
import { NormalizedBBoxTuple } from '../../src/types';

describe('Coordinates Math & Boundary Clamping', () => {
  const mockCanvasRect: DOMRect = {
    left: 100,
    top: 50,
    width: 800,
    height: 450,
    right: 900,
    bottom: 500,
    x: 100,
    y: 50,
    toJSON: () => {},
  };

  it('clamps values correctly between min and max bounds', () => {
    expect(clamp(0.5, 0, 1)).toBe(0.5);
    expect(clamp(-0.5, 0, 1)).toBe(0);
    expect(clamp(1.5, 0, 1)).toBe(1);
    expect(clamp(10, 20, 30)).toBe(20);
    expect(clamp(40, 20, 30)).toBe(30);
  });

  describe('screenToNormalized', () => {
    it('maps top-left, center, and bottom-right viewport coordinates to normalized space', () => {
      // Top-left
      expect(screenToNormalized(100, 50, mockCanvasRect)).toEqual({ normX: 0, normY: 0 });
      // Center
      expect(screenToNormalized(500, 275, mockCanvasRect)).toEqual({ normX: 0.5, normY: 0.5 });
      // Bottom-right
      expect(screenToNormalized(900, 500, mockCanvasRect)).toEqual({ normX: 1, normY: 1 });
    });

    it('strictly clamps pointer coordinates outside the canvas boundary', () => {
      // Far left and above
      expect(screenToNormalized(0, 0, mockCanvasRect)).toEqual({ normX: 0, normY: 0 });
      // Far right and below
      expect(screenToNormalized(1500, 1000, mockCanvasRect)).toEqual({ normX: 1, normY: 1 });
    });

    it('handles zero or negative canvas dimensions without crashing', () => {
      const zeroRect: DOMRect = { ...mockCanvasRect, width: 0, height: 0 };
      expect(screenToNormalized(150, 150, zeroRect)).toEqual({ normX: 0, normY: 0 });
    });
  });

  describe('normalizedToScreen', () => {
    it('converts normalized ratios back to screen viewport pixels accurately', () => {
      expect(normalizedToScreen(0, 0, mockCanvasRect)).toEqual({ clientX: 100, clientY: 50 });
      expect(normalizedToScreen(0.5, 0.5, mockCanvasRect)).toEqual({ clientX: 500, clientY: 275 });
      expect(normalizedToScreen(1, 1, mockCanvasRect)).toEqual({ clientX: 900, clientY: 500 });
    });
  });

  describe('normalizeRect & Handle Inversion', () => {
    it('produces positive width and height for normal top-left to bottom-right drags', () => {
      const bbox = normalizeRect(0.2, 0.3, 0.6, 0.7);
      expect(bbox).toEqual([0.2, 0.3, 0.4, 0.4]);
    });

    it('corrects handle inversion when dragging top-left handle past bottom-right handle', () => {
      // Dragging backwards from (0.6, 0.7) to (0.2, 0.3)
      const bbox = normalizeRect(0.6, 0.7, 0.2, 0.3);
      expect(bbox[0]).toBeCloseTo(0.2);
      expect(bbox[1]).toBeCloseTo(0.3);
      expect(bbox[2]).toBeCloseTo(0.4);
      expect(bbox[3]).toBeCloseTo(0.4);
    });

    it('clamps bounding box coordinates within [0.0, 1.0] when dragged out of bounds', () => {
      const bbox = normalizeRect(-0.2, -0.1, 1.2, 1.5);
      expect(bbox[0]).toBe(0);
      expect(bbox[1]).toBe(0);
      expect(bbox[2]).toBe(1);
      expect(bbox[3]).toBe(1);
    });
  });

  describe('getHandlePositions & getHandleAtPoint', () => {
    const testBbox: NormalizedBBoxTuple = [0.25, 0.25, 0.5, 0.5];

    it('calculates screen positions for all 8 resize handles and center move', () => {
      const handles = getHandlePositions(testBbox, mockCanvasRect);

      // Canvas dimensions: left: 100, top: 50, width: 800, height: 450
      // BBox: x: 100 + 0.25*800 = 300, y: 50 + 0.25*450 = 162.5
      // width: 0.5*800 = 400, height: 0.5*450 = 225
      expect(handles.nw).toEqual({ clientX: 300, clientY: 162.5 });
      expect(handles.ne).toEqual({ clientX: 700, clientY: 162.5 });
      expect(handles.se).toEqual({ clientX: 700, clientY: 387.5 });
      expect(handles.sw).toEqual({ clientX: 300, clientY: 387.5 });
      expect(handles.n).toEqual({ clientX: 500, clientY: 162.5 });
      expect(handles.s).toEqual({ clientX: 500, clientY: 387.5 });
      expect(handles.w).toEqual({ clientX: 300, clientY: 275 });
      expect(handles.e).toEqual({ clientX: 700, clientY: 275 });
      expect(handles.move).toEqual({ clientX: 500, clientY: 275 });
    });

    it('detects handle clicks within hit radius and rejects points outside radius', () => {
      // NW handle is at (300, 162.5). Radius: 10px.
      expect(getHandleAtPoint(302, 164, testBbox, mockCanvasRect, 10)).toBe('nw');
      expect(getHandleAtPoint(308, 162.5, testBbox, mockCanvasRect, 10)).toBe('nw');
      // Point too far from any handle
      expect(getHandleAtPoint(325, 162.5, testBbox, mockCanvasRect, 10)).toBeNull();
      // Center of box is not a corner/edge handle
      expect(getHandleAtPoint(500, 275, testBbox, mockCanvasRect, 10)).toBeNull();
    });
  });

  describe('isPointInBox', () => {
    const testBbox: NormalizedBBoxTuple = [0.2, 0.2, 0.4, 0.4];

    it('returns true for points inside the bounding box', () => {
      // Box bounds: left 260, top 140, right 580, bottom 320
      expect(isPointInBox(300, 200, testBbox, mockCanvasRect)).toBe(true);
      expect(isPointInBox(260, 140, testBbox, mockCanvasRect)).toBe(true);
    });

    it('returns false for points outside the bounding box', () => {
      expect(isPointInBox(200, 200, testBbox, mockCanvasRect)).toBe(false);
      expect(isPointInBox(600, 200, testBbox, mockCanvasRect)).toBe(false);
    });
  });

  describe('isMicroDrag', () => {
    it('flags drags smaller than threshold as micro-drags', () => {
      expect(isMicroDrag(100, 100, 102, 103, 5)).toBe(true);
      expect(isMicroDrag(100, 100, 100, 100, 5)).toBe(true);
    });

    it('returns false for actionable drags exceeding threshold', () => {
      expect(isMicroDrag(100, 100, 110, 110, 5)).toBe(false);
      expect(isMicroDrag(100, 100, 105, 100, 5)).toBe(false);
    });
  });
});
