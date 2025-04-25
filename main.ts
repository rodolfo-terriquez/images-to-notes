import { Plugin, TAbstractFile, TFile, normalizePath } from 'obsidian';
import { PluginSettings, DEFAULT_SETTINGS } from 'models/settings';
import { TranscriptionSettingTab } from 'ui/settingsTab';
import { TranscriptionQueue } from './services/transcriptionQueue';
import { isImageFile, getParentFolderPath } from './utils/fileUtils';
import { convertHeicToJpg, compressImage } from './utils/imageUtils';
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

	private async handleFileCreate(file: TAbstractFile) {
		if (isImageFile(file)) {
			console.log(`Detected supported image file: ${file.path}`);
			let fileToProcess: TFile = file; // Start with the original file

			// Check if it's HEIC and attempt conversion
			if (file.extension.toLowerCase() === 'heic') {
				console.log(`HEIC file detected, attempting conversion: ${file.path}`);
				const convertedFile = await convertHeicToJpg(file, this.app);
				if (convertedFile) {
					console.log(`HEIC converted successfully to: ${convertedFile.path}`);
					fileToProcess = convertedFile; // Use the converted JPG file for the queue
					// Optional: Delete original HEIC? Add setting later.
					// try {
					// 	await this.app.vault.trash(file, true);
					// 	console.log(`Original HEIC file moved to system trash: ${file.path}`);
					// } catch (trashError) {
					// 	console.error(`Failed to move original HEIC to trash: ${file.path}`, trashError);
					// }
				} else {
					console.error(`HEIC conversion failed for: ${file.path}. Skipping transcription.`);
					return; // Stop processing this file if conversion failed
				}
			}

			// --- Image Compression Step ---
			// For now, compress unconditionally. Add settings toggle later.
			// Pass the potentially converted file (`fileToProcess`) to the compression function.
			const compressedFile = await compressImage(fileToProcess, this.app);
			if (compressedFile) {
				// compressImage modifies the file in place if successful,
				// so fileToProcess reference is still valid (pointing to potentially compressed data)
				console.log(`Compression step completed for: ${fileToProcess.path}`);
			} else {
				// Compression failed, but we decided to proceed with the uncompressed file
				console.warn(`Compression failed for: ${fileToProcess.path}. Proceeding with uncompressed file.`);
				// fileToProcess remains the uncompressed version (or the result of HEIC conversion)
			}
			// --- End Compression Step ---

			// Capture the original parent path BEFORE potentially moving the file
			const originalParentPath = getParentFolderPath(fileToProcess.path);

			// --- Move to Images Subfolder Step ---
			try {
				// const imagesFolderPath = normalizePath(`${originalParentPath}/Images`);
				// Use the folder name from settings (defaulting to 'Images' if empty/invalid in settings)
				const imageFolderName = this.settings.imageFolderName || DEFAULT_SETTINGS.imageFolderName;
				const imagesFolderPath = normalizePath(`${originalParentPath}/${imageFolderName}`);

				// Check if the folder exists, create if not
				if (!await this.app.vault.adapter.exists(imagesFolderPath)) {
					// console.log(`Creating 'Images' folder at: ${imagesFolderPath}`);
					console.log(`Creating '${imageFolderName}' folder at: ${imagesFolderPath}`);
					await this.app.vault.createFolder(imagesFolderPath);
				}

				// Construct the new path for the image inside the folder
				const newImagePath = normalizePath(`${imagesFolderPath}/${fileToProcess.name}`);

				// Check if a file with the same name already exists in the subfolder
				const existingImageInSubfolder = this.app.vault.getAbstractFileByPath(newImagePath);
				if (existingImageInSubfolder && existingImageInSubfolder instanceof TFile) {
					// Avoid overwriting - skip moving and adding to queue if name conflicts
					// A more robust solution might involve renaming (e.g., image_1.jpg)
					// console.warn(`Image named '${fileToProcess.name}' already exists in '${imagesFolderPath}'. Skipping transcription for this file.`);
					const warnMsg = `Image named '${fileToProcess.name}' already exists in '${imagesFolderPath}'. Skipping transcription for this file.`;
					console.warn(warnMsg);
					// this.notificationService.notifyError(`Failed to process ${fileToProcess.name}: Duplicate name exists in Images folder.`);
					this.notificationService.notifyError(`Failed to process ${fileToProcess.name}: Duplicate name exists in '${imageFolderName}' folder.`);
					return; // Stop processing this file
				}

				// Move the file if the path is different
				if (fileToProcess.path !== newImagePath) {
					console.log(`Moving image to: ${newImagePath}`);
					await this.app.fileManager.renameFile(fileToProcess, newImagePath);
					// fileToProcess TFile object is updated by renameFile to point to the new path
					console.log(`Successfully moved image to: ${fileToProcess.path}`);
				}

			} catch (error) {
				// console.error(`Error moving file ${fileToProcess.name} to 'Images' subfolder:`, error);
				// this.notificationService.notifyError(`Failed to move ${fileToProcess.name} to Images folder. Skipping transcription.`);
				const errorMsg = `Error moving file ${fileToProcess.name} to '${this.settings.imageFolderName || DEFAULT_SETTINGS.imageFolderName}' subfolder:`;
				console.error(errorMsg, error);
				this.notificationService.notifyError(`Failed to move ${fileToProcess.name} to '${this.settings.imageFolderName || DEFAULT_SETTINGS.imageFolderName}' folder. Skipping transcription.`);
				return; // Stop processing this file if moving failed
			}
			// --- End Move Step ---

			// Add the file (original, converted, compressed, and potentially moved) to the queue
			console.log(`Adding to transcription queue: ${fileToProcess.path} (Original Parent: ${originalParentPath})`);
			this.transcriptionQueue.addToQueue(fileToProcess, originalParentPath);

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
				// Pass the whole job object to NoteCreator
				const noteFile = await this.noteCreator.createNote(transcription, job);

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
