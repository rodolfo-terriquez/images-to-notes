import { Plugin, TAbstractFile, TFile } from 'obsidian';
import { PluginSettings, DEFAULT_SETTINGS } from 'models/settings';
import { TranscriptionSettingTab } from 'ui/settingsTab';
import { TranscriptionQueue } from './services/transcriptionQueue';
import { isImageFile } from './utils/fileUtils';
import { NotificationService } from './ui/notificationService';
import { AIService } from './services/aiService';
import { NoteCreator } from './services/noteCreator';
import { TranscriptionJob } from './models/transcriptionJob';

export default class ImageTranscriberPlugin extends Plugin {
	settings: PluginSettings;
	transcriptionQueue: TranscriptionQueue;
	notificationService: NotificationService;
	aiService: AIService;
	noteCreator: NoteCreator;

	async onload() {
		console.log('Loading Image Transcriber Plugin');
		await this.loadSettings();

		this.notificationService = new NotificationService();
		this.aiService = new AIService(this.settings, this.notificationService, this.app);
		this.noteCreator = new NoteCreator(this.settings, this.notificationService, this.app);
		this.transcriptionQueue = new TranscriptionQueue();

		// Set the actual processing callback for the queue
		this.transcriptionQueue.setProcessCallback(this.processTranscriptionJob.bind(this));

		this.addSettingTab(new TranscriptionSettingTab(this.app, this));

		this.registerEvent(
			this.app.vault.on('create', this.handleFileCreate.bind(this))
		);

		console.log('Image Transcriber Plugin loaded and file watcher active.');
	}

	onunload() {
		console.log('Unloading Image Transcriber Plugin');
		// Cleanup logic: The registerEvent method handles unregistering the vault event.
		// Queue processing might need explicit stopping if it involves long operations.
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	private handleFileCreate(file: TAbstractFile) {
		if (isImageFile(file)) {
			console.log(`Detected image creation: ${file.path}`);
			this.transcriptionQueue.addToQueue(file);
		} else if (file instanceof TFile) {
			// console.log(`Ignoring non-image file creation: ${file.path}`);
		} else {
			// console.log(`Ignoring folder creation: ${file.path}`);
		}
	}

	/**
	 * Processes a single transcription job.
	 * This method is passed as a callback to the TranscriptionQueue.
	 * @param job The transcription job to process.
	 */
	private async processTranscriptionJob(job: TranscriptionJob): Promise<void> {
		this.notificationService.notifyInfo(`Starting transcription for ${job.file.name}...`);

		try {
			const transcription = await this.aiService.transcribeImage(job);

			if (transcription !== null) {
				this.notificationService.notifyInfo(`Transcription received for ${job.file.name}. Creating note...`);
				const noteFile = await this.noteCreator.createNote(transcription, job.file);

				if (noteFile) {
					// Success! (Notification is handled by NoteCreator)
					this.transcriptionQueue.markAsDone(job); // Mark job as done in the queue
				} else {
					// Note creation failed (Notification handled by NoteCreator)
					this.transcriptionQueue.markAsError(job, 'Note creation failed');
				}
			} else {
				// Transcription failed (Notification handled by AIService)
				this.transcriptionQueue.markAsError(job, 'Transcription failed');
			}
		} catch (error) {
			console.error(`Unhandled error during transcription job processing for ${job.file.path}:`, error);
			this.notificationService.notifyError(`Unexpected error processing ${job.file.name}.`);
			this.transcriptionQueue.markAsError(job, 'Unexpected processing error');
		}
	}
}
