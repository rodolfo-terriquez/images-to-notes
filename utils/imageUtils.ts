import { App, TFile, normalizePath } from 'obsidian';
// @ts-ignore - heic2any doesn't have readily available types
import heic2any from 'heic2any';
import imageCompression, { type Options as ImageCompressionOptions } from 'browser-image-compression';
import { getParentFolderPath } from './fileUtils';
import { NotificationService } from '../ui/notificationService';

export async function convertHeicToJpg(
    heicFile: TFile,
    app: App,
    notificationService: NotificationService
): Promise<TFile | null> {
    if (heicFile.extension.toLowerCase() !== 'heic') {
        notificationService.notifyError(`Conversion failed: ${heicFile.name} is not a HEIC file.`);
        return null;
    }

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

        const existingFile = app.vault.getAbstractFileByPath(newFilePath);
        if (existingFile instanceof TFile) {
            notificationService.notifyError(`Conversion skipped: ${newFileName} already exists.`);
            return null;
        }

        const newFile = await app.vault.createBinary(newFilePath, jpgArrayBuffer);
        notificationService.notifyVerbose(`Converted ${heicFile.name} to ${newFile.name}`);
        return newFile;

    } catch {
        notificationService.notifyError(`Failed to convert HEIC file: ${heicFile.name}.`);
        return null;
    }
}

export async function compressImage(
    imageFile: TFile,
    app: App,
    notificationService: NotificationService,
    options: ImageCompressionOptions = {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
    }
): Promise<TFile | null> {
    const compressibleExtensions = ['jpg', 'jpeg', 'png'];
    if (!compressibleExtensions.includes(imageFile.extension.toLowerCase())) {
        return imageFile;
    }

    try {
        const arrayBuffer = await app.vault.readBinary(imageFile);
        const blob = new Blob([arrayBuffer], { type: `image/${imageFile.extension}` });
        const file = new File([blob], imageFile.name, { type: blob.type });

        const compressedFile = await imageCompression(file, options);

        if (compressedFile.size < file.size) {
            const compressedBuffer = await compressedFile.arrayBuffer();
            await app.vault.modifyBinary(imageFile, compressedBuffer);
        }
        return imageFile;

    } catch {
        notificationService.notifyError(`Failed to compress image: ${imageFile.name}.`);
        return imageFile;
    }
}
