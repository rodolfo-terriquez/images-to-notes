import { Plugin, TAbstractFile, TFile, normalizePath, Editor, MarkdownView, MarkdownFileInfo, Workspace } from 'obsidian';
import { PluginSettings, DEFAULT_SETTINGS, NoteNamingOption } from 'models/settings';
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
		// console.log('Loading Images to notes Plugin');
		await this.loadSettings();

		this.notificationService = new NotificationService(this.settings);
		this.aiService = new AIService(this.settings, this.notificationService, this.app);
		this.noteCreator = new NoteCreator(this.settings, this.notificationService, this.app);
		this.processingQueue = new ProcessingQueue();

		this.processingQueue.setProcessCallback(this.processImageFile.bind(this));

		this.addSettingTab(new TranscriptionSettingTab(this.app, this));

		// Defer the 'create' event registration until the layout is ready
		this.app.workspace.onLayoutReady(() => {
			// console.log('Workspace layout ready. Registering vault "create" event listener.');
			this.isReady = true; // Can set readiness flag here if still needed elsewhere
			this.registerEvent(
				this.app.vault.on('create', this.handleFileCreate.bind(this))
			);
		});

		// Listen for drops onto the editor - register immediately
		this.registerEvent(
			this.app.workspace.on('editor-drop', this.handleEditorDrop.bind(this))
		);

		// console.log('Images to notes Plugin loaded. File watcher registration deferred until layout ready.');
	}

	onunload() {
		// console.log('Unloading Images to notes Plugin');
		// Cleanup logic: The registerEvent method handles unregistering the vault event.
		// Queue processing might need explicit stopping if it involves long operations.
	}

	async loadSettings() {
        // Load saved data, potentially containing outdated settings format
        const loadedData = await this.loadData();

        // Start with default settings
        this.settings = { ...DEFAULT_SETTINGS };

        // Merge loaded data onto defaults
        if (loadedData) {
            this.settings = Object.assign(this.settings, loadedData);

            // --- Settings Migration --- 
            // Check if the old setting exists and the new one doesn't
            // The `as any` is used here to access a potentially deprecated property
            const oldSettingValue = (loadedData as any).useFirstLineAsTitle;
            if (typeof oldSettingValue === 'boolean' && !loadedData.noteNamingOption) {
                // console.log('Migrating old note naming setting...');
                this.settings.noteNamingOption = oldSettingValue 
                    ? NoteNamingOption.FirstLine 
                    : NoteNamingOption.FolderDateNum; // Or choose a different default like ImageName if preferred for migration
                
                // Optionally remove the old setting from the object to keep data clean
                // delete (this.settings as any).useFirstLineAsTitle; 
                // Decided against deleting for now, Object.assign will overwrite anyway if we save later
            }
            // --- End Settings Migration ---
        }

		// Ensure processedImagePaths is always an array, even if saved data is corrupted/missing
		if (!this.settings.processedImagePaths || !Array.isArray(this.settings.processedImagePaths)) {
			// console.warn('Processed image paths missing or invalid in settings data. Initializing as empty array.');
			this.settings.processedImagePaths = [];
		}
        
        // Save settings *after* potential migration to ensure the new format is stored
        await this.saveSettings();
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	private async handleFileCreate(file: TAbstractFile) {
		// --- Initial Checks ---
		// 1. Check if this file path was flagged as dropped in the editor
		if (file instanceof TFile && this.droppedInEditorPaths.has(file.path)) {
			// console.log(`Skipping transcription for image dropped in editor: ${file.path}`);
			this.droppedInEditorPaths.delete(file.path); // Clean up the flag
			return;
		}

		// 3. Ignore non-image files or folders early on
		if (!(file instanceof TFile && isImageFile(file))) {
			// console.log(`Ignoring non-image file or folder: ${file.path}`);
			return;
		}

		// 4. Check if this path is already being added to the queue (brief lock)
		if (this.processingPaths.has(file.path)) {
			// console.log(`Initial path already being added to queue, skipping: ${file.path}`);
			return;
		}
		// --- End Initial Checks ---

		// Mark this path as being added (briefly)
		this.processingPaths.add(file.path);

		try {
			// console.log(`Adding initial file to processing queue: ${file.path}`);
			// Add the initial TFile object to the queue
			this.processingQueue.addToQueue(file);
		} catch (error) {
			console.error(`Error adding file ${file.path} to processing queue:`, error);
		} finally {
			// Remove from the temporary lock set once added (or if error occurs)
			if (this.processingPaths.delete(file.path)) {
				// console.log(`Finished adding lock for: ${file.path}`);
			}
		}
	}

	/**
	 * Processes a single image file job sequentially. Orchestrates the different steps.
	 * @param job The processing job containing the initial file reference.
	 */
	private async processImageFile(job: ProcessingJob): Promise<void> {
		const initialFile = job.initialFile;
		let fileToProcess: TFile | null = initialFile;

		try {
			this.notificationService.notifyInfo(`Processing ${initialFile.name}...`);

			// 1. HEIC Conversion
			fileToProcess = await this.handleHeicConversion(fileToProcess);
			if (!fileToProcess) {
				this.processingQueue.markAsError(job, 'HEIC conversion failed');
				return; // Stop processing this job
			}

			// 2. Image Compression
			await this.handleImageCompression(fileToProcess);
			// Compression failure is logged but doesn't stop the process

			// 3. File Moving & Path Handling
			const moveResult = await this.handleFileMove(fileToProcess);
			if (!moveResult) {
				// Error logged within handleFileMove, mark job as error
				this.processingQueue.markAsError(job, 'File move/folder handling failed');
				return;
			}
			const { finalPath, noteTargetParentPath } = moveResult;
			// fileToProcess reference might be updated by renameFile inside handleFileMove,
			// but we primarily need the finalPath string now. Let's get the TFile reference for the final path.
			const finalFileRef = this.app.vault.getAbstractFileByPath(finalPath);
			if (!(finalFileRef instanceof TFile)) {
				console.error(`Could not get TFile reference for final path: ${finalPath}`);
				this.processingQueue.markAsError(job, 'Internal error: Could not get final file reference');
				return;
			}
			fileToProcess = finalFileRef; // Update fileToProcess to the potentially moved file reference

			// 4. Check if Already Processed (using final path)
			if (this.isAlreadyProcessed(finalPath)) {
				// console.log(`Image already processed (based on final path), skipping transcription: ${finalPath}`);
				this.processingQueue.markAsDone(job); // Mark as done, even though skipped
				return;
			}

			// 5. Transcription & Note Creation
			const transcriptionSuccess = await this.runTranscriptionAndCreateNote(fileToProcess, noteTargetParentPath);
			if (!transcriptionSuccess) {
				// Error logged within runTranscriptionAndCreateNote, mark job as error
				this.processingQueue.markAsError(job, 'Transcription or Note creation failed');
				return;
			}

			// 6. Mark as Processed & Save
			await this.markAsProcessed(finalPath);

			// Mark the job as done in the queue
			this.processingQueue.markAsDone(job);
			this.notificationService.notifyVerbose(`Successfully processed ${initialFile.name}.`);

		} catch (error) {
			console.error(`Unhandled error during processing job for ${initialFile.path}:`, error);
			this.notificationService.notifyError(`Unexpected error processing ${initialFile.name}.`);
			this.processingQueue.markAsError(job, `Unexpected processing error: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	/**
	 * Handles HEIC to JPG conversion if necessary.
	 * @param file The file to potentially convert.
	 * @returns The TFile reference to use for subsequent steps (original or converted), or null on conversion failure.
	 */
	private async handleHeicConversion(file: TFile): Promise<TFile | null> {
		if (file.extension.toLowerCase() === 'heic') {
			// console.log(`HEIC file detected, attempting conversion: ${file.path}`);
			const convertedFile = await convertHeicToJpg(file, this.app, this.notificationService);
			if (convertedFile) {
				// console.log(`HEIC converted successfully to: ${convertedFile.path}`);
				return convertedFile; // Use the converted JPG file
			} else {
				console.error(`HEIC conversion failed for: ${file.path}.`);
				return null; // Indicate failure
			}
		}
		return file; // Return original file if not HEIC
	}

	/**
	 * Handles image compression. Logs success or warning on failure.
	 * @param file The file to compress.
	 */
	private async handleImageCompression(file: TFile): Promise<void> {
		try {
			const resultFile = await compressImage(file, this.app, this.notificationService);
			if (resultFile && resultFile.path === file.path) {
				// console.log(`Compression step completed (or skipped) for: ${file.path}`);
			} else if (!resultFile) {
				console.error(`Compression utility unexpectedly returned null for: ${file.path}`);
			}
		} catch (compressionError) {
			console.error(`Error during compression call for ${file.path}:`, compressionError);
			this.notificationService.notifyError(`Compression failed for ${file.name} due to an unexpected error.`);
		}
	}

	/**
	 * Handles moving the file to the designated image folder, creating it if necessary,
	 * and checking for duplicates.
	 * @param fileToMove The file to potentially move (after conversion/compression).
	 * @returns An object with the final path and the note target path, or null on failure.
	 */
	private async handleFileMove(fileToMove: TFile): Promise<{ finalPath: string; noteTargetParentPath: string } | null> {
		const currentParentPath = getParentFolderPath(fileToMove.path);
		const imageFolderName = this.settings.imageFolderName || DEFAULT_SETTINGS.imageFolderName;
		let noteTargetParentPath = currentParentPath;
		let imagesFolderPath = normalizePath(`${currentParentPath}/${imageFolderName}`);
		let newImagePath = normalizePath(`${imagesFolderPath}/${fileToMove.name}`);
		let shouldMoveFile = true;

		// Check if dropped directly into an existing 'Images' folder
		const pathSegments = currentParentPath.split('/');
		const lastSegment = pathSegments[pathSegments.length - 1];

		if (lastSegment === imageFolderName) {
			// console.log(`Image already in an '${imageFolderName}' folder: ${currentParentPath}`);
			imagesFolderPath = currentParentPath;
			newImagePath = fileToMove.path; // Path remains the same
			shouldMoveFile = false;
			noteTargetParentPath = getParentFolderPath(currentParentPath); // Note goes one level up
			// console.log(`Note will be created in: ${noteTargetParentPath}`);
		}

		try {
			// Ensure the target folder exists (create only if moving)
			if (shouldMoveFile) {
				if (!await this.app.vault.adapter.exists(imagesFolderPath)) {
					// console.log(`Creating '${imageFolderName}' folder at: ${imagesFolderPath}`);
					await this.app.vault.createFolder(imagesFolderPath);
				} else {
					// console.log(`Target folder '${imagesFolderPath}' already exists.`);
				}
				// Recalculate newImagePath in case folder name was normalized or changed
				newImagePath = normalizePath(`${imagesFolderPath}/${fileToMove.name}`);
			}

			// Check for existing file at the target path *before* moving/deciding not to move
			// Important: Compare paths, not just names, to avoid self-comparison if not moving
			if (newImagePath !== fileToMove.path) {
				const existingImageInSubfolder = this.app.vault.getAbstractFileByPath(newImagePath);
				if (existingImageInSubfolder && existingImageInSubfolder instanceof TFile) {
					const warnMsg = `Image named '${fileToMove.name}' already exists in '${imagesFolderPath}'. Skipping transcription.`;
					console.warn(warnMsg);
					// Provide a more informative error message to the user
					this.notificationService.notifyError(`Failed to process ${fileToMove.name}: A file with this name already exists in '${imageFolderName}'. The original file remains at ${fileToMove.path}.`);
					return null; // Indicate failure
				}
			}


			// Move the file only if necessary and paths are different
			if (shouldMoveFile && fileToMove.path !== newImagePath) {
				// console.log(`Moving image from ${fileToMove.path} to: ${newImagePath}`);
				await this.app.fileManager.renameFile(fileToMove, newImagePath);
				// The fileToMove object's path is updated by renameFile
				// console.log(`Successfully moved image to: ${fileToMove.path}`);
				// Return the *updated* path from the file object after rename
				return { finalPath: fileToMove.path, noteTargetParentPath: noteTargetParentPath };
			} else {
				// console.log(`Image does not need to be moved. Current path: ${fileToMove.path}`);
				// Return the original path as the final path
				return { finalPath: fileToMove.path, noteTargetParentPath: noteTargetParentPath };
			}

		} catch (moveError) {
			const errorMsg = `Error during move/folder handling for ${fileToMove.name} targeting '${imagesFolderPath}':`;
			console.error(errorMsg, moveError);
			this.notificationService.notifyError(`Failed to handle file operations for ${fileToMove.name}. Skipping transcription.`);
			return null; // Indicate failure
		}
	}

	/**
	 * Checks if a file path has already been processed.
	 * @param filePath The path to check.
	 * @returns True if the path is in the processed list, false otherwise.
	 */
	private isAlreadyProcessed(filePath: string): boolean {
		// console.log(`Checking processed paths for final path: ${filePath}`);
		// console.log(`Current processed paths: ${JSON.stringify(this.settings.processedImagePaths)}`);
		return this.settings.processedImagePaths.includes(filePath);
	}

	/**
	 * Runs the AI transcription and creates the corresponding note.
	 * @param imageFile The final TFile object of the image (after move/conversion).
	 * @param noteTargetParentPath The folder path where the note should be created.
	 * @returns True if transcription and note creation were successful, false otherwise.
	 */
	private async runTranscriptionAndCreateNote(imageFile: TFile, noteTargetParentPath: string): Promise<boolean> {
		try {
			// Change this intermediate step to notifyVerbose
			this.notificationService.notifyVerbose(`Starting transcription for ${imageFile.name}...`);
			const transcription = await this.aiService.transcribeImage(imageFile);

			if (transcription === null) {
				console.error(`Transcription failed for ${imageFile.path}`);
				// Error handled by AIService
				return false;
			}

			// Change this intermediate step to notifyVerbose
			this.notificationService.notifyVerbose(`Transcription received for ${imageFile.name}. Creating note...`);
			const noteFile = await this.noteCreator.createNote(transcription, imageFile, noteTargetParentPath);

			if (!noteFile) {
				console.error(`Note creation failed for ${imageFile.path}`);
				// Error handled by NoteCreator
				return false;
			}

			return true; // Success

		} catch (error) {
			console.error(`Error during transcription or note creation for ${imageFile.path}:`, error);
			this.notificationService.notifyError(`Error during AI processing or note creation for ${imageFile.name}.`);
			return false; // Indicate failure
		}
	}

	/**
	 * Adds the file path to the processed list and saves settings.
	 * @param filePath The file path to mark as processed.
	 */
	private async markAsProcessed(filePath: string): Promise<void> {
		try {
			// console.log(`Attempting to mark as processed and save: ${filePath}`);
			if (!this.settings.processedImagePaths.includes(filePath)) {
				this.settings.processedImagePaths.push(filePath);
				await this.saveSettings(); // Persist the change
				// console.log(`Successfully saved processed path: ${filePath}. New list: ${JSON.stringify(this.settings.processedImagePaths)}`);
			} else {
				// console.log(`Path ${filePath} was already in the processed list.`);
			}
		} catch (error) {
			console.error(`Failed to save processed path ${filePath}:`, error);
			this.notificationService.notifyError(`Failed to save processed state for ${filePath}. It might be processed again later.`);
			// Decide if this should throw or just log
		}
	}

	/**
	 * Handles files dropped directly onto the editor.
	 * We want to prevent transcription for these images as Obsidian handles them.
	 */
	private async handleEditorDrop(evt: DragEvent, editor: Editor, info: MarkdownView | MarkdownFileInfo): Promise<void> {
		// console.log('Editor drop event detected.');
		if (!evt.dataTransfer) {
			// console.log('No dataTransfer object found on event.');
			return;
		}

		const files = evt.dataTransfer.files;
		if (files.length === 0) {
			// console.log('No files found in dataTransfer.');
			return;
		}

		const sourcePath = info.file?.path; // Path of the note where the drop occurred
		// console.log(`Drop occurred in file: ${sourcePath || 'unknown'}`);

		for (let i = 0; i < files.length; i++) {
			const file = files[i];
			// Basic check for image MIME type or extension - refine if needed
			if (file.type.startsWith('image/')) {
				// console.log(`Image file detected in editor drop: ${file.name} (Type: ${file.type})`);
				// Determine where Obsidian *will* save this file
				try {
					// Await the asynchronous function call
					const destinationPath = await this.app.fileManager.getAvailablePathForAttachment(file.name, sourcePath);
					// console.log(`Anticipated path for ${file.name}: ${destinationPath}`);

					if (destinationPath) {
						this.droppedInEditorPaths.add(destinationPath);
						// console.log(`Added to droppedInEditorPaths: ${destinationPath}`);

						// Cleanup mechanism: Remove the path after a short delay
						// This handles cases where the 'create' event might not fire or be missed
						setTimeout(() => {
							if (this.droppedInEditorPaths.delete(destinationPath)) {
								// console.log(`Cleaned up droppedInEditorPaths: ${destinationPath}`);
							}
						}, 1500); // 1.5 second delay
					}
				} catch (error) {
					console.error(`Error determining attachment path for ${file.name}:`, error);
				}
			} else {
				// console.log(`Non-image file dropped in editor: ${file.name}`);
			}
		}
	}
}
