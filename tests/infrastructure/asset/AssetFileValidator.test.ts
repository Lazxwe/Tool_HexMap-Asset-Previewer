import { describe, it, expect } from "vitest";
import {
  validateAssetFile,
  validateAssetFiles,
} from "../../../src/infrastructure/asset/AssetFileValidator";

describe("AssetFileValidator", () => {
  const createMockFile = (name: string, size: number, type: string = "image/png"): File => {
    return {
      name,
      size,
      type,
    } as unknown as File;
  };

  it("should accept a valid PNG file with image/png MIME type", () => {
    const file = createMockFile("tree_01.png", 1024, "image/png");
    const result = validateAssetFile(file);
    expect(result.name).toBe("tree_01.png");
    expect(result.size).toBe(1024);
  });

  it("should accept a valid PNG file with .png extension even if MIME type is empty", () => {
    const file = createMockFile("rock_02.PNG", 2048, "");
    const result = validateAssetFile(file);
    expect(result.name).toBe("rock_02.PNG");
  });

  it("should reject non-PNG files (jpg, webp, txt, json)", () => {
    expect(() => validateAssetFile(createMockFile("stamp.jpg", 1024, "image/jpeg"))).toThrow(
      "Invalid asset file: Only PNG files are supported. Received 'stamp.jpg'."
    );

    expect(() => validateAssetFile(createMockFile("stamp.webp", 1024, "image/webp"))).toThrow(
      "Invalid asset file: Only PNG files are supported. Received 'stamp.webp'."
    );

    expect(() => validateAssetFile(createMockFile("notes.txt", 100, "text/plain"))).toThrow(
      "Invalid asset file: Only PNG files are supported. Received 'notes.txt'."
    );

    expect(() => validateAssetFile(createMockFile("map.json", 500, "application/json"))).toThrow(
      "Invalid asset file: Only PNG files are supported. Received 'map.json'."
    );
  });

  it("should reject empty files with size 0", () => {
    const file = createMockFile("empty.png", 0, "image/png");
    expect(() => validateAssetFile(file)).toThrow(
      "Invalid asset file: 'empty.png' is empty (0 bytes)."
    );
  });

  it("should validate an array of valid files", () => {
    const files = [
      createMockFile("tree_1.png", 500),
      createMockFile("tree_2.png", 600),
    ];
    const validated = validateAssetFiles(files);
    expect(validated.length).toBe(2);
  });

  it("should reject if any file in the collection is invalid", () => {
    const files = [
      createMockFile("tree_1.png", 500),
      createMockFile("bad.jpg", 600, "image/jpeg"),
    ];
    expect(() => validateAssetFiles(files)).toThrow(
      "Invalid asset file: Only PNG files are supported. Received 'bad.jpg'."
    );
  });

  it("should reject empty file collections", () => {
    expect(() => validateAssetFiles([])).toThrow("No asset files selected.");
  });
});
