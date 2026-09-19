/**
 * Utility functions for parsing object bounding boxes and creating tight close-up thumbnails.
 */

/**
 * Parses raw bounding box data from Gemini Vision into [ymin, xmin, ymax, xmax] clamped to [0, 1000].
 * Supports:
 * - [ymin, xmin, ymax, xmax] standard integer (0 ~ 1000)
 * - [ymin, xmin, ymax, xmax] float normalized (0.0 ~ 1.0)
 * - Raw pixel coordinates (> 1000)
 * - Object format { ymin, xmin, ymax, xmax } or { box_2d: [...] }
 */
export function parseBoundingBox(rawBox, imgW = 1000, imgH = 1000) {
  if (!rawBox) return null;
  let coords = null;

  if (Array.isArray(rawBox) && rawBox.length >= 4) {
    coords = rawBox.slice(0, 4).map(Number);
  } else if (typeof rawBox === 'object') {
    if ('ymin' in rawBox && 'xmin' in rawBox && 'ymax' in rawBox && 'xmax' in rawBox) {
      coords = [Number(rawBox.ymin), Number(rawBox.xmin), Number(rawBox.ymax), Number(rawBox.xmax)];
    } else if ('box_2d' in rawBox && Array.isArray(rawBox.box_2d) && rawBox.box_2d.length >= 4) {
      coords = rawBox.box_2d.slice(0, 4).map(Number);
    } else if ('y' in rawBox && 'x' in rawBox && 'y2' in rawBox && 'x2' in rawBox) {
      coords = [Number(rawBox.y), Number(rawBox.x), Number(rawBox.y2), Number(rawBox.x2)];
    } else if ('top' in rawBox && 'left' in rawBox && 'bottom' in rawBox && 'right' in rawBox) {
      coords = [Number(rawBox.top), Number(rawBox.left), Number(rawBox.bottom), Number(rawBox.right)];
    }
  }

  if (!coords || coords.some((n) => isNaN(n))) return null;

  // 1. Normalized 0.0 ~ 1.0 float coordinates
  if (coords.every((n) => n >= 0 && n <= 1.05)) {
    coords = coords.map((n) => Math.round(n * 1000));
  }
  // 2. Coordinates in actual image pixels (> 1000)
  else if (coords.some((n) => n > 1000)) {
    const [y1, x1, y2, x2] = coords;
    coords = [
      (y1 / imgH) * 1000,
      (x1 / imgW) * 1000,
      (y2 / imgH) * 1000,
      (x2 / imgW) * 1000,
    ];
  }

  const ymin = Math.max(0, Math.min(1000, Math.min(coords[0], coords[2])));
  const xmin = Math.max(0, Math.min(1000, Math.min(coords[1], coords[3])));
  const ymax = Math.max(0, Math.min(1000, Math.max(coords[0], coords[2])));
  const xmax = Math.max(0, Math.min(1000, Math.max(coords[1], coords[3])));

  if (xmax - xmin < 4 || ymax - ymin < 4) return null;
  return [ymin, xmin, ymax, xmax];
}

/**
 * Crops a focused, tight close-up thumbnail of the recognized object from an HTMLImageElement.
 * The object fills almost the entire square thumbnail with minimal padding (~3%).
 *
 * @param {HTMLImageElement} img - Source image
 * @param {Array|Object} box_2d - Bounding box [ymin, xmin, ymax, xmax]
 * @param {number} targetSize - Canvas target width & height in px (default 260)
 * @returns {string|null} - JPEG base64 dataUrl, or null on failure
 */
export function cropObjectThumbnail(img, box_2d, targetSize = 260) {
  if (!img) return null;
  try {
    const imgW = img.naturalWidth || img.width;
    const imgH = img.naturalHeight || img.height;
    if (!imgW || !imgH) return null;

    const parsedBox = parseBoundingBox(box_2d, imgW, imgH);

    const canvas = document.createElement('canvas');
    canvas.width = targetSize;
    canvas.height = targetSize;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Warm background fill in case image edge is reached
    ctx.fillStyle = '#FAF8F5';
    ctx.fillRect(0, 0, targetSize, targetSize);

    if (!parsedBox) {
      // Fallback if no box found: center-cropped square view (not full squished image)
      const minDim = Math.min(imgW, imgH);
      const sx = Math.round((imgW - minDim) / 2);
      const sy = Math.round((imgH - minDim) / 2);
      ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, targetSize, targetSize);
      return canvas.toDataURL('image/jpeg', 0.75);
    }

    const [ymin, xmin, ymax, xmax] = parsedBox;

    // Convert 0-1000 coordinates to actual pixel coordinates
    const origX = (xmin / 1000) * imgW;
    const origY = (ymin / 1000) * imgH;
    const origW = ((xmax - xmin) / 1000) * imgW;
    const origH = ((ymax - ymin) / 1000) * imgH;

    // Tight framing with minimal 3% padding so the object fills 94% of the thumbnail
    const padX = origW * 0.03;
    const padY = origH * 0.03;

    const bX1 = Math.max(0, origX - padX);
    const bY1 = Math.max(0, origY - padY);
    const bX2 = Math.min(imgW, origX + origW + padX);
    const bY2 = Math.min(imgH, origY + origH + padY);

    const bW = Math.max(10, bX2 - bX1);
    const bH = Math.max(10, bY2 - bY1);

    // Make a square crop centered tightly around the object
    const side = Math.max(bW, bH);
    const centerX = (bX1 + bX2) / 2;
    const centerY = (bY1 + bY2) / 2;

    let cropX = Math.round(centerX - side / 2);
    let cropY = Math.round(centerY - side / 2);

    // Keep crop within image bounds when possible
    if (cropX < 0) cropX = 0;
    if (cropY < 0) cropY = 0;
    if (cropX + side > imgW) cropX = Math.max(0, Math.round(imgW - side));
    if (cropY + side > imgH) cropY = Math.max(0, Math.round(imgH - side));

    const actualCropW = Math.min(Math.round(side), imgW - cropX);
    const actualCropH = Math.min(Math.round(side), imgH - cropY);

    if (actualCropW <= 0 || actualCropH <= 0) return null;

    // Scale to fill square canvas
    const drawScale = Math.max(targetSize / actualCropW, targetSize / actualCropH);
    const destW = Math.round(actualCropW * drawScale);
    const destH = Math.round(actualCropH * drawScale);
    const destX = Math.round((targetSize - destW) / 2);
    const destY = Math.round((targetSize - destH) / 2);

    ctx.drawImage(img, cropX, cropY, actualCropW, actualCropH, destX, destY, destW, destH);
    return canvas.toDataURL('image/jpeg', 0.75);
  } catch (err) {
    console.warn('Object thumbnail close-up crop failed:', err);
    return null;
  }
}
