function removeBackgroundColor(
  png: PNG,
  options: BackgroundRemovalOptions = {}
): PNG {
  const {
    targetColor = { r: 19, g: 18, b: 24 },
    tolerance = 10,
    debug = true,
    addPadding = true,
  } = options;

  // Determine the actual content width
  let leftmostNonBackgroundPixel = png.width;
  let rightmostNonBackgroundPixel = 0;

  // First pass: find the actual content boundaries
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      const idx = (png.width * y + x) << 2;
      const r = png.data[idx];
      const g = png.data[idx + 1];
      const b = png.data[idx + 2];

      // Enhanced color matching with euclidean distance
      const colorDistance = Math.sqrt(
        Math.pow(r - targetColor.r, 2) +
          Math.pow(g - targetColor.g, 2) +
          Math.pow(b - targetColor.b, 2)
      );

      const isBackground = colorDistance <= tolerance;

      if (!isBackground) {
        leftmostNonBackgroundPixel = Math.min(leftmostNonBackgroundPixel, x);
        rightmostNonBackgroundPixel = Math.max(rightmostNonBackgroundPixel, x);
      }
    }
  }

  // Calculate content width and padding
  const contentWidth =
    rightmostNonBackgroundPixel - leftmostNonBackgroundPixel + 1;
  const paddingWidth = addPadding
    ? Math.max(0, png.width - contentWidth) / 2
    : 0;
  const newWidth = contentWidth + 2 * paddingWidth;

  // Create a new PNG with potentially wider dimensions
  const processedPng = new PNG({
    width: newWidth,
    height: png.height,
  });

  // Ensure data buffer is correctly allocated
  processedPng.data = Buffer.alloc(newWidth * png.height * 4, 0);

  let transparentPixelCount = 0;
  let totalPixelCount = 0;

  // Second pass: process pixels with padding
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      const srcIdx = (png.width * y + x) << 2;
      const r = png.data[srcIdx];
      const g = png.data[srcIdx + 1];
      const b = png.data[srcIdx + 2];
      const a = png.data[srcIdx + 3] || 255;

      // Enhanced color matching
      const colorDistance = Math.sqrt(
        Math.pow(r - targetColor.r, 2) +
          Math.pow(g - targetColor.g, 2) +
          Math.pow(b - targetColor.b, 2)
      );

      const isBackground = colorDistance <= tolerance;

      // Calculate new pixel position with padding
      if (x >= leftmostNonBackgroundPixel && x <= rightmostNonBackgroundPixel) {
        const newX = x - leftmostNonBackgroundPixel + paddingWidth;
        const dstIdx = (newWidth * y + newX) << 2;

        if (isBackground) {
          // Make pixel fully transparent
          processedPng.data[dstIdx] = 0; // R
          processedPng.data[dstIdx + 1] = 0; // G
          processedPng.data[dstIdx + 2] = 0; // B
          processedPng.data[dstIdx + 3] = 0; // Alpha
          transparentPixelCount++;
        } else {
          // Preserve original pixel
          processedPng.data[dstIdx] = r;
          processedPng.data[dstIdx + 1] = g;
          processedPng.data[dstIdx + 2] = b;
          processedPng.data[dstIdx + 3] = a;
        }
        totalPixelCount++;
      }
    }
  }

  // Debug logging
  if (debug) {
    console.log("Background Removal Stats:");
    console.log(`Original Width: ${png.width}`);
    console.log(`New Width: ${newWidth}`);
    console.log(`Leftmost Non-Background Pixel: ${leftmostNonBackgroundPixel}`);
    console.log(
      `Rightmost Non-Background Pixel: ${rightmostNonBackgroundPixel}`
    );
    console.log(`Total Pixels: ${totalPixelCount}`);
    console.log(`Transparent Pixels: ${transparentPixelCount}`);
    console.log(
      `Percentage Removed: ${(
        (transparentPixelCount / totalPixelCount) *
        100
      ).toFixed(2)}%`
    );
  }

  return processedPng;
}
