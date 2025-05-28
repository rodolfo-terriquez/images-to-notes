import { Notice, Platform } from 'obsidian';
import { PluginSettings } from '../models/settings'; // Adjust path if needed

const NOTICE_TIMEOUT = 5000; // 5 seconds for standard notices
const ERROR_NOTICE_TIMEOUT = 10000; // 10 seconds for error notices
const MOBILE_NOTICE_TIMEOUT = 3000; // Shorter timeout for mobile devices
const MOBILE_ERROR_NOTICE_TIMEOUT = 7000; // Shorter error timeout for mobile devices

/**
 * Service for displaying Obsidian notices with mobile compatibility.
 */
export class NotificationService {
	private settings: PluginSettings; // Store settings
	private isMobileMode: boolean = false; // Track if mobile mode is enabled

	// Update constructor to accept settings
	constructor(settings: PluginSettings) {
		this.settings = settings;
		// Auto-detect mobile on initialization
		this.isMobileMode = Platform.isMobile;
	}
	
	/**
	 * Sets whether mobile mode is enabled for notifications.
	 * @param enabled Whether mobile mode is enabled
	 */
	setMobileMode(enabled: boolean): void {
		this.isMobileMode = enabled;
		console.log(`NotificationService: Mobile mode ${enabled ? 'enabled' : 'disabled'}`);
	}

	/**
	 * Displays an informational notice.
	 * @param message The message to display.
	 */
	notifyInfo(message: string): void {
		const timeout = this.isMobileMode ? MOBILE_NOTICE_TIMEOUT : NOTICE_TIMEOUT;
		new Notice(this.formatMessage(message), timeout);
	}

	/**
	 * Displays a success notice.
	 * @param message The message to display.
	 */
	notifySuccess(message: string): void {
		// Obsidian's Notice doesn't have built-in types like 'success',
		// but we can prepend or style if needed later.
		const timeout = this.isMobileMode ? MOBILE_NOTICE_TIMEOUT : NOTICE_TIMEOUT;
		new Notice(`✅ ${this.formatMessage(message)}`, timeout);
	}

	/**
	 * Displays an error notice.
	 * @param message The error message to display.
	 */
	notifyError(message: string): void {
		// Use a longer timeout for errors
		const timeout = this.isMobileMode ? MOBILE_ERROR_NOTICE_TIMEOUT : ERROR_NOTICE_TIMEOUT;
		new Notice(`❌ ${this.formatMessage(`Error: ${message}`)}`, timeout);
	}

	/**
	 * Displays a verbose notification - only shows if setting is true.
	 * @param message The message to display.
	 * @param timeout Optional custom timeout.
	 */
	notifyVerbose(message: string, timeout?: number): void {
		if (this.settings.verboseNotifications) {
			const actualTimeout = timeout || (this.isMobileMode ? MOBILE_NOTICE_TIMEOUT : NOTICE_TIMEOUT);
			new Notice(this.formatMessage(message), actualTimeout);
		}
	}
	
	/**
	 * Formats a message based on device type.
	 * Makes messages more concise on mobile devices.
	 * @param message The message to format.
	 * @returns The formatted message.
	 */
	private formatMessage(message: string): string {
		if (!this.isMobileMode) {
			return message; // Return original message on desktop
		}
		
		// On mobile, make messages more concise
		// Truncate long messages
		const maxLength = 100;
		if (message.length > maxLength) {
			return message.substring(0, maxLength - 3) + '...';
		}
		
		return message;
	}
} 