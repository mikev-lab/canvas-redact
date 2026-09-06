import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  applyBlur,
  applyPixelate,
  applyBlackout,
  drawBoundingBoxOutline,
  drawResizeHandles,
} from '../../src/utils/filters';
import { getHandlePositions } from '../../src/utils/coordinates';
import { NormalizedBBoxTuple } from '../../src/types';

describe('Canvas Redaction Filters & Vector Drawing', () => {
  let mockCtx: CanvasRenderingContext2D;
  let mockVideo: HTMLVideoElement;
  let mockScratchCanvas: HTMLCanvasElement;

  beforeEach(() => {
    mockCtx = {
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      rect: vi.fn(),
      clip: vi.fn(),
      drawImage: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      fillText: vi.fn(),
      setLineDash: vi.fn(),
      measureText: vi.fn().mockReturnValue({ width: 40 }),
      filter: 'none',
      fillStyle: '#000000',
      strokeStyle: '#000000',
      lineWidth: 1,
      imageSmoothingEnabled: true,
      font: '',
      textAlign: 'start',
      textBaseline: 'alphabetic',
    } as unknown as CanvasRenderingContext2D;

    mockVideo = document.createElement('video');
    mockScratchCanvas = document.createElement('canvas');
  });

  describe('applyBlur', () => {
    it('sets clipping path, applies Gaussian filter blur, and restores context state', () => {
      const renderRect = { x: 50, y: 40, width: 120, height: 80 };
      applyBlur(mockCtx, mockVideo, renderRect, 800, 450, 16);

      expect(mockCtx.save).toHaveBeenCalled();
      expect(mockCtx.beginPath).toHaveBeenCalled();
      expect(mockCtx.rect).toHaveBeenCalledWith(50, 40, 120, 80);
      expect(mockCtx.clip).toHaveBeenCalled();
      expect(mockCtx.filter).toBe('blur(16px)');
      expect(mockCtx.drawImage).toHaveBeenCalledWith(mockVideo, 0, 0, 800, 450);
      expect(mockCtx.restore).toHaveBeenCalled();
    });

    it('safely exits without drawing if renderRect has zero or negative dimensions', () => {
      applyBlur(mockCtx, mockVideo, { x: 0, y: 0, width: 0, height: 0 }, 800, 450);
      expect(mockCtx.drawImage).not.toHaveBeenCalled();
    });
  });

  describe('applyPixelate', () => {
    it('downsamples video region to offscreen scratch canvas and scales back up without smoothing', () => {
      const renderRect = { x: 100, y: 80, width: 120, height: 80 };
      const videoDimensions = { width: 1920, height: 1080 };
      const normBbox: NormalizedBBoxTuple = [0.1, 0.1, 0.2, 0.2];

      applyPixelate(mockCtx, mockVideo, mockScratchCanvas, renderRect, videoDimensions, normBbox, 10);

      // Downsampled dimensions: 120 / 10 = 12, 80 / 10 = 8
      expect(mockScratchCanvas.width).toBe(12);
      expect(mockScratchCanvas.height).toBe(8);

      // Upscaled draw call back to main context
      expect(mockCtx.save).toHaveBeenCalled();
      expect(mockCtx.imageSmoothingEnabled).toBe(false);
      expect(mockCtx.drawImage).toHaveBeenCalledWith(
        mockScratchCanvas,
        0, 0, 12, 8,
        100, 80, 120, 80
      );
      expect(mockCtx.restore).toHaveBeenCalled();
    });
  });

  describe('applyBlackout', () => {
    it('fills solid privacy censor and renders centered label badge', () => {
      const renderRect = { x: 200, y: 150, width: 100, height: 50 };
      applyBlackout(mockCtx, renderRect, 'IDENTIFIER');

      expect(mockCtx.save).toHaveBeenCalled();
      expect(mockCtx.fillRect).toHaveBeenCalledWith(200, 150, 100, 50);
      expect(mockCtx.strokeRect).toHaveBeenCalledWith(200, 150, 100, 50);
      expect(mockCtx.fillText).toHaveBeenCalledWith('IDENTIFIER', 250, 175);
      expect(mockCtx.restore).toHaveBeenCalled();
    });
  });

  describe('drawBoundingBoxOutline', () => {
    it('draws dashed highlight border when box is selected', () => {
      const renderRect = { x: 30, y: 30, width: 100, height: 60 };
      drawBoundingBoxOutline(mockCtx, renderRect, true, 'Face', 'blur');

      expect(mockCtx.save).toHaveBeenCalled();
      expect(mockCtx.setLineDash).toHaveBeenCalledWith([4, 2]);
      expect(mockCtx.strokeRect).toHaveBeenCalledWith(30, 30, 100, 60);
      expect(mockCtx.restore).toHaveBeenCalled();
    });

    it('draws solid border with category color when box is not selected', () => {
      const renderRect = { x: 30, y: 30, width: 100, height: 60 };
      drawBoundingBoxOutline(mockCtx, renderRect, false, 'Plate', 'pixelate');

      expect(mockCtx.strokeStyle).toBe('#f59e0b'); // amber
      expect(mockCtx.setLineDash).toHaveBeenCalledWith([]);
      expect(mockCtx.strokeRect).toHaveBeenCalledWith(30, 30, 100, 60);
    });
  });

  describe('drawResizeHandles', () => {
    it('draws 8 resize handle squares around selected box', () => {
      const normBbox: NormalizedBBoxTuple = [0.2, 0.2, 0.4, 0.4];
      const mockCanvasRect: DOMRect = {
        left: 0,
        top: 0,
        width: 1000,
        height: 500,
        right: 1000,
        bottom: 500,
        x: 0,
        y: 0,
        toJSON: () => {},
      };

      const handlePositions = getHandlePositions(normBbox, mockCanvasRect);
      drawResizeHandles(mockCtx, handlePositions, 'nw', mockCanvasRect, 8);

      expect(mockCtx.save).toHaveBeenCalled();
      // 8 handles rendered as filled squares and stroked outlines
      expect(mockCtx.fillRect).toHaveBeenCalledTimes(8);
      expect(mockCtx.strokeRect).toHaveBeenCalledTimes(8);
      expect(mockCtx.restore).toHaveBeenCalled();
    });
  });
});
