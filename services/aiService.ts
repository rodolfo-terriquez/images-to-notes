import { App, requestUrl, RequestUrlParam, RequestUrlResponse, TFile } from "obsidian";
import {
	PluginSettings,
	OpenAiModel,
	AnthropicModel,
	GoogleModel,
	MistralModel,
	CopilotModel,
} from "../models/settings";
import { CopilotService } from "./copilotService";
import { NotificationService } from "../ui/notificationService";
import { encodeImageToBase64 } from "../utils/fileUtils";

// Constants for API endpoints and headers
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const GOOGLE_API_URL_V1 = "https://generativelanguage.googleapis.com/v1/models";
const GOOGLE_API_URL_V1BETA = "https://generativelanguage.googleapis.com/v1beta/models";
const MISTRAL_API_URL = "https://api.mistral.ai/v1/chat/completions";

export class AIService {
	constructor(
		private settings: PluginSettings,
		private notificationService: NotificationService,
		private app: App,
		private copilotService: CopilotService,
	) {}

	/**
	 * Transcribes an image using the configured AI provider.
	 * @param file The image file to transcribe (after potential conversion/compression).
	 * @returns A promise that resolves with the transcription text or null if failed.
	 */
	async transcribeImage(file: TFile): Promise<string | null> {
		let base64ImageWithPrefix: string;

		// 1. Encode image
		try {
			base64ImageWithPrefix = await encodeImageToBase64(file, this.app);
		} catch (error) {
			this.notificationService.notifyError(`Failed to encode image ${file.name}.`);
			console.error("Image encoding error:", error);
			return null;
		}

		// 2. Determine provider and settings
		const {
			provider,
			openaiApiKey,
			anthropicApiKey,
			googleApiKey,
			mistralApiKey,
			openaiModel,
			anthropicModel,
			googleModel,
			mistralModel,
			openaiCustomModel,
			anthropicCustomModel,
			googleCustomModel,
			mistralCustomModel,
			openaiCompatibleEndpoint,
			openaiCompatibleApiKey,
			openaiCompatibleModel,
			systemPrompt,
			userPrompt,
			openaiBaseUrl,
		} = this.settings;
		const imageUrl = base64ImageWithPrefix; // Use the data URI

		// Resolve custom model names
		const resolvedOpenAiModel = openaiModel === "custom" ? openaiCustomModel : openaiModel;
		const resolvedAnthropicModel =
			anthropicModel === "custom" ? anthropicCustomModel : anthropicModel;
		const resolvedGoogleModel = googleModel === "custom" ? googleCustomModel : googleModel;
		const resolvedMistralModel = mistralModel === "custom" ? mistralCustomModel : mistralModel;

		// 3. Call appropriate API
		try {
			if (provider === "openai") {
				if (!openaiApiKey) {
					this.notificationService.notifyError("OpenAI API key is missing.");
					return null;
				}
				if (!resolvedOpenAiModel) {
					this.notificationService.notifyError(
						"OpenAI model is not configured. Please enter a custom model name.",
					);
					return null;
				}
				return await this._transcribeWithOpenAI(
					imageUrl,
					systemPrompt,
					userPrompt,
					openaiApiKey,
					resolvedOpenAiModel,
					openaiBaseUrl,
				);
			} else if (provider === "anthropic") {
				if (!anthropicApiKey) {
					this.notificationService.notifyError("Anthropic API key is missing.");
					return null;
				}
				if (!resolvedAnthropicModel) {
					this.notificationService.notifyError(
						"Anthropic model is not configured. Please enter a custom model name.",
					);
					return null;
				}
				// Extract base64 data and media type for Anthropic
				const base64Data = imageUrl.split(",")[1];
				const mediaTypeMatch = imageUrl.match(/^data:(image\/[a-z]+);base64,/);
				if (!mediaTypeMatch || !base64Data) {
					this.notificationService.notifyError(
						"Could not extract image data for Anthropic.",
					);
					return null;
				}
				const mediaType = mediaTypeMatch[1];
				return await this._transcribeWithAnthropic(
					base64Data,
					mediaType,
					systemPrompt,
					userPrompt,
					anthropicApiKey,
					resolvedAnthropicModel,
				);
			} else if (provider === "google") {
				if (!googleApiKey) {
					this.notificationService.notifyError("Google API key is missing.");
					return null;
				}
				if (!resolvedGoogleModel) {
					this.notificationService.notifyError(
						"Google model is not configured. Please enter a custom model name.",
					);
					return null;
				}
				// Extract base64 data for Google
				const base64Data = imageUrl.split(",")[1];
				const mediaTypeMatch = imageUrl.match(/^data:(image\/[a-z]+);base64,/);
				if (!mediaTypeMatch || !base64Data) {
					this.notificationService.notifyError(
						"Could not extract image data for Google.",
					);
					return null;
				}
				const mediaType = mediaTypeMatch[1];
				return await this._transcribeWithGoogle(
					base64Data,
					mediaType,
					systemPrompt,
					userPrompt,
					googleApiKey,
					resolvedGoogleModel,
				);
			} else if (provider === "mistral") {
				if (!mistralApiKey) {
					this.notificationService.notifyError("Mistral API key is missing.");
					return null;
				}
				if (!resolvedMistralModel) {
					this.notificationService.notifyError(
						"Mistral model is not configured. Please enter a custom model name.",
					);
					return null;
				}
				return await this._transcribeWithMistral(
					imageUrl,
					systemPrompt,
					userPrompt,
					mistralApiKey,
					resolvedMistralModel,
				);
			} else if (provider === "openai-compatible") {
				if (!openaiCompatibleEndpoint) {
					this.notificationService.notifyError(
						"OpenAI-compatible endpoint URL is not configured.",
					);
					return null;
				}
				if (!openaiCompatibleModel) {
					this.notificationService.notifyError(
						"OpenAI-compatible model name is not configured.",
					);
					return null;
				}
				return await this._transcribeWithOpenAI(
					imageUrl,
					systemPrompt,
					userPrompt,
					openaiCompatibleApiKey || "not-required", // Some servers need a non-empty key
					openaiCompatibleModel,
					openaiCompatibleEndpoint,
				);
			} else if (provider === "github-copilot") {
				const { copilotOAuthToken, copilotModel, copilotCustomModel } = this.settings;
				if (!copilotOAuthToken) {
					this.notificationService.notifyError(
						"GitHub Copilot is not authenticated. Please log in via the plugin settings.",
					);
					return null;
				}
				const resolvedCopilotModel =
					copilotModel === "custom" ? copilotCustomModel : copilotModel;
				if (!resolvedCopilotModel) {
					this.notificationService.notifyError(
						"GitHub Copilot model is not configured. Please select a model or enter a custom model name.",
					);
					return null;
				}
				return await this._transcribeWithCopilot(
					imageUrl,
					systemPrompt,
					userPrompt,
					copilotOAuthToken,
					resolvedCopilotModel,
				);
			} else {
				this.notificationService.notifyError(
					`Unsupported AI provider selected: ${provider}`,
				);
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
	 * Checks if an OpenAI model requires the newer max_completion_tokens parameter
	 * instead of the deprecated max_tokens parameter.
	 * Newer models (GPT-5, o-series, etc.) use max_completion_tokens.
	 */
	private _useMaxCompletionTokens(model: string): boolean {
		const lowerModel = model.toLowerCase();
		// Models that require max_completion_tokens:
		// - o1, o3, o4 series (reasoning models)
		// - GPT-5 and newer
		// - Any model with version >= 5
		return (
			lowerModel.startsWith("o1") ||
			lowerModel.startsWith("o3") ||
			lowerModel.startsWith("o4") ||
			lowerModel.startsWith("gpt-5") ||
			lowerModel.includes("gpt-5")
		);
	}

	/**
	 * Calls the OpenAI API to transcribe the image.
	 */
	private async _transcribeWithOpenAI(
		imageUrl: string, // Now expects data URI
		systemPrompt: string,
		userPrompt: string,
		apiKey: string,
		model: string,
		baseUrl: string,
	): Promise<string | null> {
		// console.log(`Transcribing with OpenAI (${model})...`);
		this.notificationService.notifyVerbose(`Sending image to OpenAI (${model})...`);
		const startTime = Date.now();

		// Determine which token limit parameter to use based on the model
		// Newer models (GPT-5, o-series) use max_completion_tokens instead of max_tokens
		const tokenLimitParam = this._useMaxCompletionTokens(model)
			? { max_completion_tokens: 4000 }
			: { max_tokens: 4000 };

		const requestBody = {
			model: model,
			messages: [
				{ role: "system", content: systemPrompt },
				{
					role: "user",
					content: [
						{ type: "text", text: userPrompt },
						{
							type: "image_url",
							image_url: {
								url: imageUrl,
							},
						},
					],
				},
			],
			...tokenLimitParam,
		};

		const requestParams: RequestUrlParam = {
			url: `${baseUrl}/v1/chat/completions`,
			method: "POST",
			headers: {
				Authorization: `Bearer ${apiKey}`,
				"Content-Type": "application/json",
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
					// console.log('OpenAI transcription successful.');
					const endTime = Date.now();
					this.notificationService.notifyVerbose(
						`OpenAI Response received (${(endTime - startTime) / 1000}s).`,
					);
					return transcription.trim();
				} else {
					console.error("OpenAI response missing transcription content:", data);
					throw new Error("Invalid response format from OpenAI.");
				}
			} else {
				console.error(`OpenAI API Error (${response.status}):`, response.text);
				let errorDetails =
					response.json?.error?.message ||
					response.text ||
					`HTTP status ${response.status}`;
				throw new Error(`OpenAI API error: ${errorDetails}`);
			}
		} catch (error) {
			console.error("Error calling OpenAI API:", error);
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
		model: string,
	): Promise<string | null> {
		// console.log(`Transcribing with Anthropic (${model})...`);
		this.notificationService.notifyVerbose(`Sending image to Anthropic (${model})...`);
		const startTime = Date.now();

		const requestBody = {
			model: model,
			max_tokens: 4000, // Increased token limit
			system: systemPrompt,
			messages: [
				{
					role: "user",
					content: [
						{
							type: "image",
							source: {
								type: "base64",
								media_type: mediaType,
								data: base64Data,
							},
						},
						{ type: "text", text: userPrompt },
					],
				},
			],
		};

		const requestParams: RequestUrlParam = {
			url: ANTHROPIC_API_URL,
			method: "POST",
			headers: {
				"x-api-key": apiKey,
				"anthropic-version": ANTHROPIC_VERSION,
				"content-type": "application/json",
			},
			body: JSON.stringify(requestBody),
			throw: false, // Prevent requestUrl from throwing on non-2xx status codes
		};

		try {
			const response = await requestUrl(requestParams);

			if (response.status >= 200 && response.status < 300) {
				const data = response.json;
				// Anthropic returns content as an array, find the text block
				const transcription = data?.content?.find(
					(block: any) => block.type === "text",
				)?.text;
				if (transcription) {
					// console.log('Anthropic transcription successful.');
					const endTime = Date.now();
					this.notificationService.notifyVerbose(
						`Anthropic Response received (${(endTime - startTime) / 1000}s).`,
					);
					return transcription.trim();
				} else {
					console.error("Anthropic response missing transcription content:", data);
					throw new Error("Invalid response format from Anthropic.");
				}
			} else {
				console.error(`Anthropic API Error (${response.status}):`, response.text);
				let errorDetails =
					response.json?.error?.message ||
					response.text ||
					`HTTP status ${response.status}`;
				throw new Error(`Anthropic API error: ${errorDetails}`);
			}
		} catch (error) {
			console.error("Error calling Anthropic API:", error);
			// Re-throw the error to be caught by the main transcribeImage method
			throw error;
		}
	}

	/**
	 * Determines if a Google model requires the v1beta API endpoint.
	 * Preview and experimental models are only available on v1beta.
	 */
	private _useGoogleV1Beta(model: string): boolean {
		const lowerModel = model.toLowerCase();
		// Models that require v1beta API:
		// - Preview models (contain "preview" in name)
		// - Experimental models (contain "exp" in name)
		// - Gemini 2.0+ flash thinking models
		// - Gemini 3.x models (newer generation)
		return (
			lowerModel.includes("preview") ||
			lowerModel.includes("exp") ||
			lowerModel.includes("thinking") ||
			lowerModel.startsWith("gemini-3") ||
			lowerModel.includes("gemini-3")
		);
	}

	/**
	 * Calls the Google Gemini API to transcribe the image.
	 */
	private async _transcribeWithGoogle(
		base64Data: string,
		mediaType: string,
		systemPrompt: string,
		userPrompt: string,
		apiKey: string,
		model: string,
	): Promise<string | null> {
		this.notificationService.notifyVerbose(`Sending image to Google Gemini (${model})...`);
		const startTime = Date.now();

		const requestBody = {
			contents: [
				{
					parts: [
						{ text: `${systemPrompt}\n\n${userPrompt}` },
						{
							inline_data: {
								mime_type: mediaType,
								data: base64Data,
							},
						},
					],
				},
			],
			generationConfig: {
				maxOutputTokens: 4000,
			},
		};

		// Use v1beta API for preview/experimental models, v1 for stable models
		const googleApiUrl = this._useGoogleV1Beta(model) ? GOOGLE_API_URL_V1BETA : GOOGLE_API_URL_V1;

		const requestParams: RequestUrlParam = {
			url: `${googleApiUrl}/${model}:generateContent?key=${apiKey}`,
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(requestBody),
			throw: false, // Prevent requestUrl from throwing on non-2xx status codes
		};

		try {
			const response = await requestUrl(requestParams);

			if (response.status >= 200 && response.status < 300) {
				const data = response.json;
				const transcription = data?.candidates?.[0]?.content?.parts?.[0]?.text;
				if (transcription) {
					const endTime = Date.now();
					this.notificationService.notifyVerbose(
						`Google Gemini Response received (${(endTime - startTime) / 1000}s).`,
					);
					return transcription.trim();
				} else {
					console.error("Google Gemini response missing transcription content:", data);
					throw new Error("Invalid response format from Google Gemini.");
				}
			} else {
				console.error(`Google Gemini API Error (${response.status}):`, response.text);
				let errorDetails =
					response.json?.error?.message ||
					response.text ||
					`HTTP status ${response.status}`;
				throw new Error(`Google Gemini API error: ${errorDetails}`);
			}
		} catch (error) {
			console.error("Error calling Google Gemini API:", error);
			// Re-throw the error to be caught by the main transcribeImage method
			throw error;
		}
	}

	/**
	 * Calls the Mistral API to transcribe the image.
	 */
	private async _transcribeWithMistral(
		imageUrl: string, // Expects data URI
		systemPrompt: string,
		userPrompt: string,
		apiKey: string,
		model: string,
	): Promise<string | null> {
		this.notificationService.notifyVerbose(`Sending image to Mistral (${model})...`);
		const startTime = Date.now();

		const requestBody = {
			model: model,
			messages: [
				{ role: "system", content: systemPrompt },
				{
					role: "user",
					content: [
						{ type: "text", text: userPrompt },
						{
							type: "image_url",
							image_url: {
								url: imageUrl,
							},
						},
					],
				},
			],
			max_tokens: 4000,
		};

		const requestParams: RequestUrlParam = {
			url: MISTRAL_API_URL,
			method: "POST",
			headers: {
				Authorization: `Bearer ${apiKey}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify(requestBody),
			throw: false,
		};

		try {
			const response = await requestUrl(requestParams);

			if (response.status >= 200 && response.status < 300) {
				const data = response.json;
				const transcription = data?.choices?.[0]?.message?.content;
				if (transcription) {
					const endTime = Date.now();
					this.notificationService.notifyVerbose(
						`Mistral Response received (${(endTime - startTime) / 1000}s).`,
					);
					return transcription.trim();
				} else {
					console.error("Mistral response missing transcription content:", data);
					throw new Error("Invalid response format from Mistral.");
				}
			} else {
				console.error(`Mistral API Error (${response.status}):`, response.text);
				let errorDetails =
					response.json?.error?.message ||
					response.text ||
					`HTTP status ${response.status}`;
				throw new Error(`Mistral API error: ${errorDetails}`);
			}
		} catch (error) {
			console.error("Error calling Mistral API:", error);
			throw error;
		}
	}

	/**
	 * Transcribe an image using GitHub Copilot API.
	 * Uses the CopilotService for OAuth token management and API calls.
	 */
	private async _transcribeWithCopilot(
		imageUrl: string, // data URI
		systemPrompt: string,
		userPrompt: string,
		oauthToken: string,
		model: string,
	): Promise<string | null> {
		this.notificationService.notifyVerbose(`Sending image to GitHub Copilot (${model})...`);
		const startTime = Date.now();

		const messages = [
			{ role: "system", content: systemPrompt },
			{
				role: "user",
				content: [
					{ type: "text", text: userPrompt },
					{
						type: "image_url",
						image_url: {
							url: imageUrl,
						},
					},
				],
			},
		];

		try {
			const transcription = await this.copilotService.chatCompletion(
				oauthToken,
				model,
				messages,
				4000,
			);

			if (transcription) {
				const endTime = Date.now();
				this.notificationService.notifyVerbose(
					`Copilot response received (${(endTime - startTime) / 1000}s).`,
				);
				return transcription;
			} else {
				throw new Error("Invalid response format from Copilot API.");
			}
		} catch (error) {
			console.error("Error calling Copilot API:", error);
			throw error;
		}
	}
}
