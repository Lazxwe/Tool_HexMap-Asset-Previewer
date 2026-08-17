import { ImageDecoder, RenderableImage } from "./AssetTypes";

/**
 * BrowserImageDecoder
 * Standard browser implementation of ImageDecoder using HTMLImageElement and createImageBitmap.
 */
export class BrowserImageDecoder implements ImageDecoder {
  /**
   * Decodes an image from a URL or object URL.
   */
  public async decodeFromUrl(url: string): Promise<RenderableImage> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";

      img.onload = () => {
        resolve({
          width: img.naturalWidth || img.width,
          height: img.naturalHeight || img.height,
          nativeSource: img,
        });
      };

      img.onerror = (err) => {
        reject(new Error(`Failed to load and decode image from URL '${url}': ${String(err)}`));
      };

      img.src = url;
    });
  }

  /**
   * Decodes an image from a Blob using the high-performance createImageBitmap API if available.
   */
  public async decodeFromBlob(blob: Blob): Promise<RenderableImage> {
    if (typeof createImageBitmap === "function") {
      const bitmap = await createImageBitmap(blob);
      return {
        width: bitmap.width,
        height: bitmap.height,
        nativeSource: bitmap,
      };
    }

    // Fallback via Object URL and Image element
    const objectUrl = URL.createObjectURL(blob);
    try {
      const image = await this.decodeFromUrl(objectUrl);
      return image;
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }
}
