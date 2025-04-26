# Obsidian Image Transcription Plugin - Development Task List

## Phase 1: Project Setup & Core Structure

- [x] **1. Initialize Plugin Project:**
    - [x] 1.1. Create a new directory for the plugin (e.g., `obsidian-image-transcriber`).
    - [x] 1.2. Set up standard Obsidian plugin project structure (`package.json`, `tsconfig.json`, `rollup.config.js` if using bundler).
    - [x] 1.3. Create the main plugin file: `main.ts`.
    - [x] 1.4. Create the plugin manifest file: `manifest.json`. Populate with basic details (ID, name, version, author, description).
    - [x] 1.5. Create the required directory structure: `services/`, `ui/`, `models/`, `utils/`.
- [x] **2. Implement Basic Plugin Class:**
    - [x] 2.1. In `main.ts`, define the main plugin class (e.g., `ImageTranscriberPlugin`) extending `Plugin`.
    - [x] 2.2. Implement the `onload()` method.
    - [x] 2.3. Implement the `onunload()` method (initially empty or logging unload).

## Phase 2: Settings Management

- [x] **3. Define Settings Structure:**
    - [x] 3.1. Create `models/settings.ts`.
    - [x] 3.2. Define the `PluginSettings` interface as specified in PRD Section 4.3.
    - [x] 3.3. Define the `DEFAULT_SETTINGS` constant object as specified in PRD Section 4.3.
- [x] **4. Implement Settings Loading/Saving:**
    - [x] 4.1. In `main.ts`, add a `settings` property of type `PluginSettings`.
    - [x] 4.2. In `onload()`, implement `loadSettings()` using `this.loadData()` and merging with `DEFAULT_SETTINGS`.
    - [x] 4.3. In `main.ts`, implement `saveSettings()` using `this.saveData()`.
- [x] **5. Create Settings Tab UI:**
    - [x] 5.1. Create `ui/settingsTab.ts`.
    - [x] 5.2. Define a class (e.g., `TranscriptionSettingTab`) extending `PluginSettingTab`.
    - [x] 5.3. Implement the `display()` method.
    - [x] 5.4. In `main.ts`'s `onload()`, register the settings tab using `this.addSettingTab(new TranscriptionSettingTab(this.app, this))`.
- [x] **6. Build Settings UI Elements:**
    - [x] 6.1. In `TranscriptionSettingTab.display()`, create settings components using `Setting` for:
        - [x] API Provider Selection (Radio buttons: OpenAI, Anthropic). Connect to `settings.provider` and call `saveSettings()` on change.
        - [x] OpenAI API Key (Password input). Connect to `settings.openaiApiKey` and call `saveSettings()` on change.
        - [x] Anthropic API Key (Password input). Connect to `settings.anthropicApiKey` and call `saveSettings()` on change.
        - [x] OpenAI Model Selection (Dropdown). Connect to `settings.openaiModel`. Conditionally display.
        - [x] Anthropic Model Selection (Dropdown). Connect to `settings.anthropicModel`. Conditionally display.
        - [x] Transcription Prompt (Text area). Connect to `settings.transcriptionPrompt`. Set min height.
        - [x] Note Naming Options (Radio buttons). Connect to `settings.useFirstLineAsTitle`.

## Phase 3: File Watching & Queueing

- [x] **7. Implement Utility Functions:**
    - [x] 7.1. Create `utils/fileUtils.ts` (or similar).
    - [x] 7.2. Implement `isImageFile(file: TAbstractFile): file is TFile` function (JPG, JPEG, PNG).
    - [x] 7.3. Implement `getParentFolderPath(filePath: string): string`.
    - [x] 7.4. Implement `sanitizeFilename(name: string): string`.
    - [x] 7.5. Implement `getFormattedDate(): string`.
    - [x] 7.6. Implement `encodeImageToBase64(file: TFile, app: App): Promise`.
- [x] **8. Implement Transcription Queue:**
    - [x] 8.1. Create `models/transcriptionJob.ts`. Define `TranscriptionJob` interface (file, status, error?).
    - [x] 8.2. Create `services/transcriptionQueue.ts`.
    - [x] 8.3. Define `TranscriptionQueue` class.
    - [x] 8.4. Implement internal queue array (`private queue: TranscriptionJob[]`).
    - [x] 8.5. Implement `addToQueue(file: TFile)`. Add job ('pending'), trigger processing if needed.
    - [x] 8.6. Implement `processNext()`. Takes next 'pending', marks 'processing', triggers transcription.
    - [x] 8.7. Implement methods to update job status (`markAsDone`, `markAsError`).
    - [x] 8.8. Add logic to persist/restore queue state (optional).
- [x] **9. Implement File Watcher:**
    - [x] 9.1. In `main.ts`'s `onload()`, register `this.app.vault.on('create', ...)`.
    - [x] 9.2. Implement the `handleFileCreate(file: TAbstractFile)` method in `main.ts`.
    - [x] 9.3. Inside `handleFileCreate`, use `isImageFile` utility.
    - [x] 9.4. If supported image, call `TranscriptionQueue.addToQueue(file)`.

## Phase 4: API Interaction & Transcription

- [x] **10. Implement Notification Service:**
    - [x] 10.1. Create `ui/notificationService.ts`.
    - [x] 10.2. Implement `notifyInfo`, `notifySuccess`, `notifyError` using `new Notice()`.
    - [x] 10.3. Inject or pass service where needed. (Will be done in Phase 6)
- [x] **11. Implement AI Service:**
    - [x] 11.1. Create `services/aiService.ts`.
    - [x] 11.2. Define `AIService` class. Inject `PluginSettings`, `NotificationService`.
    - [x] 11.3. Implement `transcribeImage(job: TranscriptionJob, app: App): Promise`.
        - [x] 11.3.1. Get image file from `job.file`.
        - [x] 11.3.2. Encode image to base64. Handle errors.
        - [x] 11.3.3. Determine API provider, key, model, prompt from settings.
        - [x] 11.3.4. Check for missing API key, notify error, return `null`.
        - [x] 11.3.5. Call appropriate private transcription method.
    - [x] 11.4. Implement `private async _transcribeWithOpenAI(...)`:
        - [x] Construct API request body (openai).
        - [x] Use `requestUrl` or `fetch` for POST request.
        - [x] Include `Authorization` header.
        - [x] Handle response: Parse JSON, extract text.
        - [x] Implement error handling (401, 429, 5xx, timeout) & basic retry.
        - [x] Return transcription string or `null`.
    - [x] 11.5. Implement `private async _transcribeWithAnthropic(...)`:
        - [x] Construct API request body (Claude).
        - [x] Include `x-api-key` header.
        - [x] Use `requestUrl` or `fetch`.
        - [x] Handle response: Parse JSON, extract text.
        - [x] Implement similar error handling & retry.
        - [x] Return transcription string or `null`.

## Phase 5: Note Creation

- [x] **12. Implement Note Creator:**
    - [x] 12.1. Create `services/noteCreator.ts`.
    - [x] 12.2. Define `NoteCreator` class. Inject `PluginSettings`, `NotificationService`, `App`.
    - [x] 12.3. Implement `createNote(transcription: string, originalImageFile: TFile): Promise`.
        - [x] 12.3.1. Determine note title based on settings (first line or folder+date+num).
        - [x] 12.3.2. Sanitize the title.
        - [x] 12.3.3. Get parent folder path.
        - [x] 12.3.4. Construct note content (`transcription\n\n![Original Image](...)`). Ensure image path is correct.
        - [x] 12.3.5. Use `this.app.vault.create(...)` to create the note.
        - [x] 12.3.6. Wrap in `try...catch`. Notify on error. Return `TFile` or `null`.

## Phase 6: Integration & Workflow

- [x] **13. Connect Queue, AI Service, and Note Creator:**
    - [x] 13.1. Instantiate services in `main.ts`'s `onload()`.
    - [x] 13.2. Modify `TranscriptionQueue.processNext()`: (Implemented via callback in main.ts)
        - [x] Notify start of transcription.
        - [x] Call `AIService.transcribeImage`.
        - [x] If transcription successful:
            - [x] Call `NoteCreator.createNote`.
            - [x] If note created: Mark job 'done', notify success.
            - [x] If note fails: Mark job 'error', log error.
        - [x] If transcription fails: Mark job 'error'.
        - [x] Call `processNext()` again after completion/error. (Handled by Queue)

## Phase 7: Testing and Refinement

- [ ] **14. Manual Testing:**
    - [x] 14.1. Build the plugin.
    - [x] 14.2. Install and enable in Obsidian.
    - [x] 14.3. Configure settings.
    - [x] 14.4. Test dropping single/multiple JPG/PNG images.
    - [x] 14.5. Verify: Notifications, note location, title logic, transcription quality, image embed, error handling.
- [ ] **15. Refinement:**
    - [x] 15.1. Review transcription quality, adjust default prompt if needed.
    - [ ] 15.2. Check console for errors, monitor performance.
    - [ ] 15.3. Ensure `onunload` cleans up resources/listeners.

## Phase 8: version 0.1.1 improvements

- [x] **16. Image conversion and resize:**
    - [x] 16.1. Implement support for additional image formats (e.g., .HEIC).
    - [x] 16.2. Create a utility function to convert .HEIC images to .jpg format.
    - [x] 16.3. Implement image compression functionality to reduce file size of .jpg images before storing in the Obsidian vault.
- [x] **17. Improve Image Organization:**
    - [x] 17.1. Check if an "Images" folder exists in the directory where images are dropped.
    - [x] 17.2. If the "Images" folder does not exist, create it.
    - [x] 17.3. Store all compressed and converted images in the "Images" folder.
- [x] **18. Quality of life improvements**
    - [x] 18.1. Let the user choose the default name of the 'Images' file with a text input box.
    - [x] 18.2. The default name for the folder should be 'Images'. This is also the name if the field is empty.
    - [x] 18.3. Set the default system prompt 'You are an expert at transcribing handwritten notes and typed text from images. Convert the image content to clean markdown format, preserving the structure and organization of the original notes.'
    - [x] 18.4. Set the default user prompt 'Please transcribe all text visible in this image into markdown format. Preserve the structure, headings, lists, and any other formatting from the original text. If you detect any diagrams. Analyze each one. Use the surrounding context to understand what the diagram is likely about  Replace the diagram with a well-structured explanation of the content the diagram is trying to convey. Preserve all the diagram's educational value. Place your explanation within the rest of the markdown, in its appropriate order. Use the same language in your explanation as the rest of the markdown. Do not describe the diagram, explain its content with words. Do not mention that you're describing content from a diagram, simply include it within the rest of the text with an appropriate heading. The reader will not have access to the diagram, so do not make any references to it. Do not add any mention or indication that the transcript is in markdown format at the beginning of the document.'
    - [x] 18.5. Add a reset button for both the system and user prompt so they return to the defaults
    