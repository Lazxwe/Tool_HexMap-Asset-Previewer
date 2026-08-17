/**
 * AssetFileValidator
 * Infrastructure validator that verifies files imported by the artist via File Picker or Drag & Drop.
 * Shared across all file input mechanisms to guarantee consistent validation contracts.
 */
export function validateAssetFile(file: File): { name: string; size: number } {
  if (!file || typeof file.name !== "string") {
    throw new Error("Invalid asset file: Expected a valid File object.");
  }

  const name = file.name.trim();
  if (name.length === 0) {
    throw new Error("Invalid asset file: File name cannot be empty.");
  }

  // 1. Empty file validation
  if (file.size === 0) {
    throw new Error(`Invalid asset file: '${name}' is empty (0 bytes).`);
  }

  // 2. MIME type & extension validation (Must be PNG)
  const isPngMime = file.type === "image/png";
  const isPngExt = /\.png$/i.test(name);

  if (!isPngMime && !isPngExt) {
    throw new Error(`Invalid asset file: Only PNG files are supported. Received '${name}'.`);
  }

  return {
    name,
    size: file.size,
  };
}

/**
 * Validates a collection of files, ensuring at least one valid file is present and all files pass validation.
 */
export function validateAssetFiles(files: FileList | File[]): File[] {
  const fileArray = Array.from(files);

  if (fileArray.length === 0) {
    throw new Error("No asset files selected.");
  }

  for (const file of fileArray) {
    validateAssetFile(file);
  }

  return fileArray;
}
