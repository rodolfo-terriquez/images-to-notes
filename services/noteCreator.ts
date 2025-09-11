import { App, TFile, normalizePath, FileSystemAdapter } from 'obsidian';
import { PluginSettings, NoteNamingOption, TranscriptionPlacement } from '../models/settings';
import { NotificationService } from '../ui/notificationService';
import { getParentFolderPath, sanitizeFilename, getFormattedDate } from '../utils/fileUtils';

// Helper function to remove markdown headings and links from the start of a string
function stripMarkdown(text: string): string {
    // Remove leading # style headings (e.g., # heading, ## heading)
    let cleaned = text.replace(/^[#]+\s+/, '');
    // Remove markdown links (e.g., [link text](url))
    // This is a basic version, might need refinement for complex cases
    cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
    // Add more replacements here if needed (e.g., bold, italics)
    return cleaned.trim(); 
}

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

            let noteContent = transcription.trim();
            if (this.settings.includeImageInNote) {
                const imageLink = this.app.fileManager.generateMarkdownLink(imageFile, '/');
                if (this.settings.transcriptionPlacement === TranscriptionPlacement.AboveImage) {
                    noteContent = `${transcription.trim()}\n\n${imageLink}`;
                } else { // BelowImage
                    noteContent = `${imageLink}\n\n${transcription.trim()}`;
                }
            } else {
                noteContent = transcription.trim();
            }

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
        let titleBase = '';
        const date = getFormattedDate();
        const sanitizedImageName = sanitizeFilename(imageFile.basename);

        switch (this.settings.noteNamingOption) {
            case NoteNamingOption.FirstLine:
                const firstLine = transcription.trim().split('\n')[0];
                if (firstLine) {
                    // Strip markdown before sanitizing
                    titleBase = sanitizeFilename(stripMarkdown(firstLine));
                } else {
                    // Fallback if transcription is empty or just whitespace
                    titleBase = `Transcription for ${sanitizedImageName}`;
                }
                break;

            case NoteNamingOption.ImageName:
                titleBase = sanitizedImageName;
                break;

            case NoteNamingOption.DateImageName:
                titleBase = `${date}_${sanitizedImageName}`;
                break;

            case NoteNamingOption.FolderDateNum: // Keep this option as is for now
            default:
                // Use the original parent path logic
                const parentFolder = getParentFolderPath(imageFile.path);
                const folderName = parentFolder === '/' ? 'Root' : parentFolder.split('/').pop() || 'Folder';
                titleBase = `${folderName}_${date}_${sanitizedImageName}`;
                break;
        }

        // Ensure title isn't overly long (optional)
        const MAX_TITLE_LENGTH = 100;
        return titleBase.substring(0, MAX_TITLE_LENGTH);
    }

    /**
     * Finds a unique path for the note by appending numbers if necessary.
     */
    private async _findUniqueNotePath(folderPath: string, title: string): Promise<string> {
        let counter = 0;
        // Ensure title is not empty before creating path
        const validTitle = title || 'Untitled Note'; 
        let uniquePath = normalizePath(`${folderPath}/${validTitle}.md`);

        while (await this.app.vault.adapter.exists(uniquePath)) {
            counter++;
            uniquePath = normalizePath(`${folderPath}/${validTitle}_${counter}.md`);
        }
        return uniquePath;
    }
} 