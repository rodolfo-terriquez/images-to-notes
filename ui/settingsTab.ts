import { App, PluginSettingTab, Setting, TextAreaComponent, DropdownComponent, TextComponent, Notice } from 'obsidian';
import ImageTranscriberPlugin from '../main'; // Corrected import
import { ApiProvider, OpenAiModel, AnthropicModel, GoogleModel, DEFAULT_SETTINGS, NoteNamingOption } from '../models/settings'; // Import relevant types AND DEFAULTS AND NoteNamingOption

// Define available models - These should match the types in settings.ts
const OPENAI_MODELS: Record<OpenAiModel, string> = {
    'gpt-4.1': 'GPT-4.1',
    'gpt-4.1-mini': 'GPT-4.1 Mini',
    'o4-mini': 'o4 Mini',
};

const ANTHROPIC_MODELS: Record<AnthropicModel, string> = {
    'claude-3-5-sonnet-latest': 'Claude 3.5 Sonnet',
    'claude-3-7-sonnet-latest': 'Claude 3.7 Sonnet',
    'claude-sonnet-4-0': 'Claude Sonnet 4.0',
};

const GOOGLE_MODELS: Record<GoogleModel, string> = {
    'gemini-2.0-flash': 'Gemini 2.0 Flash',
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
                .setValue(this.plugin.settings.provider)
                .onChange(async (value) => {
                    this.plugin.settings.provider = value as ApiProvider;
                    await this.plugin.saveSettings();
                    this.display(); // Re-render the settings tab to show/hide relevant fields
                }));

        // --- Provider Specific Settings ---
        const providerDesc = containerEl.createDiv({ cls: 'provider-settings-desc' }); // Container for descriptions/warnings
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
                 providerDesc.createEl('p', { text: '⚠️ OpenAI API key is required.', cls: 'setting-warning' });
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
                 providerDesc.createEl('p', { text: '⚠️ Anthropic API key is required.', cls: 'setting-warning' });
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
                 providerDesc.createEl('p', { text: '⚠️ Google API key is required.', cls: 'setting-warning' });
            }
        }

        // --- System Prompt ---
        let systemPromptTextArea: TextAreaComponent; // Variable to hold the text area component
        new Setting(containerEl)
            .setName('System prompt')
            .setDesc('The system prompt to guide the AI model\'s behavior (e.g., role, context).')
            .addTextArea(text => {
                systemPromptTextArea = text; // Store the component
                text
                    // .setPlaceholder('e.g., You are an expert transcriber.')
                    .setPlaceholder(DEFAULT_SETTINGS.systemPrompt)
                    .setValue(this.plugin.settings.systemPrompt)
                    .onChange(async (value) => {
                        this.plugin.settings.systemPrompt = value;
                        await this.plugin.saveSettings();
                    });
                text.inputEl.rows = 4; // Slightly shorter than user prompt
            })
            .setClass('settings-textarea-full-width')
            .addButton(button => button // Add reset button (Task 18.5)
                .setIcon('reset')
                .setTooltip('Reset to default')
                .onClick(async () => {
                    if (systemPromptTextArea) {
                        this.plugin.settings.systemPrompt = DEFAULT_SETTINGS.systemPrompt;
                        systemPromptTextArea.setValue(this.plugin.settings.systemPrompt);
                        await this.plugin.saveSettings();
                        new Notice('System prompt reset to default.');
                    }
                }));

        // --- User Prompt (Previously Transcription Prompt) ---
        let userPromptTextArea: TextAreaComponent; // Variable to hold the text area component
        new Setting(containerEl)
            .setName('User prompt') // Renamed from Transcription Prompt
            .setDesc('The specific instruction for the AI for this image.') // Updated description
            .addTextArea(text => {
                userPromptTextArea = text; // Store the component
                text
                    // .setPlaceholder('e.g., Transcribe the text in this image.')
                    .setPlaceholder(DEFAULT_SETTINGS.userPrompt)
                    .setValue(this.plugin.settings.userPrompt) // Updated to use userPrompt
                    .onChange(async (value) => {
                        this.plugin.settings.userPrompt = value; // Updated to save to userPrompt
                        await this.plugin.saveSettings();
                    });
                text.inputEl.rows = 6; // Make it taller
            })
            .setClass('settings-textarea-full-width')
            .addButton(button => button // Add reset button (Task 18.5)
                .setIcon('reset')
                .setTooltip('Reset to default')
                .onClick(async () => {
                    if (userPromptTextArea) {
                        this.plugin.settings.userPrompt = DEFAULT_SETTINGS.userPrompt;
                        userPromptTextArea.setValue(this.plugin.settings.userPrompt);
                        await this.plugin.saveSettings();
                        new Notice('User prompt reset to default.');
                    }
                }));

        // --- Note Naming ---
        new Setting(containerEl)
            .setName('Note naming convention')
            .setDesc('How should the new transcription note be named?')
            .addDropdown(dropdown => {
                dropdown
                    // Use the enum keys for values and provide user-friendly names
                    .addOption(NoteNamingOption.FirstLine, 'Use first line of transcription (strips markdown)')
                    .addOption(NoteNamingOption.ImageName, 'Use image name (e.g., ImageName.md)')
                    .addOption(NoteNamingOption.DateImageName, 'Use date + image name (e.g., YYYYMMDD_ImageName.md)')
                    .addOption(NoteNamingOption.FolderDateNum, 'Use folder + date + image name (e.g., Folder_YYYYMMDD_ImageName.md)')
                    .setValue(this.plugin.settings.noteNamingOption) // Use the enum value directly
                    .onChange(async (value) => {
                        this.plugin.settings.noteNamingOption = value as NoteNamingOption; // Cast the string value back to the enum type
                        await this.plugin.saveSettings();
                    });
            });

        // --- Image Folder Name --- (Task 18.1, 18.2)
        new Setting(containerEl)
            .setName('Image folder name')
            .setDesc('The name of the subfolder within the note\'s directory where processed images will be saved. Leave empty to use the default ("Images").')
            .addText(text => text
                .setPlaceholder(DEFAULT_SETTINGS.imageFolderName) // Default is 'Images'
                .setValue(this.plugin.settings.imageFolderName)
                .onChange(async (value) => {
                    // Use default if empty, otherwise use the provided value
                    this.plugin.settings.imageFolderName = value.trim() || DEFAULT_SETTINGS.imageFolderName;
                    // Reflect the potentially changed value back in the input field if it was trimmed or defaulted
                    text.setValue(this.plugin.settings.imageFolderName);
                    await this.plugin.saveSettings();
                }));

        // Add the new setting toggle
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
} 