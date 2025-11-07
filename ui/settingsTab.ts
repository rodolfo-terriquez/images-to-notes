import { App, PluginSettingTab, Setting, TextAreaComponent, DropdownComponent, TextComponent, Notice, ButtonComponent, TFolder } from 'obsidian';
import ImageTranscriberPlugin from '../main'; // Corrected import
import { ApiProvider, OpenAiModel, AnthropicModel, GoogleModel, MistralModel, DEFAULT_SETTINGS, NoteNamingOption, TranscriptionPlacement } from '../models/settings'; // Import relevant types AND DEFAULTS AND NoteNamingOption

// Define available models - These should match the types in settings.ts
const OPENAI_MODELS: Record<OpenAiModel, string> = {
    'gpt-4.1': 'GPT-4.1',
    'gpt-4.1-mini': 'GPT-4.1 Mini',
    'o4-mini': 'o4 Mini',
    'gpt-5-2025-08-07': 'GPT-5',
    'gpt-5-mini-2025-08-07': 'GPT-5 Mini'
};

const ANTHROPIC_MODELS: Record<AnthropicModel, string> = {
    'claude-3-7-sonnet-latest': 'Claude Sonnet 3.7',
    'claude-sonnet-4-0': 'Claude Sonnet 4.0',
    'claude-sonnet-4-5': 'Claude Sonnet 4.5',
    'claude-haiku-4-5': 'Claude Haiku 4.5',
};

const GOOGLE_MODELS: Record<GoogleModel, string> = {
    'gemini-2.0-flash': 'Gemini 2.0 Flash',
    'gemini-2.5-flash': 'Gemini 2.5 Flash',
    'gemini-2.5-flash-lite': 'Gemini 2.5 Flash Lite',
};

const MISTRAL_MODELS: Record<MistralModel, string> = {
    'mistral-ocr-2505': 'Mistral OCR 2505',
    'mistral-small-2503': 'Mistral Small 3.1',
    'mistral-medium-2508': 'Mistral Medium 3.1',
};

export class TranscriptionSettingTab extends PluginSettingTab {
    plugin: ImageTranscriberPlugin;

    constructor(app: App, plugin: ImageTranscriberPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;

        containerEl.empty();

        // --- API Provider ---
        new Setting(containerEl)
            .setName('API provider')
            .setDesc('Select the AI provider for image transcription.')
            .addDropdown(dropdown => dropdown
                .addOption(ApiProvider.OpenAI, 'OpenAI')
                .addOption(ApiProvider.Anthropic, 'Anthropic')
                .addOption(ApiProvider.Google, 'Google')
                .addOption(ApiProvider.Mistral, 'Mistral')
                .setValue(this.plugin.settings.provider)
                .onChange(async (value) => {
                    this.plugin.settings.provider = value as ApiProvider;
                    await this.plugin.saveSettings();
                    this.display(); // Re-render the settings tab to show/hide relevant fields
                }));

        // --- Provider Specific Settings ---
        const providerDesc = containerEl.createDiv({ cls: 'imgtono-provider-settings-desc' }); // Container for descriptions/warnings
        providerDesc.empty(); // Clear previous warnings

        if (this.plugin.settings.provider === ApiProvider.OpenAI) {
            // OpenAI API Key
            new Setting(containerEl)
                .setName('OpenAI API key')
                .setDesc('Enter your OpenAI API key.')
                .addText(text => text
                    .setPlaceholder('sk-...')
                    .setValue(this.plugin.settings.openaiApiKey)
                    .onChange(async (value) => {
                        this.plugin.settings.openaiApiKey = value.trim();
                        await this.plugin.saveSettings();
                    })
                    .inputEl.setAttribute('type', 'password')); // Mask the key

            // OpenAI Base URL
            new Setting(containerEl)
                .setName('OpenAI Base URL')
                .setDesc('Set a custom base URL for the OpenAI API. Defaults to https://api.openai.com.')
                .addText(text => text
                    .setPlaceholder('https://api.openai.com')
                    .setValue(this.plugin.settings.openaiBaseUrl)
                    .onChange(async (value) => {
                        this.plugin.settings.openaiBaseUrl = value.trim();
                        await this.plugin.saveSettings();
                    }));

            // OpenAI Model
            new Setting(containerEl)
                .setName('OpenAI model')
                .setDesc('Select the OpenAI model to use. GPT-4.1 Mini is great for its low cost and high accuracy.')
                .addDropdown(dropdown => {
                    // Use the imported type and constant
                    for (const modelId in OPENAI_MODELS) {
                        dropdown.addOption(modelId, OPENAI_MODELS[modelId as OpenAiModel]);
                    }
                    dropdown.setValue(this.plugin.settings.openaiModel);
                    dropdown.onChange(async (value) => {
                        this.plugin.settings.openaiModel = value as OpenAiModel; // Cast to specific type
                        await this.plugin.saveSettings();
                    });
                 });

            if (!this.plugin.settings.openaiApiKey) {
                 providerDesc.createEl('p', { text: '⚠️ OpenAI API key is required.', cls: 'imgtono-setting-warning' });
            }

        } else if (this.plugin.settings.provider === ApiProvider.Anthropic) {
            // Anthropic API Key
            new Setting(containerEl)
                .setName('Anthropic API key')
                .setDesc('Enter your Anthropic API key.')
                .addText(text => text
                    .setPlaceholder('sk-ant-...')
                    .setValue(this.plugin.settings.anthropicApiKey)
                    .onChange(async (value) => {
                        this.plugin.settings.anthropicApiKey = value.trim();
                        await this.plugin.saveSettings();
                    })
                    .inputEl.setAttribute('type', 'password')); // Mask the key

            // Anthropic Model
            new Setting(containerEl)
                .setName('Anthropic model')
                .setDesc('Select the Anthropic model to use.')
                .addDropdown(dropdown => {
                    // Use the imported type and constant
                     for (const modelId in ANTHROPIC_MODELS) {
                        dropdown.addOption(modelId, ANTHROPIC_MODELS[modelId as AnthropicModel]);
                     }
                    dropdown.setValue(this.plugin.settings.anthropicModel)
                    dropdown.onChange(async (value) => {
                        this.plugin.settings.anthropicModel = value as AnthropicModel; // Cast to specific type
                        await this.plugin.saveSettings();
                    });
                 });

            if (!this.plugin.settings.anthropicApiKey) {
                 providerDesc.createEl('p', { text: '⚠️ Anthropic API key is required.', cls: 'imgtono-setting-warning' });
            }

        } else if (this.plugin.settings.provider === ApiProvider.Google) {
            // Google API Key
            new Setting(containerEl)
                .setName('Google API key')
                .setDesc('Enter your Google API key for Gemini models.')
                .addText(text => text
                    .setPlaceholder('AIza...')
                    .setValue(this.plugin.settings.googleApiKey)
                    .onChange(async (value) => {
                        this.plugin.settings.googleApiKey = value.trim();
                        await this.plugin.saveSettings();
                    })
                    .inputEl.setAttribute('type', 'password')); // Mask the key

            // Google Model
            new Setting(containerEl)
                .setName('Google model')
                .setDesc('Select the Google Gemini model to use.')
                .addDropdown(dropdown => {
                    // Use the imported type and constant
                     for (const modelId in GOOGLE_MODELS) {
                        dropdown.addOption(modelId, GOOGLE_MODELS[modelId as GoogleModel]);
                     }
                    dropdown.setValue(this.plugin.settings.googleModel)
                    dropdown.onChange(async (value) => {
                        this.plugin.settings.googleModel = value as GoogleModel; // Cast to specific type
                        await this.plugin.saveSettings();
                    });
                 });

            if (!this.plugin.settings.googleApiKey) {
                 providerDesc.createEl('p', { text: '⚠️ Google API key is required.', cls: 'imgtono-setting-warning' });
            }
        } else if (this.plugin.settings.provider === ApiProvider.Mistral) {
            // Mistral API Key
            new Setting(containerEl)
                .setName('Mistral API key')
                .setDesc('Enter your Mistral API key.')
                .addText(text => text
                    .setPlaceholder('mistral-...')
                    .setValue(this.plugin.settings.mistralApiKey)
                    .onChange(async (value) => {
                        this.plugin.settings.mistralApiKey = value.trim();
                        await this.plugin.saveSettings();
                    })
                    .inputEl.setAttribute('type', 'password')); // Mask the key

            // Mistral Model
            new Setting(containerEl)
                .setName('Mistral model')
                .setDesc('Select the Mistral model to use.')
                .addDropdown(dropdown => {
                    for (const modelId in MISTRAL_MODELS) {
                        dropdown.addOption(modelId, MISTRAL_MODELS[modelId as MistralModel]);
                    }
                    dropdown.setValue(this.plugin.settings.mistralModel);
                    dropdown.onChange(async (value) => {
                        this.plugin.settings.mistralModel = value as MistralModel;
                        await this.plugin.saveSettings();
                    });
                });

            if (!this.plugin.settings.mistralApiKey) {
                providerDesc.createEl('p', { text: '⚠️ Mistral API key is required.', cls: 'imgtono-setting-warning' });
            }
        }

        // --- System Prompt ---
        let systemPromptTextArea: TextAreaComponent; // Variable to hold the text area component
        
        // Create the system prompt setting with vertical layout
        const systemPromptContainer = containerEl.createDiv({ cls: 'imgtono-vertical-layout-container' });
        
        // Add the setting header (name and description)
        const systemPromptHeader = systemPromptContainer.createDiv({ cls: 'imgtono-setting-item-info' });
        const systemPromptName = systemPromptHeader.createDiv({ cls: 'imgtono-setting-item-name' });
        systemPromptName.setText('System prompt');
        const systemPromptDesc = systemPromptHeader.createDiv({ cls: 'imgtono-setting-item-description' });
        systemPromptDesc.setText('The system prompt to guide the AI model\'s behavior (e.g., role, context).');
        
        // Add the text area below the description
        const systemPromptControl = systemPromptContainer.createDiv({ cls: 'imgtono-setting-item-control' });
        systemPromptTextArea = new TextAreaComponent(systemPromptControl);
        systemPromptTextArea
            .setPlaceholder(DEFAULT_SETTINGS.systemPrompt)
            .setValue(this.plugin.settings.systemPrompt)
            .onChange(async (value) => {
                this.plugin.settings.systemPrompt = value;
                await this.plugin.saveSettings();
            });
        systemPromptTextArea.inputEl.rows = 4;
        systemPromptTextArea.inputEl.style.width = '100%';
        
        // Add reset button below the text area
        const systemPromptButtonContainer = systemPromptContainer.createDiv({ cls: 'imgtono-setting-button-row' });
        new ButtonComponent(systemPromptButtonContainer)
            .setIcon('reset')
            .setButtonText('Reset to default')
            .onClick(async () => {
                this.plugin.settings.systemPrompt = DEFAULT_SETTINGS.systemPrompt;
                systemPromptTextArea.setValue(this.plugin.settings.systemPrompt);
                await this.plugin.saveSettings();
                new Notice('System prompt reset to default.');
            });

        // --- User Prompt (Previously Transcription Prompt) ---
        let userPromptTextArea: TextAreaComponent; // Variable to hold the text area component
        
        // Create the user prompt setting with vertical layout
        const userPromptContainer = containerEl.createDiv({ cls: 'imgtono-vertical-layout-container' });
        
        // Add the setting header (name and description)
        const userPromptHeader = userPromptContainer.createDiv({ cls: 'imgtono-setting-item-info' });
        const userPromptName = userPromptHeader.createDiv({ cls: 'imgtono-setting-item-name' });
        userPromptName.setText('User prompt');
        const userPromptDesc = userPromptHeader.createDiv({ cls: 'imgtono-setting-item-description' });
        userPromptDesc.setText('The specific instruction for the AI for this image.');
        
        // Add the text area below the description
        const userPromptControl = userPromptContainer.createDiv({ cls: 'imgtono-setting-item-control' });
        userPromptTextArea = new TextAreaComponent(userPromptControl);
        userPromptTextArea
            .setPlaceholder(DEFAULT_SETTINGS.userPrompt)
            .setValue(this.plugin.settings.userPrompt)
            .onChange(async (value) => {
                this.plugin.settings.userPrompt = value;
                await this.plugin.saveSettings();
            });
        userPromptTextArea.inputEl.rows = 6; // Make it taller
        userPromptTextArea.inputEl.style.width = '100%';
        
        // Add reset button below the text area
        const userPromptButtonContainer = userPromptContainer.createDiv({ cls: 'imgtono-setting-button-row' });
        new ButtonComponent(userPromptButtonContainer)
            .setIcon('reset')
            .setButtonText('Reset to default')
            .onClick(async () => {
                this.plugin.settings.userPrompt = DEFAULT_SETTINGS.userPrompt;
                userPromptTextArea.setValue(this.plugin.settings.userPrompt);
                await this.plugin.saveSettings();
                new Notice('User prompt reset to default.');
            });

        // --- Note Naming ---
        this.createNoteNamingSetting(containerEl);

        // --- Note Content ---
        new Setting(containerEl).setName('Note Content').setHeading();
        
        new Setting(containerEl)
            .setName('Include image in note')
            .setDesc('If enabled, the processed image will be linked at the bottom of each transcribed note.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.includeImageInNote)
                .onChange(async (value) => {
                    this.plugin.settings.includeImageInNote = value;
                    await this.plugin.saveSettings();
                }));
        
        new Setting(containerEl)
            .setName('Transcription placement')
            .setDesc('Choose where to place the transcription relative to the image.')
            .addDropdown(dropdown => dropdown
                .addOption(TranscriptionPlacement.AboveImage, 'Above image')
                .addOption(TranscriptionPlacement.BelowImage, 'Below image')
                .setValue(this.plugin.settings.transcriptionPlacement)
                .onChange(async (value) => {
                    this.plugin.settings.transcriptionPlacement = value as TranscriptionPlacement;
                    await this.plugin.saveSettings();
                }));

        // --- Image Source Control ---
        new Setting(containerEl).setName('Image Source Control').setHeading();
        this.createSourceFolderSetting(containerEl);

        // --- Output Destination ---
        new Setting(containerEl).setName('Output Destination').setHeading();
        this.createImageDestinationSetting(containerEl);
        this.createNoteDestinationSetting(containerEl);

        // --- Image Folder Name ---
        // This setting is now conditional, shown only when imageDestinationOption is 'subfolder'
        if (this.plugin.settings.imageDestinationOption === 'subfolder') {
            this.createImageFolderNameSetting(containerEl);
        }

        // --- Mobile Optimizations ---
        new Setting(containerEl).setName('Mobile Optimizations').setHeading();

        new Setting(containerEl)
            .setName('Enable mobile optimization')
            .setDesc('If enabled, the plugin will optimize images for mobile devices.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.mobileOptimizationEnabled)
                .onChange(async (value) => {
                    this.plugin.settings.mobileOptimizationEnabled = value;
                    await this.plugin.saveSettings();
                }));

        // --- Add the new setting toggle
        new Setting(containerEl)
            .setName('Enable verbose notifications')
            .setDesc('Show detailed notifications for every processing step, not just start, finish, and errors.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.verboseNotifications)
                .onChange(async (value) => {
                    this.plugin.settings.verboseNotifications = value;
                    await this.plugin.saveSettings();
                }));

        // --- Clear Processed Image History ---
        new Setting(containerEl).setName('Maintenance').setHeading();
        new Setting(containerEl)
            .setName('Clear processed image history')
            .setDesc(
                'Removes the record of images that have already been processed. ' +
                'Use this if you want the plugin to re-process images it previously skipped, ' +
                'or if you have cleared your vault and want to reset the history. ' +
                'Currently processed count: ' + this.plugin.settings.processedImagePaths.length
            )
            .addButton(button => button
                .setButtonText('Clear history')
                .setWarning() // Makes the button red for caution
                .onClick(async () => {
                    // Simple confirmation dialog
                    if (confirm('Are you sure you want to clear the entire processed image history? This cannot be undone.')) {
                        this.plugin.settings.processedImagePaths = [];
                        await this.plugin.saveSettings();
                        new Notice('Processed image history cleared.');
                        this.display(); // Re-render the settings tab to update the count
                    } else {
                        new Notice('Clear history cancelled.');
                    }
                }));
    }

    private createFolderSetting(containerEl: HTMLElement, settingName: string, settingDesc: string, value: string, placeholder: string, onChange: (value: string) => Promise<void>): void {
        let folderInput: TextComponent;
        const folderSettingContainer = containerEl.createDiv({ cls: 'imgtono-vertical-layout-container' });

        const folderHeader = folderSettingContainer.createDiv({ cls: 'imgtono-setting-item-info' });
        const folderName = folderHeader.createDiv({ cls: 'imgtono-setting-item-name' });
        folderName.setText(settingName);
        const folderDesc = folderHeader.createDiv({ cls: 'imgtono-setting-item-description' });
        folderDesc.setText(settingDesc);

        const folderControl = folderSettingContainer.createDiv({ cls: 'imgtono-setting-item-control' });
        folderInput = new TextComponent(folderControl);
        folderInput
            .setPlaceholder(placeholder)
            .setValue(value)
            .onChange(onChange);
        folderInput.inputEl.style.width = '100%';

        const folderButtonContainer = folderSettingContainer.createDiv({ cls: 'imgtono-setting-button-row' });
        new ButtonComponent(folderButtonContainer)
            .setIcon('reset')
            .setButtonText('Reset')
            .onClick(async () => {
                folderInput.setValue('');
                await onChange('');
                new Notice(`${settingName} folder path cleared.`);
            });
    }

    private createFolderDropdownSetting(containerEl: HTMLElement, settingName: string, settingDesc: string, value: string, onChange: (value: string) => Promise<void>): void {
        const folderSettingContainer = containerEl.createDiv({ cls: 'imgtono-vertical-layout-container' });

        const folderHeader = folderSettingContainer.createDiv({ cls: 'imgtono-setting-item-info' });
        folderHeader.createDiv({ cls: 'imgtono-setting-item-name' }).setText(settingName);
        folderHeader.createDiv({ cls: 'imgtono-setting-item-description' }).setText(settingDesc);

        const folderControl = folderSettingContainer.createDiv({ cls: 'imgtono-setting-item-control' });
        const dropdown = new DropdownComponent(folderControl);
        dropdown.addOption('', '-- Select a folder --');

        const folders = this.app.vault.getAllLoadedFiles().filter(file => file instanceof TFolder) as TFolder[];
        folders.forEach(folder => {
            dropdown.addOption(folder.path, folder.path === '/' ? 'Vault Root (/)' : folder.path);
        });

        dropdown.setValue(value).onChange(onChange);
        dropdown.selectEl.style.width = '100%';

        if (!value && folders.length > 0) {
            const warningEl = folderHeader.createEl('p', {
                text: '⚠️ Please select a folder.',
                cls: 'imgtono-setting-warning'
            });
        } else if (folders.length === 0) {
            folderHeader.createEl('p', {
                text: 'No folders found in your vault. Create a folder to use this feature.',
                cls: 'imgtono-setting-warning'
            });
            dropdown.setDisabled(true);
        }
    }

    private createImageDestinationSetting(containerEl: HTMLElement): void {
        const imageDestContainer = containerEl.createDiv({ cls: 'imgtono-vertical-layout-container' });
        const imageDestHeader = imageDestContainer.createDiv({ cls: 'imgtono-setting-item-info' });
        imageDestHeader.createDiv({ cls: 'imgtono-setting-item-name' }).setText('Image destination');
        imageDestHeader.createDiv({ cls: 'imgtono-setting-item-description' }).setText('Where should processed images be saved?');

        const imageDestControl = imageDestContainer.createDiv({ cls: 'imgtono-setting-item-control' });
        const imageDestDropdown = new DropdownComponent(imageDestControl);
        imageDestDropdown
            .addOption('subfolder', 'Create a subfolder in the current folder (default)')
            .addOption('specificFolder', 'Save to a specific folder')
            .setValue(this.plugin.settings.imageDestinationOption)
            .onChange(async (value) => {
                this.plugin.settings.imageDestinationOption = value as 'subfolder' | 'specificFolder';
                await this.plugin.saveSettings();
                this.display();
            });

        if (this.plugin.settings.imageDestinationOption === 'specificFolder') {
            this.createFolderDropdownSetting(
                imageDestContainer,
                'Specific image folder path',
                'The path to the folder for processed images (e.g., Assets/Images).',
                this.plugin.settings.specificImageFolderPath,
                async (value) => {
                    this.plugin.settings.specificImageFolderPath = value;
                    await this.plugin.saveSettings();
                }
            );
        }
    }

    private createNoteDestinationSetting(containerEl: HTMLElement): void {
        const noteDestContainer = containerEl.createDiv({ cls: 'imgtono-vertical-layout-container' });
        const noteDestHeader = noteDestContainer.createDiv({ cls: 'imgtono-setting-item-info' });
        noteDestHeader.createDiv({ cls: 'imgtono-setting-item-name' }).setText('Note destination');
        noteDestHeader.createDiv({ cls: 'imgtono-setting-item-description' }).setText('Where should new transcription notes be created?');

        const noteDestControl = noteDestContainer.createDiv({ cls: 'imgtono-setting-item-control' });
        const noteDestDropdown = new DropdownComponent(noteDestControl);
        noteDestDropdown
            .addOption('alongside', 'Alongside the original image\'s location (default)')
            .addOption('specificFolder', 'Save to a specific folder')
            .setValue(this.plugin.settings.noteDestinationOption)
            .onChange(async (value) => {
                this.plugin.settings.noteDestinationOption = value as 'alongside' | 'specificFolder';
                await this.plugin.saveSettings();
                this.display();
            });

        if (this.plugin.settings.noteDestinationOption === 'specificFolder') {
            this.createFolderDropdownSetting(
                noteDestContainer,
                'Specific note folder path',
                'The path to the folder for new notes (e.g., Inbox/Transcriptions).',
                this.plugin.settings.specificNoteFolderPath,
                async (value) => {
                    this.plugin.settings.specificNoteFolderPath = value;
                    await this.plugin.saveSettings();
                }
            );
        }
    }

    private createImageFolderNameSetting(containerEl: HTMLElement): void {
        let folderNameInput: TextComponent;
        const folderNameContainer = containerEl.createDiv({ cls: 'imgtono-vertical-layout-container' });

        const folderNameHeader = folderNameContainer.createDiv({ cls: 'imgtono-setting-item-info' });
        folderNameHeader.createDiv({ cls: 'imgtono-setting-item-name' }).setText('Processed image folder name');
        folderNameHeader.createDiv({ cls: 'imgtono-setting-item-description' }).setText("Name of the subfolder where processed images will be saved (e.g., 'Images').");

        const folderNameControl = folderNameContainer.createDiv({ cls: 'imgtono-setting-item-control' });
        folderNameInput = new TextComponent(folderNameControl);
        folderNameInput
            .setPlaceholder(DEFAULT_SETTINGS.imageFolderName)
            .setValue(this.plugin.settings.imageFolderName)
            .onChange(async (value) => {
                this.plugin.settings.imageFolderName = value.trim() || DEFAULT_SETTINGS.imageFolderName;
                await this.plugin.saveSettings();
                folderNameInput.setValue(this.plugin.settings.imageFolderName); // Ensure UI reflects the possibly defaulted value
            });
        folderNameInput.inputEl.style.width = '100%';

        const folderNameButtonContainer = folderNameContainer.createDiv({ cls: 'imgtono-setting-button-row' });
        new ButtonComponent(folderNameButtonContainer)
            .setIcon('reset')
            .setButtonText('Reset to default')
            .onClick(async () => {
                this.plugin.settings.imageFolderName = DEFAULT_SETTINGS.imageFolderName;
                folderNameInput.setValue(this.plugin.settings.imageFolderName);
                await this.plugin.saveSettings();
                new Notice('Image folder name reset to default.');
            });
    }

    private createNoteNamingSetting(containerEl: HTMLElement): void {
        // Create the note naming setting with vertical layout
        const noteNamingContainer = containerEl.createDiv({ cls: 'imgtono-vertical-layout-container' });
        
        // Add the setting header (name and description)
        const noteNamingHeader = noteNamingContainer.createDiv({ cls: 'imgtono-setting-item-info' });
        const noteNamingName = noteNamingHeader.createDiv({ cls: 'imgtono-setting-item-name' });
        noteNamingName.setText('Note naming convention');
        const noteNamingDesc = noteNamingHeader.createDiv({ cls: 'imgtono-setting-item-description' });
        noteNamingDesc.setText('How should the new transcription note be named?');
        
        // Add the dropdown below the description
        const noteNamingControl = noteNamingContainer.createDiv({ cls: 'imgtono-setting-item-control' });
        const dropdown = new DropdownComponent(noteNamingControl);
        
        // Use the enum keys for values and provide user-friendly names
        dropdown
            .addOption(NoteNamingOption.FirstLine, 'Use first line of transcription (strips markdown)')
            .addOption(NoteNamingOption.ImageName, 'Use image name (e.g., ImageName.md)')
            .addOption(NoteNamingOption.DateImageName, 'Use date + image name (e.g., YYYYMMDD_ImageName.md)')
            .addOption(NoteNamingOption.FolderDateNum, 'Use folder + date + image name (e.g., Folder_YYYYMMDD_ImageName.md)')
            .setValue(this.plugin.settings.noteNamingOption)
            .onChange(async (value) => {
                this.plugin.settings.noteNamingOption = value as NoteNamingOption;
                await this.plugin.saveSettings();
            });
        dropdown.selectEl.style.width = '100%';
    }

    private createSourceFolderSetting(containerEl: HTMLElement): void {
        const setting = new Setting(containerEl)
            .setName('Transcribe only from a specific folder')
            .setDesc('If enabled, only images added to the selected folder below will be transcribed.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.transcribeOnlySpecificFolder)
                .onChange(async (value) => {
                    this.plugin.settings.transcribeOnlySpecificFolder = value;
                    await this.plugin.saveSettings();
                    this.display(); 
                }));

        if (this.plugin.settings.transcribeOnlySpecificFolder) {
            this.createFolderDropdownSetting(
                containerEl,
                'Folder for transcription',
                'Choose the folder to monitor for new images.',
                this.plugin.settings.specificFolderForTranscription,
                async (value) => {
                    this.plugin.settings.specificFolderForTranscription = value;
                    await this.plugin.saveSettings();
                }
            );
        }
    }
} 