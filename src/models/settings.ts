import { TranscriptionProvider } from './transcriptionProvider';

export interface PluginSettings {
    provider: TranscriptionProvider;
    openaiApiKey: string;
    anthropicApiKey: string;
    openaiModel: string;
    anthropicModel: string;
    systemPrompt: string;
    userPrompt: string;
    useFirstLineAsTitle: boolean;
    imagesFolderName: string;
    processedImagePaths: string[];
}

export const DEFAULT_SYSTEM_PROMPT =
    'You are an expert at transcribing handwritten notes and typed text from images. Convert the image content to clean markdown format, preserving the structure and organization of the original notes.';
export const DEFAULT_USER_PROMPT =
    'Please transcribe all text visible in this image into markdown format. Preserve the structure, headings, lists, and any other formatting from the original text. If you detect any diagrams. Analyze each one. Use the surrounding context to understand what the diagram is likely about  Replace the diagram with a well-structured explanation of the content the diagram is trying to convey. Preserve all the diagram\'s educational value. Place your explanation within the rest of the markdown, in its appropriate order. Use the same language in your explanation as the rest of the markdown. Do not describe the diagram, explain its content with words. Do not mention that you\'re describing content from a diagram, simply include it within the rest of the text with an appropriate heading. The reader will not have access to the diagram, so do not make any references to it. Do not add any mention or indication that the transcript is in markdown format at the beginning of the document.';

export const DEFAULT_SETTINGS: PluginSettings = {
    provider: TranscriptionProvider.OpenAI,
    openaiApiKey: '',
    anthropicApiKey: '',
    openaiModel: 'gpt-4o',
    anthropicModel: 'claude-3-haiku-20240307',
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    userPrompt: DEFAULT_USER_PROMPT,
    useFirstLineAsTitle: true,
    imagesFolderName: 'Images',
    processedImagePaths: [],
};
