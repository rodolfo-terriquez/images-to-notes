import { Notice } from 'obsidian';

const NOTICE_TIMEOUT = 5000; // 5 seconds for standard notices
const ERROR_NOTICE_TIMEOUT = 10000; // 10 seconds for error notices

/**
 * Simple service for displaying Obsidian notices.
 */
export class NotificationService {
    /**
     * Displays an informational notice.
     * @param message The message to display.
     */
    notifyInfo(message: string): void {
        new Notice(message, NOTICE_TIMEOUT);
    }

    /**
     * Displays a success notice.
     * @param message The message to display.
     */
    notifySuccess(message: string): void {
        // Obsidian's Notice doesn't have built-in types like 'success',
        // but we can prepend or style if needed later.
        // For now, just use a standard notice.
        new Notice(`✅ ${message}`, NOTICE_TIMEOUT);
    }

    /**
     * Displays an error notice.
     * @param message The error message to display.
     */
    notifyError(message: string): void {
        // Use a longer timeout for errors
        new Notice(`❌ Error: ${message}`, ERROR_NOTICE_TIMEOUT);
    }
} 