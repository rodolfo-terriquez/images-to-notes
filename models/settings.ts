// models/settings.ts
export enum ApiProvider {
	OpenAI = "openai",
	Anthropic = "anthropic",
	Google = "google",
	Mistral = "mistral",
	OpenAICompatible = "openai-compatible",
	GitHubCopilot = "github-copilot",
}

// Specific model types for better type safety
export type OpenAiModel =
	| "gpt-5.6-sol"
	| "gpt-5.6-terra"
	| "gpt-5.6-luna"
	| "gpt-5.4-nano"
	| "gpt-5.5"
	| "gpt-5.4"
	| "gpt-5.4-mini"
	| "gpt-4o"
	| "gpt-4o-mini"
	| "custom";
export type AnthropicModel =
	| "claude-fable-5"
	| "claude-opus-5"
	| "claude-sonnet-5"
	| "claude-opus-4-7"
	| "claude-sonnet-4-6"
	| "claude-haiku-4-5"
	| "custom";
export type GoogleModel =
	| "gemini-3.6-flash"
	| "gemini-3.5-flash"
	| "gemini-3.5-flash-lite"
	| "gemini-3.1-pro-preview"
	| "gemini-3-flash-preview"
	| "gemini-3.1-flash-lite"
	| "gemini-2.5-pro"
	| "gemini-2.5-flash"
	| "gemini-2.5-flash-lite"
	| "custom";
export type MistralModel =
	| "mistral-medium-3-5"
	| "mistral-small-2603"
	| "mistral-large-2512"
	| "mistral-medium-2508"
	| "ministral-14b-2512"
	| "ministral-8b-2512"
	| "ministral-3b-2512"
	| "custom";
export type CopilotModel = string;

export enum NoteNamingOption {
	FirstLine = "first-line",
	ImageName = "image-name",
	DateImageName = "date-image-name",
	FolderDateNum = "folder-date-num",
}

export enum TranscriptionPlacement {
	AboveImage = "above",
	BelowImage = "below",
}

export interface PluginSettings {
	provider: ApiProvider;
	openaiApiKey: string;
	openaiBaseUrl: string; // Add this line
	anthropicApiKey: string;
	googleApiKey: string;
	mistralApiKey: string;
	openaiModel: OpenAiModel; // Use specific type
	openaiCustomModel: string; // Custom model name for OpenAI
	anthropicModel: AnthropicModel; // Use specific type
	anthropicCustomModel: string; // Custom model name for Anthropic
	googleModel: GoogleModel; // Use specific type
	googleCustomModel: string; // Custom model name for Google
	mistralModel: MistralModel;
	mistralCustomModel: string; // Custom model name for Mistral
	// OpenAI-compatible endpoint settings (for vLLM, LM Studio, Ollama, etc.)
	openaiCompatibleEndpoint: string; // The base URL for the OpenAI-compatible API
	openaiCompatibleApiKey: string; // Optional API key (some servers don't require it)
	openaiCompatibleModel: string; // The model name to use
	// GitHub Copilot settings
	copilotModel: CopilotModel; // Selected Copilot model
	copilotCustomModel: string; // Custom model name for Copilot
	copilotOAuthToken: string; // GitHub OAuth token from device flow
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
	imageDestinationOption: "subfolder" | "specificFolder";
	specificImageFolderPath: string;
	noteDestinationOption: "alongside" | "specificFolder";
	specificNoteFolderPath: string;

	// Note content settings
	includeImageInNote: boolean; // Whether to include the image link in the note
	transcriptionPlacement: TranscriptionPlacement;
}

export const DEFAULT_SETTINGS: PluginSettings = {
	provider: ApiProvider.OpenAI,
	openaiApiKey: "",
	openaiBaseUrl: "https://api.openai.com", // Add this line
	anthropicApiKey: "",
	googleApiKey: "",
	mistralApiKey: "",
	openaiModel: "gpt-5.4-mini",
	openaiCustomModel: "",
	anthropicModel: "claude-sonnet-4-6",
	anthropicCustomModel: "",
	googleModel: "gemini-2.5-flash",
	googleCustomModel: "",
	mistralModel: "mistral-medium-3-5",
	mistralCustomModel: "", // Custom model name for Mistral
	// OpenAI-compatible endpoint defaults
	openaiCompatibleEndpoint: "http://localhost:1234/v1", // Default LM Studio endpoint
	openaiCompatibleApiKey: "", // Optional, many local servers don't require it
	openaiCompatibleModel: "", // User must specify the model name
	// GitHub Copilot defaults
	copilotModel: "gpt-4o",
	copilotCustomModel: "",
	copilotOAuthToken: "",
	systemPrompt:
		"You are an expert at transcribing handwritten notes and typed text from images. Convert the image content to clean markdown format, preserving the structure and organization of the original notes.", // Updated default system prompt (Task 18.3)
	userPrompt:
		"Please transcribe all text visible in this image into markdown format. Preserve the structure, headings, lists, and any other formatting from the original text. If you detect any diagrams. Analyze each one. Use the surrounding context to understand what the diagram is likely about  Replace the diagram with a well-structured explanation of the content the diagram is trying to convey. Preserve all the diagram's educational value. Place your explanation within the rest of the markdown, in its appropriate order. Use the same language in your explanation as the rest of the markdown. Do not describe the diagram, explain its content with words. Do not mention that you're describing content from a diagram, simply include it within the rest of the text with an appropriate heading. The reader will not have access to the diagram, so do not make any references to it. Do not add any mention or indication that the transcript is in markdown format at the beginning of the document.", // Updated default user prompt (Task 18.4)
	noteNamingOption: NoteNamingOption.ImageName,
	imageFolderName: "Images", // Default image folder name (Task 18.2)
	processedImagePaths: [], // Initialize as empty array
	verboseNotifications: false,
	// Mobile optimization default settings
	mobileOptimizationEnabled: true, // Enable mobile optimizations by default
	imageQuality: 90, // Default image quality (1-100)
	maxConcurrentProcessing: 2, // Default max concurrent processing jobs
	transcribeOnlySpecificFolder: false, // Default for new setting
	specificFolderForTranscription: "", // Default for new setting

	// Output destination defaults
	imageDestinationOption: "subfolder",
	specificImageFolderPath: "",
	noteDestinationOption: "alongside",
	specificNoteFolderPath: "",

	// Note content defaults
	includeImageInNote: true, // Include image by default (user can toggle off)
	transcriptionPlacement: TranscriptionPlacement.AboveImage,
};
