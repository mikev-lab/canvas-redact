import { NormalizedBBoxTuple, RedactionType, ResizeHandle } from '../types';

export interface RenderRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Applies a Gaussian defocus blur filter over the specified bounding box region.
 *
 * @param ctx - Canvas 2D rendering context.
 * @param video - Source HTML5 video element.
 * @param renderRect - Bounding box in canvas CSS pixels { x, y, width, height }.
 * @param canvasWidth - Current canvas display width.
 * @param canvasHeight - Current canvas display height.
 * @param blurPx - Blur radius in pixels (default: 14px).
 *
 * @remarks
 * Uses ctx.clip() to constrain the blur effect strictly within the bounding box
 * coordinates, avoiding full-screen filtering overhead.
 */
export function applyBlur(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  renderRect: RenderRect,
  canvasWidth: number,
  canvasHeight: number,
  blurPx: number = 14
): void {
  const { x, y, width, height } = renderRect;
  if (width <= 0 || height <= 0) return;

  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, width, height);
  ctx.clip();

  ctx.filter = `blur(${blurPx}px)`;
  ctx.drawImage(video, 0, 0, canvasWidth, canvasHeight);
  ctx.restore();
}

/**
 * Applies a discrete mosaic pixelation filter over the specified bounding box region.
 *
 * @param ctx - Canvas 2D rendering context.
 * @param video - Source HTML5 video element.
 * @param scratchCanvas - Pre-allocated offscreen canvas to avoid GC allocation in hot loops.
 * @param renderRect - Bounding box in canvas CSS pixels { x, y, width, height }.
 * @param videoDimensions - Intrinsic resolution of the source media { width, height }.
 * @param normBbox - Normalized bounding box coordinates [x, y, width, height].
 * @param blockSize - Pixelation censor block size in screen pixels (default: 12px).
 *
 * @remarks
 * Downscales the raw video sub-region onto a tiny offscreen scratch canvas with
 * imageSmoothingEnabled set to false, then renders it back scaled up to create
 * clean forensic censorship blocks.
 */
export function applyPixelate(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  scratchCanvas: HTMLCanvasElement,
  renderRect: RenderRect,
  videoDimensions: { width: number; height: number },
  normBbox: NormalizedBBoxTuple,
  blockSize: number = 12
): void {
  const { x, y, width, height } = renderRect;
  if (width <= 0 || height <= 0) return;

  const [normX, normY, normW, normH] = normBbox;

  // Intrinsic video slice coordinates
  const videoX = Math.round(normX * videoDimensions.width);
  const videoY = Math.round(normY * videoDimensions.height);
  const videoW = Math.max(1, Math.round(normW * videoDimensions.width));
  const videoH = Math.max(1, Math.round(normH * videoDimensions.height));

  // Compute downscaled scratch dimensions based on block factor
  const downW = Math.max(1, Math.floor(width / blockSize));
  const downH = Math.max(1, Math.floor(height / blockSize));

  scratchCanvas.width = downW;
  scratchCanvas.height = downH;
  const sCtx = scratchCanvas.getContext('2d');
  if (!sCtx) return;

  sCtx.imageSmoothingEnabled = false;

  // Step 1: Draw video sub-region downscaled onto scratch canvas
  sCtx.drawImage(
    video,
    videoX, videoY, videoW, videoH,
    0, 0, downW, downH
  );

  // Step 2: Composite back upscaled with nearest-neighbor interpolation
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    scratchCanvas,
    0, 0, downW, downH,
    x, y, width, height
  );
  ctx.restore();
}

/**
 * Applies a solid opaque privacy blackout censor over the bounding box region.
 *
 * @param ctx - Canvas 2D rendering context.
 * @param renderRect - Bounding box in canvas CSS pixels { x, y, width, height }.
 * @param label - Optional forensic label string: e.g. "[REDACTED]" or "Suspect Face".
 */
export function applyBlackout(
  ctx: CanvasRenderingContext2D,
  renderRect: RenderRect,
  label: string = '[REDACTED]'
): void {
  const { x, y, width, height } = renderRect;
  if (width <= 0 || height <= 0) return;

  ctx.save();

  // Solid dark privacy shield
  ctx.fillStyle = '#09090b';
  ctx.fillRect(x, y, width, height);

  // Subtle border outline
  ctx.strokeStyle = '#27272a';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, width, height);

  // Centered label text if box dimensions permit
  if (width >= 60 && height >= 22) {
    ctx.font = '600 11px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#a1a1aa';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + width / 2, y + height / 2);
  }

  ctx.restore();
}

/**
 * Draws the vector boundary box, category accent border, and corner badges.
 *
 * @param ctx - Canvas 2D rendering context.
 * @param renderRect - Bounding box in canvas CSS pixels.
 * @param isSelected - Whether this bounding box is currently selected by the user.
 * @param label - Annotation label.
 * @param type - Redaction visual treatment ('blur', 'pixelate', 'blackout').
 */
export function drawBoundingBoxOutline(
  ctx: CanvasRenderingContext2D,
  renderRect: RenderRect,
  isSelected: boolean,
  label: string,
  type: RedactionType
): void {
  const { x, y, width, height } = renderRect;
  if (width <= 0 || height <= 0) return;

  ctx.save();

  // Border color based on selection and redaction type
  let strokeColor = '#3b82f6'; // default forensic blue
  if (type === 'pixelate') strokeColor = '#f59e0b'; // amber
  if (type === 'blackout') strokeColor = '#71717a'; // zinc

  if (isSelected) {
    ctx.strokeStyle = '#38bdf8'; // sky blue highlight
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 2]);
  } else {
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([]);
  }

  ctx.strokeRect(x, y, width, height);

  // Top header label badge
  if (width >= 50 && height >= 18) {
    ctx.setLineDash([]);
    ctx.font = '500 10px Inter, system-ui, sans-serif';
    const textWidth = ctx.measureText(label).width;
    const badgeWidth = Math.min(width, textWidth + 12);
    const badgeHeight = 16;

    ctx.fillStyle = isSelected ? '#0284c7' : strokeColor;
    ctx.fillRect(x, Math.max(0, y - badgeHeight), badgeWidth, badgeHeight);

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + 6, Math.max(badgeHeight / 2, y - badgeHeight / 2));
  }

  ctx.restore();
}

/**
 * Draws the 8 interactive resize handles around a selected bounding box.
 *
 * @param ctx - Canvas 2D rendering context.
 * @param handlePositions - Map of resize handles to screen coordinates.
 * @param activeHandle - Currently dragged handle if active.
 * @param handleSize - Square handle dimensions in pixels (default: 8px).
 */
export function drawResizeHandles(
  ctx: CanvasRenderingContext2D,
  handlePositions: Record<ResizeHandle, { clientX: number; clientY: number }>,
  activeHandle: ResizeHandle | null,
  canvasRect: DOMRect,
  handleSize: number = 8
): void {
  ctx.save();
  const half = handleSize / 2;
  const handlesToDraw: ResizeHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

  for (const handle of handlesToDraw) {
    const pos = handlePositions[handle];
    const screenX = pos.clientX - canvasRect.left;
    const screenY = pos.clientY - canvasRect.top;

    const isActive = activeHandle === handle;

    ctx.fillStyle = isActive ? '#38bdf8' : '#ffffff';
    ctx.strokeStyle = '#09090b';
    ctx.lineWidth = 1.5;

    ctx.fillRect(screenX - half, screenY - half, handleSize, handleSize);
    ctx.strokeRect(screenX - half, screenY - half, handleSize, handleSize);
  }

  ctx.restore();
}
