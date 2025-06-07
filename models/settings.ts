// models/settings.ts
export enum ApiProvider {
    OpenAI = 'openai',
    Anthropic = 'anthropic',
    Google = 'google',
}

// Specific model types for better type safety
export type OpenAiModel = "gpt-4.1" | "gpt-4.1-mini" | "o4-mini";
export type AnthropicModel = "claude-3-5-sonnet-latest" | "claude-3-7-sonnet-latest" | "claude-sonnet-4-0";
export type GoogleModel = "gemini-2.0-flash";

export enum NoteNamingOption {
    FirstLine = 'first-line',
    ImageName = 'image-name',
    DateImageName = 'date-image-name',
    FolderDateNum = 'folder-date-num',
}

export interface PluginSettings {
    provider: ApiProvider;
    openaiApiKey: string;
    anthropicApiKey: string;
    googleApiKey: string;
    openaiModel: OpenAiModel; // Use specific type
    anthropicModel: AnthropicModel; // Use specific type
    googleModel: GoogleModel; // Use specific type
    systemPrompt: string; // Added system prompt
    userPrompt: string; // Renamed from transcriptionPrompt
    noteNamingOption: NoteNamingOption;
    imageFolderName: string; // Added setting for the image folder name
    processedImagePaths: string[]; // Added to track processed images
    verboseNotifications: boolean;
    // Mobile optimization settings
    mobileOptimizationEnabled: boolean; // Whether mobile optimizations are enabled
    imageQuality: number; // Image quality for compression (1-100)
    maxConcurrentProcessing: number; // Maximum number of concurrent processing jobs
    // Add any other settings identified in PRD Section 4.3 if available
    transcribeOnlySpecificFolder: boolean; // New setting
    specificFolderForTranscription: string; // New setting

    // Output destination settings
    imageDestinationOption: 'subfolder' | 'specificFolder';
    specificImageFolderPath: string;
    noteDestinationOption: 'alongside' | 'specificFolder';
    specificNoteFolderPath: string;
}

export const DEFAULT_SETTINGS: PluginSettings = {
    provider: ApiProvider.OpenAI,
    openaiApiKey: '',
    anthropicApiKey: '',
    googleApiKey: '',
    openaiModel: 'gpt-4.1-mini', // Updated default OpenAI model
    anthropicModel: 'claude-3-7-sonnet-latest', // Updated default Anthropic model
    googleModel: 'gemini-2.0-flash', // Default Google model
    systemPrompt: 'You are an expert at transcribing handwritten notes and typed text from images. Convert the image content to clean markdown format, preserving the structure and organization of the original notes.', // Updated default system prompt (Task 18.3)
    userPrompt: 'Please transcribe all text visible in this image into markdown format. Preserve the structure, headings, lists, and any other formatting from the original text. If you detect any diagrams. Analyze each one. Use the surrounding context to understand what the diagram is likely about  Replace the diagram with a well-structured explanation of the content the diagram is trying to convey. Preserve all the diagram\'s educational value. Place your explanation within the rest of the markdown, in its appropriate order. Use the same language in your explanation as the rest of the markdown. Do not describe the diagram, explain its content with words. Do not mention that you\'re describing content from a diagram, simply include it within the rest of the text with an appropriate heading. The reader will not have access to the diagram, so do not make any references to it. Do not add any mention or indication that the transcript is in markdown format at the beginning of the document.', // Updated default user prompt (Task 18.4)
    noteNamingOption: NoteNamingOption.ImageName,
    imageFolderName: 'Images', // Default image folder name (Task 18.2)
    processedImagePaths: [], // Initialize as empty array
    verboseNotifications: false,
    // Mobile optimization default settings
    mobileOptimizationEnabled: true, // Enable mobile optimizations by default
    imageQuality: 90, // Default image quality (1-100)
    maxConcurrentProcessing: 2, // Default max concurrent processing jobs
    transcribeOnlySpecificFolder: false, // Default for new setting
    specificFolderForTranscription: '', // Default for new setting

    // Output destination defaults
    imageDestinationOption: 'subfolder',
    specificImageFolderPath: '',
    noteDestinationOption: 'alongside',
    specificNoteFolderPath: '',
}; 