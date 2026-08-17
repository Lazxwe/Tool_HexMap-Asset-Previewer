import { ImageDecoder, RenderableImage } from "../../../src/infrastructure/asset/AssetTypes";

export class MockImageDecoder implements ImageDecoder {
  public decodeCount: number = 0;
  public mockWidth: number = 256;
  public mockHeight: number = 256;
  public shouldFail: boolean = false;
  public failureMessage: string = "Mock decode failure";

  public async decodeFromUrl(url: string): Promise<RenderableImage> {
    this.decodeCount++;

    if (this.shouldFail) {
      throw new Error(`${this.failureMessage}: ${url}`);
    }

    const dummyCanvasSource = {
      width: this.mockWidth,
      height: this.mockHeight,
    } as unknown as CanvasImageSource;

    return {
      width: this.mockWidth,
      height: this.mockHeight,
      nativeSource: dummyCanvasSource,
    };
  }
}
