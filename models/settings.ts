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
    imageFolderName: string; // Added setting for the image folder name
    processedImagePaths: string[]; // Added to track processed images
    verboseNotifications: boolean;
    // Add any other settings identified in PRD Section 4.3 if available
}

export const DEFAULT_SETTINGS: PluginSettings = {
    provider: ApiProvider.OpenAI,
    openaiApiKey: '',
    anthropicApiKey: '',
    openaiModel: 'gpt-4.1-mini', // Updated default OpenAI model
    anthropicModel: 'claude-3-7-sonnet-latest', // Updated default Anthropic model
    systemPrompt: 'You are an expert at transcribing handwritten notes and typed text from images. Convert the image content to clean markdown format, preserving the structure and organization of the original notes.', // Updated default system prompt (Task 18.3)
    userPrompt: 'Please transcribe all text visible in this image into markdown format. Preserve the structure, headings, lists, and any other formatting from the original text. If you detect any diagrams. Analyze each one. Use the surrounding context to understand what the diagram is likely about  Replace the diagram with a well-structured explanation of the content the diagram is trying to convey. Preserve all the diagram\'s educational value. Place your explanation within the rest of the markdown, in its appropriate order. Use the same language in your explanation as the rest of the markdown. Do not describe the diagram, explain its content with words. Do not mention that you\'re describing content from a diagram, simply include it within the rest of the text with an appropriate heading. The reader will not have access to the diagram, so do not make any references to it. Do not add any mention or indication that the transcript is in markdown format at the beginning of the document.', // Updated default user prompt (Task 18.4)
    useFirstLineAsTitle: false, // Default to FolderDateNum naming
    imageFolderName: 'Images', // Default image folder name (Task 18.2)
    processedImagePaths: [], // Initialize as empty array
    verboseNotifications: false,
}; 