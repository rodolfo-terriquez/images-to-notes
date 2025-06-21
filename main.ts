import { Plugin, TAbstractFile, TFile, normalizePath, Editor, MarkdownView, MarkdownFileInfo, Workspace, Platform, TFolder, Menu, Notice } from 'obsidian';
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
	private isMobileDevice: boolean = false;

	async onload() {
		// console.time('ImageTranscriberPlugin onload');
		// console.log('Loading Images to notes Plugin');
		await this.loadSettings();

		// Check if running on mobile
		this.isMobileDevice = Platform.isMobile;

		this.notificationService = new NotificationService(this.settings);
		
		this.addSettingTab(new TranscriptionSettingTab(this.app, this));

		// Defer heavy initializations and event registrations until layout is ready
		this.app.workspace.onLayoutReady(() => {
			// console.log('Workspace layout ready.');

			// Initialize services and queue here
			this.aiService = new AIService(this.settings, this.notificationService, this.app);
			this.noteCreator = new NoteCreator(this.settings, this.notificationService, this.app);
			this.processingQueue = new ProcessingQueue();
			this.processingQueue.setProcessCallback(this.processImageFile.bind(this));

			// Register vault event listeners now that the queue is ready
			this.registerEvent(
				this.app.vault.on('create', this.handleFileCreate.bind(this))
			);
			
			this.registerEvent(
				this.app.workspace.on('file-menu', (menu: Menu, file) => {
					if (file instanceof TFolder) {
						menu.addItem((item) => {
							item
								.setTitle('New image to note')
								.setIcon('image-file')
								.setSection('action-primary')
								.onClick(async () => {
									const targetFolder = file as TFolder;
									new Notice(`Select images to add to folder: ${targetFolder.path}`);
			
									const input = document.createElement('input');
									input.type = 'file';
									input.accept = 'image/*';
									input.multiple = true;
			
									input.onchange = async (event) => {
										const M_inputElement = event.target as HTMLInputElement;
										const selectedFiles = M_inputElement.files;
			
										if (!selectedFiles || selectedFiles.length === 0) {
											new Notice('No files selected or photo not captured successfully.');
											if (M_inputElement) M_inputElement.value = ''; // Reset to allow retry
											return;
										}
			
										let showBatchImportNotice = true;
										if (this.settings.transcribeOnlySpecificFolder) {
											const specificFolderSetting = this.settings.specificFolderForTranscription;
											if (!specificFolderSetting) {
												showBatchImportNotice = false;
											} else {
												let normalizedSpecificFolder = normalizePath(specificFolderSetting);
												if (normalizedSpecificFolder === '.') normalizedSpecificFolder = '/';
												let normalizedTargetFolderPath = normalizePath(targetFolder.path);
												if (normalizedTargetFolderPath === '.') normalizedTargetFolderPath = '/';
			
												if (normalizedTargetFolderPath !== normalizedSpecificFolder) {
													showBatchImportNotice = false;
												}
											}
										}
			
										if (showBatchImportNotice) {
											new Notice(`Importing ${selectedFiles.length} image(s) to ${targetFolder.name}...`);
										}
			
										for (const browserFile of Array.from(selectedFiles)) {
											const fileName = browserFile.name;
											const destinationPath = normalizePath(`${targetFolder.path}/${fileName}`);
											if (this.processingPaths.has(destinationPath)) {
												new Notice(`File ${fileName} is already being processed. Skipped.`);
												continue;
											}
			
											try {
												this.processingPaths.add(destinationPath);
			
												const arrayBuffer = await browserFile.arrayBuffer();
			
												const existingFile = this.app.vault.getAbstractFileByPath(destinationPath);
												if (existingFile) {
													new Notice(`File ${fileName} already exists in ${targetFolder.name}. Skipped.`);
													continue;
												}
			
												const tFile = await this.app.vault.createBinary(destinationPath, arrayBuffer);
			
												if (tFile instanceof TFile && isImageFile(tFile)) {
													let shouldQueue = true;
													if (this.settings.transcribeOnlySpecificFolder) {
														const specificFolderSetting = this.settings.specificFolderForTranscription;
														if (!specificFolderSetting) {
															shouldQueue = false;
														} else {
															let normalizedSpecificFolder = normalizePath(specificFolderSetting);
															if (normalizedSpecificFolder === '.') normalizedSpecificFolder = '/';
			
															let normalizedTargetFolderPath = normalizePath(targetFolder.path);
															if (normalizedTargetFolderPath === '.') normalizedTargetFolderPath = '/';
															
															if (normalizedTargetFolderPath !== normalizedSpecificFolder) {
																shouldQueue = false;
																this.notificationService.notifyVerbose(`Imported ${fileName} to ${targetFolder.name}, but it's not the designated transcription folder. Not queueing.`);
															}
														}
													}
			
													if (shouldQueue) {
														new Notice(`Imported ${fileName} to ${targetFolder.name}.`); 
														this.processingQueue.addToQueue(tFile);
														new Notice(`Added ${fileName} to transcription queue.`);
													}
												} else {
													if (showBatchImportNotice) {
														new Notice(`Imported ${fileName} to ${targetFolder.name}, but it's not a recognized image or failed to queue.`);
													}
												}
											} catch (error) {
												console.error(`Error importing file ${fileName}:`, error);
												new Notice(`Failed to import ${fileName}. Check console for details.`);
											} finally {
												this.processingPaths.delete(destinationPath);
											}
										}
										if (M_inputElement) M_inputElement.value = '';
									};
			
									input.click();
								});
						});
					}
				})
			);

			this.isReady = true;
		});

		// Listen for drops onto the editor - this can be registered immediately
		this.registerEvent(
			this.app.workspace.on('editor-drop', this.handleEditorDrop.bind(this))
		);

		// Mobile-specific initialization if needed
		if (this.isMobileDevice) {
			// Adjust any settings or behavior for mobile
			this.initializeMobileSupport();
		}

		//console.timeEnd('ImageTranscriberPlugin onload');
		// console.log('Images to notes Plugin loaded. File watcher registration deferred until layout ready.');
	}

	onunload() {
		// console.log('Unloading Images to notes Plugin');
		// Cleanup logic: The registerEvent method handles unregistering the vault event.
		// Queue processing might need explicit stopping if it involves long operations.
	}

	private initializeMobileSupport() {
		// Mobile-specific initialization code
		console.log("Initializing mobile support for Notes to Markdown plugin");
		
		// Adjust processing queue for mobile - limit concurrent operations
		// Mobile devices have less processing power
		// Note: We'll need to add setMaxConcurrent to ProcessingQueue class
		// this.processingQueue.setMaxConcurrent(1);
		
		// Handle mobile-specific file system access
		// On iOS, file access might be more restricted
		if (Platform.isIosApp) {
			console.log("iOS-specific adjustments applied");
			// iOS-specific adjustments for file handling
			this.adjustForIOS();
		} 
		// Android-specific adjustments if needed
		else if (Platform.isAndroidApp) {
			console.log("Android-specific adjustments applied");
			// Android-specific adjustments
			this.adjustForAndroid();
		}
	}
	
	private adjustForIOS() {
		// iOS-specific adjustments for file system limitations
		console.log('Applying iOS-specific adjustments');
		
		// 1. Adjust file path handling for iOS
		// iOS has a different file system structure and stricter permissions
		
		// 2. Modify image processing settings for iOS
		// Reduce processing quality to improve performance on mobile
		if (this.settings.imageQuality && this.settings.imageQuality > 80) {
			console.log('Reducing image quality for iOS performance');
			const previousQuality = this.settings.imageQuality;
			this.settings.imageQuality = 80; // Lower quality for better performance
			this.notificationService.notifyVerbose(
				`Mobile optimization: Image quality reduced from ${previousQuality} to 80 for better performance.`
			);
		}
		
		// 3. Handle iOS-specific file access patterns
		// iOS may require different approaches to file access
		
		// 4. Adjust notification behavior for iOS
		// iOS notifications should be more concise
		this.notificationService.notifyInfo('Mobile compatibility mode enabled for iOS');
	}
	
	private adjustForAndroid() {
		// Android-specific adjustments for file system access patterns
		console.log('Applying Android-specific adjustments');
		
		// 1. Handle Android storage permissions
		// Android has a different permission model, especially for external storage
		
		// 2. Adjust image processing for Android
		// Android devices vary widely in capabilities, so we need to be more adaptive
		if (this.settings.mobileOptimizationEnabled) {
			// Adjust concurrent processing for Android
			const previousConcurrent = this.settings.maxConcurrentProcessing;
			this.settings.maxConcurrentProcessing = 1; // Limit to 1 on Android for better stability
			
			// Adjust image quality if needed
			if (this.settings.imageQuality > 85) {
				const previousQuality = this.settings.imageQuality;
				this.settings.imageQuality = 85; // Slightly lower quality for better performance
				this.notificationService.notifyVerbose(
					`Mobile optimization: Image quality adjusted from ${previousQuality} to 85 for Android.`
				);
			}
		}
		
		// 3. Handle Android-specific file paths
		// Android file paths may need special handling
		
		// 4. Adjust notification behavior for Android
		this.notificationService.notifyInfo('Mobile compatibility mode enabled for Android');
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
		// Mobile-specific handling for file creation
		if (this.isMobileDevice) {
			// On mobile, we might need to handle file creation differently
			console.log(`Mobile file creation detected: ${file.path}`);
			// Additional mobile-specific processing can be added here
		}
		
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

		// --- Folder-Specific Transcription Check ---
		if (this.settings.transcribeOnlySpecificFolder) {
			const specificFolder = this.settings.specificFolderForTranscription;
			if (!specificFolder) {
				// console.log('Specific folder transcription is ON, but no folder selected. Skipping file:', file.path);
				return; // Don't proceed to add to processingPaths or queue
			}

			const parentPathOfFile = getParentFolderPath(file.path);
			
			let normalizedSpecificFolder = normalizePath(specificFolder);
			// Ensure root path ('/') is used for comparison if specific folder is root
			if (normalizedSpecificFolder === '.') normalizedSpecificFolder = '/';

			let normalizedParentPathOfFile = normalizePath(parentPathOfFile);
			// Ensure root path ('/') is used for comparison if file is in root
			if (normalizedParentPathOfFile === '.') normalizedParentPathOfFile = '/';

			// console.log(`Folder check: File in "${normalizedParentPathOfFile}", Target folder "${normalizedSpecificFolder}"`);

			if (normalizedParentPathOfFile !== normalizedSpecificFolder) {
				// console.log(`File ${file.path} is not in the designated folder "${specificFolder}". Skipping transcription.`);
				// this.notificationService.notifyVerbose(`Skipped: ${file.name} is not in the designated transcription folder.`); // Potentially too noisy
				return; // Don't proceed
			}
			// console.log(`File ${file.path} is in the designated folder "${specificFolder}". Proceeding.`);
		}
		// --- End Folder-Specific Transcription Check ---

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
			this.processingQueue.addToQueue(file as TFile);
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

			// Determine destination paths based on settings
			const { imageDestination, noteDestination } = this.determineDestinationPaths(initialFile);
			
			// Ensure destination folders exist before proceeding
			await this.ensureFolderExists(imageDestination, 'image');
			await this.ensureFolderExists(noteDestination, 'note');


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
			const moveResult = await this.handleFileMove(fileToProcess, imageDestination);
			if (!moveResult) {
				// Error logged within handleFileMove, mark job as error
				this.processingQueue.markAsError(job, 'File move/folder handling failed');
				return;
			}
			const { finalPath } = moveResult;
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
			const transcriptionSuccess = await this.runTranscriptionAndCreateNote(fileToProcess, noteDestination);
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
	 * @param targetFolder The folder to move the image to.
	 * @returns An object with the final path, or null on failure.
	 */
	private async handleFileMove(fileToMove: TFile, targetFolder: string): Promise<{ finalPath: string } | null> {
		const newImagePath = normalizePath(`${targetFolder}/${fileToMove.name}`);

		if (newImagePath === fileToMove.path) {
			// console.log(`Image does not need to be moved. Current path: ${fileToMove.path}`);
			return { finalPath: fileToMove.path };
		}

		try {
			// Check for existing file at the target path before moving
			const existingImage = this.app.vault.getAbstractFileByPath(newImagePath);
			if (existingImage && existingImage instanceof TFile) {
				const warnMsg = `Image named '${fileToMove.name}' already exists in '${targetFolder}'. Skipping transcription.`;
				console.warn(warnMsg);
				this.notificationService.notifyError(`Failed to process ${fileToMove.name}: A file with this name already exists in '${targetFolder}'.`);
				return null; // Indicate failure
			}

			// Move the file
			// console.log(`Moving image from ${fileToMove.path} to: ${newImagePath}`);
			await this.app.fileManager.renameFile(fileToMove, newImagePath);
			// console.log(`Successfully moved image to: ${fileToMove.path}`);
			return { finalPath: fileToMove.path };

		} catch (moveError) {
			const errorMsg = `Error during move for ${fileToMove.name} targeting '${newImagePath}':`;
			console.error(errorMsg, moveError);
			this.notificationService.notifyError(`Failed to move ${fileToMove.name}. Skipping transcription.`);
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

	private determineDestinationPaths(initialFile: TFile): { imageDestination: string, noteDestination: string } {
		const currentParentPath = getParentFolderPath(initialFile.path);

		// Determine Image Destination
		let imageDestination: string;
		if (this.settings.imageDestinationOption === 'specificFolder' && this.settings.specificImageFolderPath) {
			imageDestination = normalizePath(this.settings.specificImageFolderPath);
		} else {
			const imageSubfolderName = this.settings.imageFolderName || DEFAULT_SETTINGS.imageFolderName;
			imageDestination = normalizePath(`${currentParentPath}/${imageSubfolderName}`);
		}

		// Determine Note Destination
		let noteDestination: string;
		if (this.settings.noteDestinationOption === 'specificFolder' && this.settings.specificNoteFolderPath) {
			noteDestination = normalizePath(this.settings.specificNoteFolderPath);
		} else {
			noteDestination = currentParentPath;
		}

		return { imageDestination, noteDestination };
	}

	private async ensureFolderExists(folderPath: string, type: 'image' | 'note'): Promise<void> {
		if (!folderPath || folderPath === '.' || folderPath === '/') return;

		try {
			const folderExists = await this.app.vault.adapter.exists(folderPath);
			if (!folderExists) {
				// console.log(`Creating ${type} destination folder at: ${folderPath}`);
				await this.app.vault.createFolder(folderPath);
			}
		} catch (error) {
			console.error(`Error ensuring ${type} folder exists at '${folderPath}':`, error);
			this.notificationService.notifyError(`Failed to create destination folder for ${type}s. Please check settings and permissions.`);
			throw error; // Propagate error to stop processing
		}
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
