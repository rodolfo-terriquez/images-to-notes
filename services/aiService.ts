import { App, requestUrl, RequestUrlParam, RequestUrlResponse } from 'obsidian';
import { PluginSettings, OpenAiModel, AnthropicModel } from '../models/settings';
import { TranscriptionJob } from '../models/transcriptionJob';
import { NotificationService } from '../ui/notificationService';
import { encodeImageToBase64 } from '../utils/fileUtils';

// Constants for API endpoints and headers
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

export class AIService {
    constructor(
        private settings: PluginSettings,
        private notificationService: NotificationService,
        private app: App
    ) {}

    /**
     * Transcribes an image using the configured AI provider.
     * @param job The transcription job containing the image file.
     * @returns A promise that resolves with the transcription text or null if failed.
     */
    async transcribeImage(job: TranscriptionJob): Promise<string | null> {
        const { file } = job;
        let base64ImageWithPrefix: string;

        // 1. Encode image
        try {
            base64ImageWithPrefix = await encodeImageToBase64(file, this.app);
        } catch (error) {
            this.notificationService.notifyError(`Failed to encode image ${file.name}.`);
            console.error('Image encoding error:', error);
            return null;
        }

        // 2. Determine provider and settings
        const { provider, openaiApiKey, anthropicApiKey, openaiModel, anthropicModel, systemPrompt, userPrompt } = this.settings;
        const imageUrl = base64ImageWithPrefix; // Use the data URI

        // 3. Call appropriate API
        try {
            if (provider === 'openai') {
                if (!openaiApiKey) {
                    this.notificationService.notifyError('OpenAI API key is missing.');
                    return null;
                }
                return await this._transcribeWithOpenAI(imageUrl, systemPrompt, userPrompt, openaiApiKey, openaiModel);
            } else if (provider === 'anthropic') {
                if (!anthropicApiKey) {
                    this.notificationService.notifyError('Anthropic API key is missing.');
                    return null;
                }
                 // Extract base64 data and media type for Anthropic
                const base64Data = imageUrl.split(',')[1];
                const mediaTypeMatch = imageUrl.match(/^data:(image\/[a-z]+);base64,/);
                if (!mediaTypeMatch || !base64Data) {
                    this.notificationService.notifyError('Could not extract image data for Anthropic.');
                    return null;
                }
                const mediaType = mediaTypeMatch[1];
                return await this._transcribeWithAnthropic(base64Data, mediaType, systemPrompt, userPrompt, anthropicApiKey, anthropicModel);
            } else {
                this.notificationService.notifyError(`Unsupported AI provider selected: ${provider}`);
                return null;
            }
        } catch (error: any) {
             // More specific error handling based on caught error
            let errorMessage = `Transcription failed for ${file.name}.`;
            if (error.message) {
                errorMessage += ` Error: ${error.message}`;
            }
            if (error.response?.status) {
                errorMessage += ` Status: ${error.response.status}`;
            }
            this.notificationService.notifyError(errorMessage);
            console.error(`Transcription error for ${file.name}:`, error);
            return null;
        }
    }

    /**
     * Calls the OpenAI API to transcribe the image.
     */
    private async _transcribeWithOpenAI(
        imageUrl: string, // Now expects data URI
        systemPrompt: string,
        userPrompt: string,
        apiKey: string,
        model: OpenAiModel
    ): Promise<string | null> {
        console.log(`Transcribing with OpenAI (${model})...`);

        const requestBody = {
            model: model,
            messages: [
                { role: 'system', content: systemPrompt },
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: userPrompt },
                        {
                            type: 'image_url',
                            image_url: {
                                url: imageUrl,
                            },
                        },
                    ],
                },
            ],
            max_tokens: 4000, // Increased token limit
        };

        const requestParams: RequestUrlParam = {
            url: OPENAI_API_URL,
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
            throw: false, // Prevent requestUrl from throwing on non-2xx status codes
        };

        try {
            const response = await requestUrl(requestParams);
            
            if (response.status >= 200 && response.status < 300) {
                const data = response.json;
                const transcription = data?.choices?.[0]?.message?.content;
                if (transcription) {
                    console.log('OpenAI transcription successful.');
                    return transcription.trim();
                } else {
                    console.error('OpenAI response missing transcription content:', data);
                    throw new Error('Invalid response format from OpenAI.');
                }
            } else {
                 console.error(`OpenAI API Error (${response.status}):`, response.text);
                 let errorDetails = response.json?.error?.message || response.text || `HTTP status ${response.status}`;
                 throw new Error(`OpenAI API error: ${errorDetails}`);
            }
        } catch (error) {
            console.error('Error calling OpenAI API:', error);
            // Re-throw the error to be caught by the main transcribeImage method
            throw error; 
        }
    }

    /**
     * Calls the Anthropic API to transcribe the image.
     */
    private async _transcribeWithAnthropic(
        base64Data: string,
        mediaType: string,
        systemPrompt: string,
        userPrompt: string,
        apiKey: string,
        model: AnthropicModel
    ): Promise<string | null> {
        console.log(`Transcribing with Anthropic (${model})...`);

        const requestBody = {
            model: model,
            max_tokens: 4000, // Increased token limit
            system: systemPrompt,
            messages: [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'image',
                            source: {
                                type: 'base64',
                                media_type: mediaType,
                                data: base64Data,
                            },
                        },
                        { type: 'text', text: userPrompt },
                    ],
                },
            ],
        };

        const requestParams: RequestUrlParam = {
            url: ANTHROPIC_API_URL,
            method: 'POST',
            headers: {
                'x-api-key': apiKey,
                'anthropic-version': ANTHROPIC_VERSION,
                'content-type': 'application/json',
            },
            body: JSON.stringify(requestBody),
            throw: false, // Prevent requestUrl from throwing on non-2xx status codes
        };

        try {
            const response = await requestUrl(requestParams);
            
            if (response.status >= 200 && response.status < 300) {
                 const data = response.json;
                 // Anthropic returns content as an array, find the text block
                 const transcription = data?.content?.find((block: any) => block.type === 'text')?.text;
                if (transcription) {
                    console.log('Anthropic transcription successful.');
                    return transcription.trim();
                } else {
                    console.error('Anthropic response missing transcription content:', data);
                    throw new Error('Invalid response format from Anthropic.');
                }
            } else {
                console.error(`Anthropic API Error (${response.status}):`, response.text);
                let errorDetails = response.json?.error?.message || response.text || `HTTP status ${response.status}`;
                throw new Error(`Anthropic API error: ${errorDetails}`);
            }
        } catch (error) {
            console.error('Error calling Anthropic API:', error);
             // Re-throw the error to be caught by the main transcribeImage method
            throw error; 
        }
    }
} 