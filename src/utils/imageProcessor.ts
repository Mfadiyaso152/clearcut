/**
 * Utility functions for advanced client-side logo background removal and canvas operations
 */

export interface RGBColor {
  r: number;
  g: number;
  b: number;
}

/**
 * Detects the background color of an image by sampling the corners and edge pixels.
 * Since logos are usually placed on solid white, black, or brand color canvases,
 * sampling corners provides a very high accuracy rate.
 */
export function detectBackgroundColor(imageData: ImageData): RGBColor {
  const { data, width, height } = imageData;
  
  // Sample pixels near the corners
  const samples: RGBColor[] = [];
  const addSample = (x: number, y: number) => {
    const idx = (y * width + x) * 4;
    samples.push({
      r: data[idx],
      g: data[idx + 1],
      b: data[idx + 2]
    });
  };

  // Add 4 corners
  addSample(2, 2);
  addSample(width - 3, 2);
  addSample(2, height - 3);
  addSample(width - 3, height - 3);

  // Add a few edge centers
  addSample(Math.floor(width / 2), 2);
  addSample(2, Math.floor(height / 2));
  addSample(width - 3, Math.floor(height / 2));
  addSample(Math.floor(width / 2), height - 3);

  // Find the color that is most common or average the closest cluster
  // For most logo backgrounds, corners are identical.
  // We'll calculate the average of the most popular cluster.
  const frequencyMap: { [key: string]: { count: number; color: RGBColor } } = {};
  
  samples.forEach(color => {
    // Round to nearest multiple of 8 to cluster similar colors
    const key = `${Math.round(color.r / 8) * 8},${Math.round(color.g / 8) * 8},${Math.round(color.b / 8) * 8}`;
    if (frequencyMap[key]) {
      frequencyMap[key].count++;
    } else {
      frequencyMap[key] = { count: 1, color };
    }
  });

  let bestKey = "";
  let maxCount = -1;
  for (const key in frequencyMap) {
    if (frequencyMap[key].count > maxCount) {
      maxCount = frequencyMap[key].count;
      bestKey = key;
    }
  }

  return frequencyMap[bestKey]?.color || { r: 255, g: 255, b: 255 };
}

/**
 * Removes the target background color from ImageData using Euclidean distance color keying.
 * Includes tolerance adjustments and soft alpha feathering.
 */
export function removeBackground(
  originalData: ImageData,
  targetBg: RGBColor,
  tolerance: number,
  feather: number
): ImageData {
  const width = originalData.width;
  const height = originalData.height;
  
  // Create a clean ImageData to hold the result
  const resultData = new ImageData(new Uint8ClampedArray(originalData.data), width, height);
  const src = originalData.data;
  const dest = resultData.data;

  // Maximum possible RGB distance: sqrt(3 * 255^2) = ~441.67
  const maxDistance = 441.673;
  
  // Convert 0-100 tolerance to equivalent distance threshold (0 to 441.67)
  const threshold = (tolerance / 100) * maxDistance;
  
  // Convert 0-10 feathering to smooth distance width
  // A feather of 0 means a hard cutoff. Higher values fade the alpha smoothly.
  const featherRange = feather > 0 ? (feather / 10) * 120 + 5 : 0;

  for (let i = 0; i < src.length; i += 4) {
    const r = src[i];
    const g = src[i + 1];
    const b = src[i + 2];
    const a = src[i + 3];

    // If already fully transparent, skip
    if (a === 0) continue;

    // Euclidean distance in RGB color space
    const rd = r - targetBg.r;
    const gd = g - targetBg.g;
    const bd = b - targetBg.b;
    const distance = Math.sqrt(rd * rd + gd * gd + bd * bd);

    if (distance <= threshold) {
      // Background pixel: make fully transparent
      dest[i + 3] = 0;
    } else if (featherRange > 0 && distance < threshold + featherRange) {
      // Transitional edge pixel: calculate intermediate alpha (feathering)
      const ratio = (distance - threshold) / featherRange;
      const newAlpha = Math.round(a * ratio);
      dest[i + 3] = Math.min(a, newAlpha);
    } else {
      // Foreground logo pixel: retain original color and alpha
      dest[i + 3] = a;
    }
  }

  return resultData;
}

/**
 * Calculates the bounding box of non-transparent content (alpha > 8)
 * and crops the canvas to that precise box. This removes useless empty borders.
 */
export function cropTransparentMargins(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const width = canvas.width;
  const height = canvas.height;
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  let minX = width;
  let maxX = 0;
  let minY = height;
  let maxY = 0;
  let hasContent = false;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const alpha = data[idx + 3];

      // Alpha threshold: treat pixels with alpha > 12 as visible logo content
      if (alpha > 12) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        hasContent = true;
      }
    }
  }

  // If the image is completely transparent or no content is found, return original
  if (!hasContent) {
    return canvas;
  }

  // Add 4px padding around the detected bounds to avoid clipped edges
  const padding = 6;
  const cropX = Math.max(0, minX - padding);
  const cropY = Math.max(0, minY - padding);
  const cropW = Math.min(width - cropX, (maxX - minX + 1) + (padding * 2));
  const cropH = Math.min(height - cropY, (maxY - minY + 1) + (padding * 2));

  // Create cropped canvas
  const croppedCanvas = document.createElement("canvas");
  croppedCanvas.width = cropW;
  croppedCanvas.height = cropH;
  const croppedCtx = croppedCanvas.getContext("2d");

  if (croppedCtx) {
    // Draw the cropped region from original canvas to the new one
    croppedCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
    return croppedCanvas;
  }

  return canvas;
}

/**
 * Converts a hexadecimal color string to an RGBColor object.
 */
export function hexToRgb(hex: string): RGBColor {
  // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
  const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  const fullHex = hex.replace(shorthandRegex, (_, r, g, b) => r + r + g + g + b + b);

  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      }
    : { r: 255, g: 255, b: 255 };
}

/**
 * Converts an RGBColor object to its hexadecimal string representation.
 */
export function rgbToHex(r: number, g: number, b: number): string {
  const componentToHex = (c: number) => {
    const hex = Math.min(255, Math.max(0, c)).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };
  return `#${componentToHex(r)}${componentToHex(g)}${componentToHex(b)}`;
}
