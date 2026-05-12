import { TAbstractFile, TFile, App } from 'obsidian';

export function isImageFile(file: TAbstractFile): file is TFile {
    if (!(file instanceof TFile)) {
        return false;
    }
    const supportedExtensions = ['jpg', 'jpeg', 'png', 'heic'];
    return supportedExtensions.includes(file.extension.toLowerCase());
}

export function getParentFolderPath(filePath: string): string {
    const lastSeparatorIndex = filePath.lastIndexOf('/');
    if (lastSeparatorIndex === -1) {
        return '/';
    }
    return filePath.substring(0, lastSeparatorIndex);
}

export function sanitizeFilename(name: string): string {
    return name.replace(/[<>:"/\\|?*]/g, '').replace(/[\n\r]/g, ' ').trim();
}

export function getFormattedDate(): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}${month}${day}`;
}

function _arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

function _detectMimeType(buffer: ArrayBuffer, fileExtension: string): string {
    const bytes = new Uint8Array(buffer.slice(0, 12));

    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47
        && bytes[4] === 0x0D && bytes[5] === 0x0A && bytes[6] === 0x1A && bytes[7] === 0x0A) {
        return "image/png";
    }
    if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
        return "image/jpeg";
    }

    const ext = fileExtension.toLowerCase();
    return `image/${ext === "jpg" ? "jpeg" : ext}`;
}

export async function encodeImageToBase64(file: TFile, app: App): Promise<string> {
    try {
        const arrayBuffer = await app.vault.readBinary(file);
        const base64 = _arrayBufferToBase64(arrayBuffer);
        const mimeType = _detectMimeType(arrayBuffer, file.extension);
        return `data:${mimeType};base64,${base64}`;
    } catch {
        throw new Error(`Failed to read and encode image: ${file.name}`);
    }
}
