import { TAbstractFile, TFile, App, normalizePath } from 'obsidian';

/**
 * Checks if a file is a supported image type (JPG, JPEG, PNG).
 * @param file The file to check.
 * @returns True if the file is a supported image, false otherwise.
 */
export function isImageFile(file: TAbstractFile): file is TFile {
    if (!(file instanceof TFile)) {
        return false;
    }
    const supportedExtensions = ['jpg', 'jpeg', 'png', 'heic'];
    return supportedExtensions.includes(file.extension.toLowerCase());
}

/**
 * Gets the parent folder path from a full file path.
 * @param filePath The full path of the file.
 * @returns The path of the parent folder.
 */
export function getParentFolderPath(filePath: string): string {
    const lastSeparatorIndex = filePath.lastIndexOf('/');
    if (lastSeparatorIndex === -1) {
        // If no separator, it might be in the root or an invalid path
        return '/'; // Or handle as an error/edge case
    }
    return filePath.substring(0, lastSeparatorIndex);
}

/**
 * Sanitizes a string to be used as a valid filename, removing forbidden characters.
 * @param name The original string.
 * @returns A sanitized filename string.
 */
export function sanitizeFilename(name: string): string {
    // Remove characters forbidden in filenames across different OS
    // Adjust the regex as needed for more specific sanitization
    return name.replace(/[<>:"/\\|?*]/g, '').replace(/[\n\r]/g, ' ').trim();
}

/**
 * Gets the current date formatted as YYYYMMDD.
 * @returns The formatted date string.
 */
export function getFormattedDate(): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0'); // Months are 0-indexed
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}${month}${day}`;
}

/**
 * Encodes the content of an image file to a base64 string.
 * @param file The image file (TFile).
 * @param app The Obsidian App instance.
 * @returns A promise that resolves with the base64 encoded string.
 * @throws Will throw an error if reading the file fails.
 */
function _arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

/**
 * Detect the actual MIME type of an image from its magic bytes.
 * Falls back to the file extension if the format is not recognized.
 */
function _detectMimeType(buffer: ArrayBuffer, fileExtension: string): string {
    const bytes = new Uint8Array(buffer.slice(0, 12));

    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47
        && bytes[4] === 0x0D && bytes[5] === 0x0A && bytes[6] === 0x1A && bytes[7] === 0x0A) {
        return "image/png";
    }
    // JPEG: FF D8 FF
    if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
        return "image/jpeg";
    }

    // Fallback to file extension
    const ext = fileExtension.toLowerCase();
    return `image/${ext === "jpg" ? "jpeg" : ext}`;
}

export async function encodeImageToBase64(file: TFile, app: App): Promise<string> {
    try {
        const arrayBuffer = await app.vault.readBinary(file);
        const base64 = _arrayBufferToBase64(arrayBuffer);
        // Detect the actual image format from magic bytes, falling back to file extension
        const mimeType = _detectMimeType(arrayBuffer, file.extension);
        return `data:${mimeType};base64,${base64}`;
    } catch (error) {
        console.error(`Error encoding image ${file.path} to base64:`, error);
        throw new Error(`Failed to read and encode image: ${file.name}`);
    }
} 