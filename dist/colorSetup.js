import { PNG } from "pngjs";
import * as canvas from "canvas";
import * as fs from "fs";
const colorToKeep = { r: 191, g: 189, b: 199 }; // #bfbdc7
function processImage(originalImage) {
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
            if (pixelR !== colorToKeep.r ||
                pixelG !== colorToKeep.g ||
                pixelB !== colorToKeep.b) {
                // Set the pixel color to transparent (0, 0, 0, 0)
                newPixelData[offset] = 0;
                newPixelData[offset + 1] = 0;
                newPixelData[offset + 2] = 0;
                newPixelData[offset + 3] = 0;
            }
        }
    }
    // Create a new canvas
    const newCanvas = new canvas.Canvas(originalImage.width, originalImage.height);
    // Create a new canvas object from the buffer
    const newCtx = newCanvas.getContext("2d");
    const newImageData = newCtx.createImageData(originalImage.width, originalImage.height);
    newImageData.data.set(newPixelData);
    newCtx.putImageData(newImageData, 0, 0);
    const filename = "processed.png";
    newCanvas.createPNGStream().pipe(fs.createWriteStream(filename));
    return newCanvas.toBuffer();
}
export function parseAndProcessImage(buffer) {
    return new Promise((resolve, reject) => {
        const originalImage = new PNG();
        originalImage.parse(buffer, (err) => {
            if (err) {
                reject(err);
                return;
            }
            const processedBuffer = processImage(originalImage);
            resolve(processedBuffer);
        });
    });
}
