import { App, PluginSettingTab, Setting, TextAreaComponent, DropdownComponent, TextComponent } from 'obsidian';
import ImageTranscriberPlugin from '../main'; // Adjust path as needed
import { ApiProvider, OpenAiModel, AnthropicModel } from '../models/settings'; // Import relevant types

// Define available models - These should match the types in settings.ts
const OPENAI_MODELS: Record<OpenAiModel, string> = {
    'gpt-4.1': 'GPT-4.1',
    'gpt-4.1-mini': 'GPT-4.1 Mini',
    'o4-mini': 'o4 Mini',
};

const ANTHROPIC_MODELS: Record<AnthropicModel, string> = {
    'claude-3-5-sonnet-latest': 'Claude 3.5 Sonnet',
    'claude-3-7-sonnet-latest': 'Claude 3.7 Sonnet',
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
        containerEl.createEl('h2', { text: 'Image Transcriber Settings' });

        // --- API Provider ---
        new Setting(containerEl)
            .setName('API Provider')
            .setDesc('Select the AI provider for image transcription.')
            .addDropdown(dropdown => dropdown
                .addOption(ApiProvider.OpenAI, 'OpenAI')
                .addOption(ApiProvider.Anthropic, 'Anthropic')
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
                .setName('OpenAI API Key')
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
                .setName('OpenAI Model')
                .setDesc('Select the OpenAI model to use (ensure it supports vision).')
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
                 providerDesc.createEl('p', { text: '⚠️ OpenAI API Key is required.', cls: 'setting-warning' });
            }

        } else if (this.plugin.settings.provider === ApiProvider.Anthropic) {
            // Anthropic API Key
            new Setting(containerEl)
                .setName('Anthropic API Key')
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
                .setName('Anthropic Model')
                .setDesc('Select the Anthropic model to use (ensure it supports vision).')
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
                 providerDesc.createEl('p', { text: '⚠️ Anthropic API Key is required.', cls: 'setting-warning' });
            }
        }

        // --- System Prompt ---
        new Setting(containerEl)
            .setName('System Prompt')
            .setDesc('The system prompt to guide the AI model\'s behavior (e.g., role, context).')
            .addTextArea(text => {
                text
                    .setPlaceholder('e.g., You are an expert transcriber.')
                    .setValue(this.plugin.settings.systemPrompt)
                    .onChange(async (value) => {
                        this.plugin.settings.systemPrompt = value;
                        await this.plugin.saveSettings();
                    });
                text.inputEl.rows = 4; // Slightly shorter than user prompt
                text.inputEl.style.width = '100%';
            });

        // --- User Prompt (Previously Transcription Prompt) ---
        new Setting(containerEl)
            .setName('User Prompt') // Renamed from Transcription Prompt
            .setDesc('The specific instruction for the AI for this image.') // Updated description
            .addTextArea(text => {
                text
                    .setPlaceholder('e.g., Transcribe the text in this image.')
                    .setValue(this.plugin.settings.userPrompt) // Updated to use userPrompt
                    .onChange(async (value) => {
                        this.plugin.settings.userPrompt = value; // Updated to save to userPrompt
                        await this.plugin.saveSettings();
                    });
                text.inputEl.rows = 6; // Make it taller
                text.inputEl.style.width = '100%'; // Ensure it takes full width
            });

        // --- Note Naming ---
        new Setting(containerEl)
            .setName('Note Naming Convention')
            .setDesc('How should the new transcription note be named?')
            .addDropdown(dropdown => dropdown
                 // Updated descriptions for clarity
                .addOption('false', 'Folder + Date + Image Name (e.g., Folder_YYYYMMDD_ImageName.md)') 
                .addOption('true', 'Use First Line of Transcription')
                .setValue(this.plugin.settings.useFirstLineAsTitle.toString()) // Convert boolean to string for dropdown value
                .onChange(async (value) => {
                    this.plugin.settings.useFirstLineAsTitle = value === 'true'; // Convert string back to boolean
                    await this.plugin.saveSettings();
                }));

        // Add a CSS snippet for the warning text styling (optional, but good UX)
        // This would typically go in styles.css
        /*
        .setting-warning {
            color: var(--text-warning);
            font-size: var(--font-ui-small);
            margin-top: 5px;
        }
        */
    }
} 