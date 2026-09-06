import { describe, it, expect, vi, beforeEach } from 'vitest';
import { drawForensicFrame, createSampleVideo } from '../../src/sample/createSampleVideo';

describe('createSampleVideo procedural generator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('drawForensicFrame executes drawing pipeline on 2D canvas context', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext('2d');

    expect(ctx).toBeDefined();
    if (!ctx) return;

    // Spies on context methods
    const fillRectSpy = vi.spyOn(ctx, 'fillRect');
    const fillTextSpy = vi.spyOn(ctx, 'fillText');
    const arcSpy = vi.spyOn(ctx, 'arc');

    drawForensicFrame(ctx, 45, 150, 1280, 720, 30);

    expect(fillRectSpy).toHaveBeenCalled();
    expect(fillTextSpy).toHaveBeenCalled();
    expect(arcSpy).toHaveBeenCalled();
  });

  it('createSampleVideo generates metadata and blob in fallback environment', async () => {
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    const result = await createSampleVideo({
      durationMs: 3000,
      fps: 30,
      width: 1280,
      height: 720
    });

    expect(result.metadata.name).toBe('synthetic_cctv_evidence.mp4');
    expect(result.metadata.durationMs).toBe(3000);
    expect(result.metadata.dimensions).toEqual({ width: 1280, height: 720 });
    expect(result.metadata.fps).toBe(30);
    expect(result.url).toBeDefined();
    expect(result.blob).toBeInstanceOf(Blob);

    // Test revoke cleanup
    result.revoke();
    expect(revokeSpy).toHaveBeenCalledWith(result.url);
  });
});
