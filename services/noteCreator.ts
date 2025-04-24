import { App, TFile, normalizePath, FileSystemAdapter } from 'obsidian';
import { PluginSettings } from '../models/settings';
import { NotificationService } from '../ui/notificationService';
import { getParentFolderPath, sanitizeFilename, getFormattedDate } from '../utils/fileUtils';

export class NoteCreator {
    constructor(
        private settings: PluginSettings,
        private notificationService: NotificationService,
        private app: App
    ) {}

    /**
     * Creates a new markdown note containing the transcription and a link to the original image.
     * @param transcription The transcribed text.
     * @param originalImageFile The original image file.
     * @returns A promise that resolves with the created TFile or null if creation failed.
     */
    async createNote(transcription: string, originalImageFile: TFile): Promise<TFile | null> {
        try {
            const title = this._generateNoteTitle(transcription, originalImageFile);
            const folderPath = this._getTargetFolderPath(originalImageFile);
            const uniqueNotePath = await this._findUniqueNotePath(folderPath, title);

            // Generate markdown link relative to the vault root
            const imageLink = this.app.fileManager.generateMarkdownLink(originalImageFile, '/'); 
            const noteContent = `${transcription.trim()}\n\n${imageLink}`;

            const newNoteFile = await this.app.vault.create(uniqueNotePath, noteContent);
            this.notificationService.notifySuccess(`Note created: ${newNoteFile.basename}`);
            return newNoteFile;

        } catch (error) {
            this.notificationService.notifyError('Failed to create note.');
            console.error('Note creation error:', error);
            return null;
        }
    }

    /**
     * Generates a title for the new note based on plugin settings.
     */
    private _generateNoteTitle(transcription: string, originalImageFile: TFile): string {
        let title = '';

        if (this.settings.useFirstLineAsTitle) {
            const firstLine = transcription.trim().split('\n')[0];
            if (firstLine) {
                title = sanitizeFilename(firstLine);
            } else {
                // Fallback if transcription is empty or just whitespace
                title = `Transcription for ${originalImageFile.basename}`;
            }
        } else {
            const parentFolder = getParentFolderPath(originalImageFile.path);
            // Use basename for folder part if in root
            const folderName = parentFolder === '/' ? 'Root' : parentFolder.split('/').pop() || 'Folder'; 
            const date = getFormattedDate();
            const sanitizedImageName = sanitizeFilename(originalImageFile.basename);
            title = `${folderName}_${date}_${sanitizedImageName}`;
        }
        
        // Ensure title isn't overly long (optional)
        const MAX_TITLE_LENGTH = 100;
        return title.substring(0, MAX_TITLE_LENGTH);
    }

    /**
     * Gets the target folder path for the new note (same as the image's folder).
     */
    private _getTargetFolderPath(originalImageFile: TFile): string {
        return getParentFolderPath(originalImageFile.path);
    }

    /**
     * Finds a unique path for the note by appending numbers if necessary.
     */
    private async _findUniqueNotePath(folderPath: string, title: string): Promise<string> {
        let counter = 0;
        let uniquePath = normalizePath(`${folderPath}/${title}.md`);

        while (await this.app.vault.adapter.exists(uniquePath)) {
            counter++;
            uniquePath = normalizePath(`${folderPath}/${title}_${counter}.md`);
        }
        return uniquePath;
    }
} 