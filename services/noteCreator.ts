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
     * Creates a new markdown note containing the transcription and a link to the image.
     * @param transcription The transcribed text.
     * @param imageFile The final TFile object for the processed image (used for linking and naming).
     * @param noteTargetParentPath The target folder path for the new note.
     * @returns A promise that resolves with the created TFile or null if creation failed.
     */
    async createNote(transcription: string, imageFile: TFile, noteTargetParentPath: string): Promise<TFile | null> {
        try {
            const title = this._generateNoteTitle(transcription, imageFile);
            const folderPath = noteTargetParentPath;
            const uniqueNotePath = await this._findUniqueNotePath(folderPath, title);

            // Generate markdown link relative to the vault root
            const imageLink = this.app.fileManager.generateMarkdownLink(imageFile, '/'); 
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
     * Uses the final image file for naming context.
     */
    private _generateNoteTitle(transcription: string, imageFile: TFile): string {
        let title = '';

        if (this.settings.useFirstLineAsTitle) {
            const firstLine = transcription.trim().split('\n')[0];
            if (firstLine) {
                title = sanitizeFilename(firstLine);
            } else {
                // Fallback if transcription is empty or just whitespace
                title = `Transcription for ${imageFile.basename}`;
            }
        } else {
            // Use the original parent path logic for folder name if available in settings (or job? - simpler to keep using imageFile path for now)
            // Let's keep using the moved image's parent folder for title generation for now
            // as the user might expect the title to reflect the final image location
            // const parentFolder = getParentFolderPath(imageFile.path); // This would use the '/Images' subfolder
            // OR use job.originalParentPath? Needs consideration if setting is added
            const parentFolder = getParentFolderPath(imageFile.path); // Keep using image's current folder for title part
            const folderName = parentFolder === '/' ? 'Root' : parentFolder.split('/').pop() || 'Folder'; 
            const date = getFormattedDate();
            const sanitizedImageName = sanitizeFilename(imageFile.basename);
            title = `${folderName}_${date}_${sanitizedImageName}`;
        }
        
        // Ensure title isn't overly long (optional)
        const MAX_TITLE_LENGTH = 100;
        return title.substring(0, MAX_TITLE_LENGTH);
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