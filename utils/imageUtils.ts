import { App, TFile, normalizePath } from 'obsidian';
// @ts-ignore - heic2any doesn't have readily available types
import heic2any from 'heic2any';
import imageCompression from 'browser-image-compression';
import { getParentFolderPath } from './fileUtils';
import { NotificationService } from '../ui/notificationService';

/**
 * Converts a HEIC file to JPG format using the heic2any library.
 * Creates a new JPG file in the same vault folder.
 *
 * @param heicFile The HEIC file (TFile) to convert.
 * @param app The Obsidian App instance.
 * @param notificationService Service for displaying notifications.
 * @returns A promise that resolves with the TFile object for the new JPG file, or null if conversion fails.
 */
export async function convertHeicToJpg(
    heicFile: TFile, 
    app: App, 
    notificationService: NotificationService
): Promise<TFile | null> {
    console.log(`Attempting to convert HEIC file: ${heicFile.path}`);
    try {
        const arrayBuffer = await app.vault.readBinary(heicFile);
        const blob = new Blob([arrayBuffer], { type: 'image/heic' });

        const conversionResult: Blob | Blob[] = await heic2any({
            blob,
            toType: 'image/jpeg',
            quality: 0.9,
        });

        const jpgBlob = Array.isArray(conversionResult) ? conversionResult[0] : conversionResult;

        if (!jpgBlob) {
            throw new Error('HEIC conversion resulted in an empty blob.');
        }

        const jpgArrayBuffer = await jpgBlob.arrayBuffer();
        const parentPath = getParentFolderPath(heicFile.path);
        const newFileName = `${heicFile.basename}.jpg`;
        const newFilePath = normalizePath(`${parentPath}/${newFileName}`);

        console.log(`Creating new JPG file at: ${newFilePath}`);

        const existingFile = app.vault.getAbstractFileByPath(newFilePath);
        if (existingFile && existingFile instanceof TFile) {
            console.warn(`JPG file already exists: ${newFilePath}. Overwriting.`);
        }

        const newFile = await app.vault.createBinary(newFilePath, jpgArrayBuffer);
        notificationService.notifyVerbose(`Converted ${heicFile.name} to ${newFile.name}`);
        console.log(`Successfully converted HEIC to JPG: ${newFile.path}`);
        return newFile;

    } catch (error) {
        console.error(`Error converting HEIC file ${heicFile.path}:`, error);
        notificationService.notifyError(`Failed to convert HEIC file: ${heicFile.name}. See console for details.`);
        return null;
    }
}

/**
 * Compresses an image file (JPG, PNG) in place using browser-image-compression.
 *
 * @param imageFile The image file (TFile) to compress.
 * @param app The Obsidian App instance.
 * @param notificationService Service for displaying notifications.
 * @param options Optional compression options (e.g., maxSizeMB, maxWidthOrHeight).
 * @returns A promise that resolves with the TFile object (now compressed), or the original TFile if compression fails or isn't significant.
 */
export async function compressImage(
    imageFile: TFile,
    app: App,
    notificationService: NotificationService,
    options: any = { // Use 'any' for options type for now
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
    }
): Promise<TFile | null> {
    const compressibleExtensions = ['jpg', 'jpeg', 'png'];
    if (!compressibleExtensions.includes(imageFile.extension.toLowerCase())) {
        console.log(`Skipping compression for non-compressible file type: ${imageFile.path}`);
        return imageFile;
    }

    console.log(`Attempting to compress image: ${imageFile.path}`);
    try {
        const arrayBuffer = await app.vault.readBinary(imageFile);
        const blob = new Blob([arrayBuffer], { type: `image/${imageFile.extension === 'jpg' ? 'jpeg' : imageFile.extension}` });
        const file = new File([blob], imageFile.name, { type: blob.type });

        console.log(`Original file size: ${(file.size / 1024 / 1024).toFixed(2)} MB`);

        const compressedFile = await imageCompression(file, options);

        console.log(`Compressed file size: ${(compressedFile.size / 1024 / 1024).toFixed(2)} MB`);

        if (compressedFile.size < file.size * 0.95) {
            const compressedArrayBuffer = await compressedFile.arrayBuffer();
            await app.vault.modifyBinary(imageFile, compressedArrayBuffer);
            notificationService.notifyVerbose(`Compressed ${imageFile.name}`);
            console.log(`Successfully compressed image and updated file: ${imageFile.path}`);
        } else {
            console.log(`Compression did not significantly reduce file size. Skipping overwrite for: ${imageFile.path}`);
            notificationService.notifyVerbose(`Compression skipped for ${imageFile.name} (no significant size reduction)`);
        }

        return imageFile;

    } catch (error) {
        console.error(`Error compressing image ${imageFile.path}:`, error);
        notificationService.notifyError(`Failed to compress image: ${imageFile.name}. See console for details.`);
        return imageFile;
    }
}