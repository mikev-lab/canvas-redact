import { NormalizedBBoxTuple, ResizeHandle } from '../types';

/**
 * Clamps a scalar value between a lower and upper bound.
 *
 * @param value - Scalar value to clamp.
 * @param min - Minimum acceptable bound.
 * @param max - Maximum acceptable bound.
 * @returns Clamped scalar value.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Converts viewport client pointer coordinates (clientX, clientY) into normalized
 * video space in the range [0.0, 1.0] relative to the canvas element bounds.
 *
 * @param clientX - Pointer event clientX in viewport pixels.
 * @param clientY - Pointer event clientY in viewport pixels.
 * @param canvasRect - Bounding client rectangle of the target canvas.
 * @returns Object with normalized coordinates { normX, normY } in [0.0, 1.0].
 *
 * @remarks
 * Accounts for canvas layout positioning and clamps values to guarantee coordinates
 * never exceed the video viewport boundaries.
 */
export function screenToNormalized(
  clientX: number,
  clientY: number,
  canvasRect: DOMRect
): { normX: number; normY: number } {
  if (canvasRect.width <= 0 || canvasRect.height <= 0) {
    return { normX: 0, normY: 0 };
  }

  const rawNormX = (clientX - canvasRect.left) / canvasRect.width;
  const rawNormY = (clientY - canvasRect.top) / canvasRect.height;

  return {
    normX: clamp(rawNormX, 0, 1),
    normY: clamp(rawNormY, 0, 1),
  };
}

/**
 * Converts normalized video coordinates in the range [0.0, 1.0] back to viewport
 * client screen pixels.
 *
 * @param normX - Normalized horizontal coordinate [0.0 .. 1.0].
 * @param normY - Normalized vertical coordinate [0.0 .. 1.0].
 * @param canvasRect - Bounding client rectangle of the target canvas.
 * @returns Object with viewport screen pixels { clientX, clientY }.
 */
export function normalizedToScreen(
  normX: number,
  normY: number,
  canvasRect: DOMRect
): { clientX: number; clientY: number } {
  return {
    clientX: canvasRect.left + normX * canvasRect.width,
    clientY: canvasRect.top + normY * canvasRect.height,
  };
}

/**
 * Normalizes two arbitrary points into a valid bounding box tuple [x, y, width, height]
 * with guaranteed positive width and height, clamped strictly to [0.0, 1.0].
 *
 * @param normX1 - First normalized horizontal coordinate.
 * @param normY1 - First normalized vertical coordinate.
 * @param normX2 - Second normalized horizontal coordinate.
 * @param normY2 - Second normalized vertical coordinate.
 * @returns NormalizedBBoxTuple [x, y, width, height].
 *
 * @remarks
 * Corrects for handle boundary inversion: if the user drags a top-left handle past
 * the bottom-right handle, the coordinates are swapped so the origin is always top-left.
 */
export function normalizeRect(
  normX1: number,
  normY1: number,
  normX2: number,
  normY2: number
): NormalizedBBoxTuple {
  const originX = Math.min(normX1, normX2);
  const originY = Math.min(normY1, normY2);
  const rawWidth = Math.abs(normX1 - normX2);
  const rawHeight = Math.abs(normY1 - normY2);

  const round6 = (val: number) => Math.round(val * 1000000) / 1000000;

  const clampedX = round6(clamp(originX, 0, 1));
  const clampedY = round6(clamp(originY, 0, 1));
  const clampedWidth = round6(clamp(rawWidth, 0, 1 - clampedX));
  const clampedHeight = round6(clamp(rawHeight, 0, 1 - clampedY));

  return [clampedX, clampedY, clampedWidth, clampedHeight];
}

/**
 * Calculates screen pixel positions for all 8 resize handles and the center move handle.
 *
 * @param normBbox - Normalized bounding box [x, y, width, height].
 * @param canvasRect - Bounding client rectangle of the target canvas.
 * @returns Map of resize handle positions in client screen pixels.
 */
export function getHandlePositions(
  normBbox: NormalizedBBoxTuple,
  canvasRect: DOMRect
): Record<ResizeHandle, { clientX: number; clientY: number }> {
  const [normX, normY, normW, normH] = normBbox;

  const left = canvasRect.left + normX * canvasRect.width;
  const top = canvasRect.top + normY * canvasRect.height;
  const width = normW * canvasRect.width;
  const height = normH * canvasRect.height;

  const midX = left + width / 2;
  const midY = top + height / 2;
  const right = left + width;
  const bottom = top + height;

  return {
    nw: { clientX: left, clientY: top },
    n: { clientX: midX, clientY: top },
    ne: { clientX: right, clientY: top },
    e: { clientX: right, clientY: midY },
    se: { clientX: right, clientY: bottom },
    s: { clientX: midX, clientY: bottom },
    sw: { clientX: left, clientY: bottom },
    w: { clientX: left, clientY: midY },
    move: { clientX: midX, clientY: midY },
  };
}

/**
 * Determines whether a mouse or touch point lies within the interactive hit radius of
 * any bounding box resize handle.
 *
 * @param clientX - Pointer clientX in viewport pixels.
 * @param clientY - Pointer clientY in viewport pixels.
 * @param normBbox - Normalized bounding box [x, y, width, height].
 * @param canvasRect - Bounding client rectangle of the target canvas.
 * @param hitRadius - Hit tolerance radius in screen pixels (default: 10px).
 * @returns Hit ResizeHandle or null if no handle was intersected.
 */
export function getHandleAtPoint(
  clientX: number,
  clientY: number,
  normBbox: NormalizedBBoxTuple,
  canvasRect: DOMRect,
  hitRadius: number = 10
): ResizeHandle | null {
  const handles = getHandlePositions(normBbox, canvasRect);
  const resizeOrder: ResizeHandle[] = ['nw', 'ne', 'se', 'sw', 'n', 'e', 's', 'w'];

  // Check corners first, then edge handles
  for (const handle of resizeOrder) {
    const pos = handles[handle];
    const dx = clientX - pos.clientX;
    const dy = clientY - pos.clientY;
    const distanceSq = dx * dx + dy * dy;

    if (distanceSq <= hitRadius * hitRadius) {
      return handle;
    }
  }

  return null;
}

/**
 * Tests whether a viewport point is inside a normalized bounding box.
 *
 * @param clientX - Pointer clientX in viewport pixels.
 * @param clientY - Pointer clientY in viewport pixels.
 * @param normBbox - Normalized bounding box [x, y, width, height].
 * @param canvasRect - Bounding client rectangle of the target canvas.
 * @returns True if point is within the bounding box.
 */
export function isPointInBox(
  clientX: number,
  clientY: number,
  normBbox: NormalizedBBoxTuple,
  canvasRect: DOMRect
): boolean {
  const [normX, normY, normW, normH] = normBbox;

  const left = canvasRect.left + normX * canvasRect.width;
  const top = canvasRect.top + normY * canvasRect.height;
  const right = left + normW * canvasRect.width;
  const bottom = top + normH * canvasRect.height;

  return clientX >= left && clientX <= right && clientY >= top && clientY <= bottom;
}

/**
 * Detects whether a drag interaction was a micro-drag below actionable threshold.
 *
 * @param clientStartX - Starting clientX in screen pixels.
 * @param clientStartY - Starting clientY in screen pixels.
 * @param clientEndX - Current or ending clientX in screen pixels.
 * @param clientEndY - Current or ending clientY in screen pixels.
 * @param thresholdPx - Distance threshold in pixels (default: 5px).
 * @returns True if distance is strictly under threshold.
 */
export function isMicroDrag(
  clientStartX: number,
  clientStartY: number,
  clientEndX: number,
  clientEndY: number,
  thresholdPx: number = 5
): boolean {
  const dx = clientEndX - clientStartX;
  const dy = clientEndY - clientStartY;
  return dx * dx + dy * dy < thresholdPx * thresholdPx;
}
