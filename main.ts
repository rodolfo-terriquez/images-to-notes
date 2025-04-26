import { Plugin, TAbstractFile, TFile, normalizePath, Editor, MarkdownView, MarkdownFileInfo, Workspace } from 'obsidian';
import { PluginSettings, DEFAULT_SETTINGS } from 'models/settings';
import { TranscriptionSettingTab } from 'ui/settingsTab';
import { ProcessingQueue } from './services/processingQueue';
import { isImageFile, getParentFolderPath } from './utils/fileUtils';
import { convertHeicToJpg, compressImage } from './utils/imageUtils';
import { NotificationService } from './ui/notificationService';
import { AIService } from './services/aiService';
import { NoteCreator } from './services/noteCreator';
import { ProcessingJob } from './models/processingJob';

export default class ImageTranscriberPlugin extends Plugin {
	settings: PluginSettings;
	processingQueue: ProcessingQueue;
	notificationService: NotificationService;
	aiService: AIService;
	noteCreator: NoteCreator;
	isReady: boolean = false;
	private droppedInEditorPaths = new Set<string>();
	private processingPaths = new Set<string>();

	async onload() {
		console.log('Loading Image Transcriber Plugin');
		await this.loadSettings();

		this.notificationService = new NotificationService();
		this.aiService = new AIService(this.settings, this.notificationService, this.app);
		this.noteCreator = new NoteCreator(this.settings, this.notificationService, this.app);
		this.processingQueue = new ProcessingQueue();

		this.processingQueue.setProcessCallback(this.processImageFile.bind(this));

		this.addSettingTab(new TranscriptionSettingTab(this.app, this));

		this.registerEvent(
			this.app.vault.on('create', this.handleFileCreate.bind(this))
		);

		// Listen for drops onto the editor
		this.registerEvent(
			this.app.workspace.on('editor-drop', this.handleEditorDrop.bind(this))
		);

		// Delay setting the ready flag to ignore initial file scan events
		setTimeout(() => {
			this.isReady = true;
			console.log('Image Transcriber Plugin initialization complete. Ready for new images.');
		}, 2000); // 2-second delay (adjust if needed)

		console.log('Image Transcriber Plugin loaded. File watcher active, but delayed start for processing.');
	}

	onunload() {
		console.log('Unloading Image Transcriber Plugin');
		// Cleanup logic: The registerEvent method handles unregistering the vault event.
		// Queue processing might need explicit stopping if it involves long operations.
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		// Ensure processedImagePaths is always an array, even if saved data is corrupted/missing
		if (!this.settings.processedImagePaths || !Array.isArray(this.settings.processedImagePaths)) {
			console.warn('Processed image paths missing or invalid in settings data. Initializing as empty array.');
			this.settings.processedImagePaths = [];
		}
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	private async handleFileCreate(file: TAbstractFile) {
		// --- Initial Checks ---
		// 1. Check if this file path was flagged as dropped in the editor
		if (file instanceof TFile && this.droppedInEditorPaths.has(file.path)) {
			console.log(`Skipping transcription for image dropped in editor: ${file.path}`);
			this.droppedInEditorPaths.delete(file.path); // Clean up the flag
			return;
		}

		// 2. Ignore events if the plugin hasn't finished its delayed initialization
		if (!this.isReady) {
			console.log(`Plugin not ready, ignoring create event for: ${file.path}`);
			return;
		}

		// 3. Ignore non-image files or folders early on
		if (!(file instanceof TFile && isImageFile(file))) {
			console.log(`Ignoring non-image file or folder: ${file.path}`);
			return;
		}

		// 4. Check if this path is already being added to the queue (brief lock)
		if (this.processingPaths.has(file.path)) {
			console.log(`Initial path already being added to queue, skipping: ${file.path}`);
			return;
		}
		// --- End Initial Checks ---

		// Mark this path as being added (briefly)
		this.processingPaths.add(file.path);

		try {
			console.log(`Adding initial file to processing queue: ${file.path}`);
			// Add the initial TFile object to the queue
			this.processingQueue.addToQueue(file);
		} catch (error) {
			console.error(`Error adding file ${file.path} to processing queue:`, error);
		} finally {
			// Remove from the temporary lock set once added (or if error occurs)
			if (this.processingPaths.delete(file.path)) {
				console.log(`Finished adding lock for: ${file.path}`);
			}
		}
	}

	/**
	 * Processes a single image file job sequentially.
	 * This method handles HEIC conversion, compression, moving, checking processed state,
	 * calling transcription, creating the note, and saving the processed state.
	 * This method is passed as a callback to the ProcessingQueue.
	 * @param job The processing job containing the initial file reference.
	 */
	private async processImageFile(job: ProcessingJob): Promise<void> {
		const initialFile = job.initialFile;
		let fileToProcess: TFile = initialFile; // Start with the initial file reference
		let finalProcessedPath: string | null = null; // Keep track of the final path after potential move

		try {
			this.notificationService.notifyInfo(`Processing ${initialFile.name}...`);

			// 1. --- HEIC Conversion Step ---
			if (initialFile.extension.toLowerCase() === 'heic') {
				console.log(`HEIC file detected, attempting conversion: ${initialFile.path}`);
				const convertedFile = await convertHeicToJpg(initialFile, this.app);
				if (convertedFile) {
					console.log(`HEIC converted successfully to: ${convertedFile.path}`);
					fileToProcess = convertedFile; // Use the converted JPG file for subsequent steps
				} else {
					console.error(`HEIC conversion failed for: ${initialFile.path}. Skipping transcription.`);
					this.processingQueue.markAsError(job, 'HEIC conversion failed');
					return; // Stop processing this job
				}
			}

			// 2. --- Image Compression Step ---
			// Pass the potentially converted file (`fileToProcess`) to the compression function.
			const compressedFile = await compressImage(fileToProcess, this.app);
			if (compressedFile) {
				console.log(`Compression step completed for: ${fileToProcess.path}`);
			} else {
				console.warn(`Compression failed for: ${fileToProcess.path}. Proceeding with uncompressed file.`);
			}

			// 3. --- File Moving Step ---
			// Derive paths based on the current state of fileToProcess
			const currentParentPath = getParentFolderPath(fileToProcess.path);
			const imageFolderName = this.settings.imageFolderName || DEFAULT_SETTINGS.imageFolderName;
			let noteTargetParentPath = currentParentPath;
			let imagesFolderPath = normalizePath(`${currentParentPath}/${imageFolderName}`);
			let newImagePath = normalizePath(`${imagesFolderPath}/${fileToProcess.name}`);
			let shouldMoveFile = true;

			// Check if dropped directly into an existing 'Images' folder
			const pathSegments = currentParentPath.split('/');
			const lastSegment = pathSegments[pathSegments.length - 1];

			if (lastSegment === imageFolderName) {
				console.log(`Image already in an '${imageFolderName}' folder: ${currentParentPath}`);
				imagesFolderPath = currentParentPath;
				newImagePath = fileToProcess.path;
				shouldMoveFile = false;
				noteTargetParentPath = getParentFolderPath(currentParentPath);
				console.log(`Note will be created in: ${noteTargetParentPath}`);
			}

			// Perform the move if necessary
			try {
				// Ensure the target folder exists (create only if moving)
				if (shouldMoveFile) {
					if (!await this.app.vault.adapter.exists(imagesFolderPath)) {
						console.log(`Creating '${imageFolderName}' folder at: ${imagesFolderPath}`);
						await this.app.vault.createFolder(imagesFolderPath);
					} else {
						console.log(`Target folder '${imagesFolderPath}' already exists.`);
					}
				}

				// Recalculate newImagePath just in case folder creation logic changed anything (unlikely but safe)
				newImagePath = normalizePath(`${imagesFolderPath}/${fileToProcess.name}`);

				// Check for existing file at the target path *before* moving
				const existingImageInSubfolder = this.app.vault.getAbstractFileByPath(newImagePath);
				if (existingImageInSubfolder && existingImageInSubfolder instanceof TFile && existingImageInSubfolder.path !== fileToProcess.path) {
					const warnMsg = `Image named '${fileToProcess.name}' already exists in '${imagesFolderPath}'. Skipping transcription.`;
					console.warn(warnMsg);
					this.notificationService.notifyError(`Failed to process ${fileToProcess.name}: Duplicate name exists in '${imageFolderName}' folder.`);
					this.processingQueue.markAsError(job, 'Duplicate image name in target folder');
					return;
				}

				// Move the file only if necessary
				if (shouldMoveFile && fileToProcess.path !== newImagePath) {
					console.log(`Moving image from ${fileToProcess.path} to: ${newImagePath}`);
					await this.app.fileManager.renameFile(fileToProcess, newImagePath);
					// fileToProcess object path is updated by renameFile
					console.log(`Successfully moved image to: ${fileToProcess.path}`);
				} else {
					console.log(`Image does not need to be moved. Current path: ${fileToProcess.path}`);
				}

				finalProcessedPath = fileToProcess.path; // Store the final path after move

			} catch (moveError) {
				const errorMsg = `Error during move/folder handling for ${fileToProcess.name} targeting '${imagesFolderPath}':`;
				console.error(errorMsg, moveError);
				this.notificationService.notifyError(`Failed to handle file operations for ${fileToProcess.name}. Skipping transcription.`);
				this.processingQueue.markAsError(job, `File move/folder error: ${moveError instanceof Error ? moveError.message : String(moveError)}`);
				return;
			}

			// 4. --- Check if Already Processed ---
			console.log(`Checking processed paths for final path: ${finalProcessedPath}`);
			console.log(`Current processed paths: ${JSON.stringify(this.settings.processedImagePaths)}`);
			if (finalProcessedPath && this.settings.processedImagePaths.includes(finalProcessedPath)) {
				console.log(`Image already processed (based on final path), skipping transcription: ${finalProcessedPath}`);
				this.processingQueue.markAsDone(job); // Mark as done, even though skipped
				return;
			}

			if (!finalProcessedPath) {
				console.error("Error: finalProcessedPath is not set before transcription attempt.");
				this.processingQueue.markAsError(job, 'Internal error: Final path not determined');
				return;
			}

			// 5. --- Transcription Step ---
			this.notificationService.notifyInfo(`Starting transcription for ${fileToProcess.name}...`);
			// Pass the final TFile object to the service
			const transcription = await this.aiService.transcribeImage(fileToProcess);

			if (transcription === null) {
				// Error notification handled by AIService
				this.processingQueue.markAsError(job, 'Transcription failed');
				return;
			}

			// 6. --- Note Creation Step ---
			this.notificationService.notifyInfo(`Transcription received for ${fileToProcess.name}. Creating note...`);
			// Pass the necessary info to NoteCreator
			const noteFile = await this.noteCreator.createNote(transcription, fileToProcess, noteTargetParentPath);

			if (!noteFile) {
				// Error notification handled by NoteCreator
				this.processingQueue.markAsError(job, 'Note creation failed');
				return;
			}

			// 7. --- Mark as Processed ---
			console.log(`Attempting to mark as processed and save: ${finalProcessedPath}`);
			this.settings.processedImagePaths.push(finalProcessedPath);
			await this.saveSettings(); // Persist the change
			console.log(`Successfully saved processed path: ${finalProcessedPath}. New list: ${JSON.stringify(this.settings.processedImagePaths)}`);

			// Mark the job as done in the queue
			this.processingQueue.markAsDone(job);

		} catch (error) {
			console.error(`Unhandled error during processing job for ${initialFile.path}:`, error);
			this.notificationService.notifyError(`Unexpected error processing ${initialFile.name}.`);
			this.processingQueue.markAsError(job, `Unexpected processing error: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	/**
	 * Handles files dropped directly onto the editor.
	 * We want to prevent transcription for these images as Obsidian handles them.
	 */
	private async handleEditorDrop(evt: DragEvent, editor: Editor, info: MarkdownView | MarkdownFileInfo): Promise<void> {
		console.log('Editor drop event detected.');
		if (!evt.dataTransfer) {
			console.log('No dataTransfer object found on event.');
			return;
		}

		const files = evt.dataTransfer.files;
		if (files.length === 0) {
			console.log('No files found in dataTransfer.');
			return;
		}

		const sourcePath = info.file?.path; // Path of the note where the drop occurred
		console.log(`Drop occurred in file: ${sourcePath || 'unknown'}`);

		for (let i = 0; i < files.length; i++) {
			const file = files[i];
			// Basic check for image MIME type or extension - refine if needed
			if (file.type.startsWith('image/')) {
				console.log(`Image file detected in editor drop: ${file.name} (Type: ${file.type})`);
				// Determine where Obsidian *will* save this file
				try {
					// Await the asynchronous function call
					const destinationPath = await this.app.fileManager.getAvailablePathForAttachment(file.name, sourcePath);
					console.log(`Anticipated path for ${file.name}: ${destinationPath}`);

					if (destinationPath) {
						this.droppedInEditorPaths.add(destinationPath);
						console.log(`Added to droppedInEditorPaths: ${destinationPath}`);

						// Cleanup mechanism: Remove the path after a short delay
						// This handles cases where the 'create' event might not fire or be missed
						setTimeout(() => {
							if (this.droppedInEditorPaths.delete(destinationPath)) {
								console.log(`Cleaned up droppedInEditorPaths: ${destinationPath}`);
							}
						}, 1500); // 1.5 second delay
					}
				} catch (error) {
					console.error(`Error determining attachment path for ${file.name}:`, error);
				}
			} else {
				console.log(`Non-image file dropped in editor: ${file.name}`);
			}
		}
	}
}
