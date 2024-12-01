import { PNG } from "pngjs";
import * as canvas from "canvas";
import * as path from "path";
import * as fs from "fs";

interface Color {
  r: number;
  g: number;
  b: number;
}

interface ProcessingOptions {
  colorToKeep?: Color;
  backgroundColorToRemove?: Color;
  colorThreshold?: number;
}

interface BackgroundRemovalOptions {
  targetColor?: { r: number; g: number; b: number };
  tolerance?: number;
  debug?: boolean;
}

const colorToKeep: Color = { r: 255, g: 255, b: 255 }; // #bfbdc7

function processImage(originalImage: PNG): Buffer {
  // Get the pixel data as a buffer
  const pixelData = originalImage.data;

  // Create a copy of the original pixel data
  const newPixelData = new Uint8Array(pixelData);

  // Iterate through each pixel in the image
  for (let y = 0; y < originalImage.height; y++) {
    for (let x = 0; x < originalImage.width; x++) {
      // Calculate the offset into the pixel data buffer
      const offset = y * originalImage.width * 4 + x * 4;

      // Get the pixel values from the buffer
      const pixelR = newPixelData[offset];
      const pixelG = newPixelData[offset + 1];
      const pixelB = newPixelData[offset + 2];

      // Check if the pixel color is not the color to keep
      if (
        pixelR !== colorToKeep.r ||
        pixelG !== colorToKeep.g ||
        pixelB !== colorToKeep.b
      ) {
        // Set the pixel color to transparent (0, 0, 0, 0)
        newPixelData[offset] = 0;
        newPixelData[offset + 1] = 0;
        newPixelData[offset + 2] = 0;
        newPixelData[offset + 3] = 0;
      }
    }
  }

  // Create a new canvas
  const newCanvas = new canvas.Canvas(
    originalImage.width,
    originalImage.height
  );

  // Create a new canvas object from the buffer
  const newCtx = newCanvas.getContext("2d");
  const newImageData = newCtx.createImageData(
    originalImage.width,
    originalImage.height
  );
  newImageData.data.set(newPixelData);
  newCtx.putImageData(newImageData, 0, 0);

  const filename = "processed.png";
  newCanvas.createPNGStream().pipe(fs.createWriteStream(filename));

  return newCanvas.toBuffer();
}

function findFirstWhiteX(
  originalImage: PNG,
  options: ProcessingOptions = {}
): number {
  const {
    colorThreshold = 10, // Slight tolerance for pure white
  } = options;

  const isWhiteColor = (color: Color): boolean => {
    return (
      color.r >= 255 - colorThreshold &&
      color.g >= 255 - colorThreshold &&
      color.b >= 255 - colorThreshold
    );
  };

  // Iterate through x coordinates
  for (let x = 0; x < originalImage.width; x++) {
    let foundWhitePixel = false;

    for (let y = 0; y < originalImage.height; y++) {
      const offset = (y * originalImage.width + x) * 4;

      const pixelColor: Color = {
        r: originalImage.data[offset],
        g: originalImage.data[offset + 1],
        b: originalImage.data[offset + 2],
      };

      // If we find a white pixel, mark this x coordinate
      if (isWhiteColor(pixelColor)) {
        foundWhitePixel = true;
        break;
      }
    }

    // Return the first x coordinate with a white pixel
    if (foundWhitePixel) {
      return x;
    }
  }

  // If no white pixel found, return -1
  return -1;
}

function cropImage(originalImage: PNG, startX: number): Buffer {
  // Create a new canvas with cropped width
  const newWidth = originalImage.width - startX;
  const newCanvas = new canvas.Canvas(newWidth, originalImage.height);
  const newCtx = newCanvas.getContext("2d");

  // Create image data for the cropped image
  const newImageData = newCtx.createImageData(newWidth, originalImage.height);

  // Copy pixel data from the original image, starting from startX
  for (let y = 0; y < originalImage.height; y++) {
    for (let x = 0; x < newWidth; x++) {
      const oldOffset = (y * originalImage.width + (x + startX)) * 4;
      const newOffset = (y * newWidth + x) * 4;

      newImageData.data[newOffset] = originalImage.data[oldOffset];
      newImageData.data[newOffset + 1] = originalImage.data[oldOffset + 1];
      newImageData.data[newOffset + 2] = originalImage.data[oldOffset + 2];
      newImageData.data[newOffset + 3] = originalImage.data[oldOffset + 3];
    }
  }

  // Put the cropped image data on the canvas
  newCtx.putImageData(newImageData, 0, 0);

  return newCanvas.toBuffer();
}

function removeBackgroundColor(
  png: PNG,
  options: BackgroundRemovalOptions = {}
): PNG {
  const {
    targetColor = { r: 19, g: 18, b: 24 },
    tolerance = 10,
    debug = true,
  } = options;

  // Create a new PNG with the same dimensions
  const processedPng = new PNG({
    width: png.width,
    height: png.height,
  });

  // Allocate buffer with full transparency
  processedPng.data = Buffer.alloc(png.width * png.height * 4, 0);

  let transparentPixelCount = 0;
  let totalPixelCount = 0;

  // Pixel-by-pixel processing
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      const idx = (png.width * y + x) << 2;
      totalPixelCount++;

      const r = png.data[idx];
      const g = png.data[idx + 1];
      const b = png.data[idx + 2];
      const a = png.data[idx + 3] || 255;

      // Advanced color matching
      const isBackground =
        Math.abs(r - targetColor.r) <= tolerance &&
        Math.abs(g - targetColor.g) <= tolerance &&
        Math.abs(b - targetColor.b) <= tolerance;

      if (!isBackground && a > 0) {
        // Copy only non-background, non-transparent pixels
        processedPng.data[idx] = r;
        processedPng.data[idx + 1] = g;
        processedPng.data[idx + 2] = b;
        processedPng.data[idx + 3] = a;

        if (a > 0) {
          transparentPixelCount++;
        }
      }
      // If it's a background pixel, it remains transparent (alpha = 0)
    }
  }

  // Debug logging
  if (debug) {
    console.log("Background Removal Stats:");
    console.log(`Total Pixels: ${totalPixelCount}`);
    console.log(`Preserved Pixels: ${transparentPixelCount}`);
    console.log(
      `Percentage Preserved: ${(
        (transparentPixelCount / totalPixelCount) *
        100
      ).toFixed(2)}%`
    );
  }

  return processedPng;
}

function processImageWithLeftPadding(png: PNG, paddingWidth: number = 20): PNG {
  // Create a new PNG with added width
  const processedPng = new PNG({
    width: png.width + paddingWidth,
    height: png.height,
  });

  // Initialize the new image with fully transparent pixels
  processedPng.data = Buffer.alloc(
    (png.width + paddingWidth) * png.height * 4,
    0 // This ensures all pixels start fully transparent
  );

  // Copy original image data, starting from the padding width
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      const srcIdx = (png.width * y + x) << 2;
      const dstIdx = (y * (png.width + paddingWidth) + x + paddingWidth) << 2;

      // Only copy non-transparent pixels
      if (png.data[srcIdx + 3] > 0) {
        processedPng.data[dstIdx] = png.data[srcIdx]; // R
        processedPng.data[dstIdx + 1] = png.data[srcIdx + 1]; // G
        processedPng.data[dstIdx + 2] = png.data[srcIdx + 2]; // B
        processedPng.data[dstIdx + 3] = png.data[srcIdx + 3]; // Alpha
      }
    }
  }

  return processedPng;
}

// Utility function to parse PNG with Promise
function parsePNG(buffer: Buffer): Promise<PNG> {
  return new Promise((resolve, reject) => {
    const png = new PNG();
    png.parse(buffer, (err) => {
      err ? reject(err) : resolve(png);
    });
  });
}

function makeNonTransparentPixelsBlack(png: PNG): PNG {
  // Create a new PNG with the same dimensions
  const processedPng = new PNG({
    width: png.width,
    height: png.height,
  });

  // Allocate buffer with full transparency
  processedPng.data = Buffer.alloc(png.width * png.height * 4, 0);

  // Pixel-by-pixel processing
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      const idx = (png.width * y + x) << 2;

      const a = png.data[idx + 3]; // Alpha channel

      // If pixel is not fully transparent, make it black
      if (a > 0) {
        processedPng.data[idx] = 0; // R
        processedPng.data[idx + 1] = 0; // G
        processedPng.data[idx + 2] = 0; // B
        processedPng.data[idx + 3] = a; // Preserve original alpha
      }
    }
  }

  return processedPng;
}

function addPaddingAroundNonTransparentPixels(
  png: PNG,
  widthPadding: number = 30,
  heightPadding: number = 10
): PNG {
  // Find the bounds of non-transparent pixels
  let minX = png.width;
  let maxX = 0;
  let minY = png.height;
  let maxY = 0;

  // Find the bounding box of non-transparent pixels
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      const idx = (png.width * y + x) << 2;
      const a = png.data[idx + 3]; // Alpha channel

      if (a > 0) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
  }

  // Calculate new dimensions with padding
  const newWidth = maxX - minX + 1 + widthPadding * 2;
  const newHeight = maxY - minY + 1 + heightPadding * 2;

  // Create a new PNG with expanded dimensions
  const paddedPng = new PNG({
    width: newWidth,
    height: newHeight,
  });

  // Initialize the new PNG with fully transparent pixels
  paddedPng.data = Buffer.alloc(newWidth * newHeight * 4, 0);

  // Copy non-transparent pixels to the new position with padding
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const oldIdx = (png.width * y + x) << 2;
      const newX = x - minX + widthPadding;
      const newY = y - minY + heightPadding;
      const newIdx = (paddedPng.width * newY + newX) << 2;

      const a = png.data[oldIdx + 3];
      if (a > 0) {
        paddedPng.data[newIdx] = png.data[oldIdx]; // R
        paddedPng.data[newIdx + 1] = png.data[oldIdx + 1]; // G
        paddedPng.data[newIdx + 2] = png.data[oldIdx + 2]; // B
        paddedPng.data[newIdx + 3] = a; // Alpha
      }
    }
  }

  return paddedPng;
}

export async function parseAndProcessImage(
  buffer: Buffer,
  options: ProcessingOptions = {}
): Promise<Buffer> {
  // Parse original image
  const originalImage = await parsePNG(buffer);

  // Find first white x coordinate
  const startX = findFirstWhiteX(originalImage, options);
  if (startX === -1) {
    throw new Error("No white pixels found");
  }

  // Crop image
  const croppedImageBuffer = cropImage(originalImage, startX);

  // Optional: Save cropped image
  // fs.writeFileSync("cropped.png", croppedImageBuffer);

  // Convert and process
  const croppedImage = await parsePNG(croppedImageBuffer);

  // Remove background
  const imageWithoutBackground = removeBackgroundColor(croppedImage);

  // Optional: Save image without background
  // const outputBuffer = PNG.sync.write(imageWithoutBackground);
  // fs.writeFileSync("no-background.png", outputBuffer);

  // Add left padding
  const imageWithLeftPadding = processImageWithLeftPadding(
    imageWithoutBackground
  );

  const paddedImage =
    addPaddingAroundNonTransparentPixels(imageWithLeftPadding);

  return PNG.sync.write(paddedImage);
  // Optional: Save image with left padding
  // const paddingBuffer = PNG.sync.write(imageWithLeftPadding);
  // fs.writeFileSync("with-padding.png", paddingBuffer);

  // Process and return
  // return processImage(imageWithLeftPadding);
}
