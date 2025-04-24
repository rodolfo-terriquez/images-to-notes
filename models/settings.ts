// models/settings.ts
export enum ApiProvider {
    OpenAI = 'openai',
    Anthropic = 'anthropic',
}

// Specific model types for better type safety
export type OpenAiModel = "gpt-4.1" | "gpt-4.1-mini" | "o4-mini"; // Updated OpenAI models
export type AnthropicModel = "claude-3-5-sonnet-latest" | "claude-3-7-sonnet-latest"; // Updated Anthropic models

export enum NoteNamingOption {
    FirstLine = 'first-line',
    FolderDateNum = 'folder-date-num',
}

export interface PluginSettings {
    provider: ApiProvider;
    openaiApiKey: string;
    anthropicApiKey: string;
    openaiModel: OpenAiModel; // Use specific type
    anthropicModel: AnthropicModel; // Use specific type
    systemPrompt: string; // Added system prompt
    userPrompt: string; // Renamed from transcriptionPrompt
    useFirstLineAsTitle: boolean; // Simplified to boolean based on NoteNamingOption
    // Add any other settings identified in PRD Section 4.3 if available
}

export const DEFAULT_SETTINGS: PluginSettings = {
    provider: ApiProvider.OpenAI,
    openaiApiKey: '',
    anthropicApiKey: '',
    openaiModel: 'gpt-4.1-mini', // Updated default OpenAI model
    anthropicModel: 'claude-3-7-sonnet-latest', // Updated default Anthropic model
    systemPrompt: 'You are an AI assistant specialized in transcribing text from images.', // Added default system prompt
    userPrompt: 'Transcribe the text content visible in this image.', // Renamed from transcriptionPrompt
    useFirstLineAsTitle: false, // Default to FolderDateNum naming
}; 