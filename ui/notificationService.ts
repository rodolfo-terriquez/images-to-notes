import { Notice, Platform } from 'obsidian';
import { PluginSettings } from '../models/settings';

const NOTICE_TIMEOUT = 5000;
const ERROR_NOTICE_TIMEOUT = 10000;
const MOBILE_NOTICE_TIMEOUT = 3000;
const MOBILE_ERROR_NOTICE_TIMEOUT = 7000;

export class NotificationService {
	private settings: PluginSettings;
	private isMobileMode: boolean = false;

	constructor(settings: PluginSettings) {
		this.settings = settings;
		this.isMobileMode = Platform.isMobile;
	}
	
	setMobileMode(enabled: boolean): void {
		this.isMobileMode = enabled;
	}

	notifyInfo(message: string): void {
		const timeout = this.isMobileMode ? MOBILE_NOTICE_TIMEOUT : NOTICE_TIMEOUT;
		new Notice(this.formatMessage(message), timeout);
	}

	notifySuccess(message: string): void {
		const timeout = this.isMobileMode ? MOBILE_NOTICE_TIMEOUT : NOTICE_TIMEOUT;
		new Notice(`✅ ${this.formatMessage(message)}`, timeout);
	}

	notifyError(message: string): void {
		const timeout = this.isMobileMode ? MOBILE_ERROR_NOTICE_TIMEOUT : ERROR_NOTICE_TIMEOUT;
		new Notice(`❌ ${this.formatMessage(`Error: ${message}`)}`, timeout);
	}

	notifyVerbose(message: string, timeout?: number): void {
		if (this.settings.verboseNotifications) {
			const actualTimeout = timeout || (this.isMobileMode ? MOBILE_NOTICE_TIMEOUT : NOTICE_TIMEOUT);
			new Notice(this.formatMessage(message), actualTimeout);
		}
	}
	
	private formatMessage(message: string): string {
		if (!this.isMobileMode) {
			return message;
		}
		
		const maxLength = 100;
		if (message.length > maxLength) {
			return message.substring(0, maxLength - 3) + '...';
		}
		
		return message;
	}
}
