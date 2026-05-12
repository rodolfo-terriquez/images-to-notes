import { App, requestUrl, RequestUrlParam, TFile } from "obsidian";
import { PluginSettings, ApiProvider } from "../models/settings";
import { CopilotService, type CopilotChatMessage } from "./copilotService";
import { NotificationService } from "../ui/notificationService";
import { encodeImageToBase64 } from "../utils/fileUtils";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const GOOGLE_API_URL_V1 = "https://generativelanguage.googleapis.com/v1/models";
const GOOGLE_API_URL_V1BETA = "https://generativelanguage.googleapis.com/v1beta/models";
const MISTRAL_API_URL = "https://api.mistral.ai/v1/chat/completions";

interface ServiceErrorLike {
	message?: string;
	response?: {
		status?: number;
	};
}

interface ApiErrorResponse {
	error?: {
		message?: string;
	};
}

interface OpenAiLikeResponse extends ApiErrorResponse {
	choices?: Array<{
		message?: {
			content?: string;
		};
	}>;
}

interface AnthropicContentBlock {
	type?: string;
	text?: string;
}

interface AnthropicResponse extends ApiErrorResponse {
	content?: AnthropicContentBlock[];
}

interface GoogleResponse extends ApiErrorResponse {
	candidates?: Array<{
		content?: {
			parts?: Array<{
				text?: string;
			}>;
		};
	}>;
}

export class AIService {
	constructor(
		private settings: PluginSettings,
		private notificationService: NotificationService,
		private app: App,
		private copilotService: CopilotService,
	) {}

	async transcribeImage(file: TFile): Promise<string | null> {
		let base64ImageWithPrefix: string;

		try {
			base64ImageWithPrefix = await encodeImageToBase64(file, this.app);
		} catch {
			this.notificationService.notifyError(`Failed to encode image ${file.name}.`);
			return null;
		}

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
		const imageUrl = base64ImageWithPrefix;

		const resolvedOpenAiModel = openaiModel === "custom" ? openaiCustomModel : openaiModel;
		const resolvedAnthropicModel =
			anthropicModel === "custom" ? anthropicCustomModel : anthropicModel;
		const resolvedGoogleModel = googleModel === "custom" ? googleCustomModel : googleModel;
		const resolvedMistralModel = mistralModel === "custom" ? mistralCustomModel : mistralModel;

		try {
			switch (provider) {
				case ApiProvider.OpenAI:
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

				case ApiProvider.Anthropic: {
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
					const extractedImageData = this.extractBase64ImageParts(
						imageUrl,
						"Anthropic",
					);
					if (!extractedImageData) {
						return null;
					}
					return await this._transcribeWithAnthropic(
						extractedImageData.base64Data,
						extractedImageData.mediaType,
						systemPrompt,
						userPrompt,
						anthropicApiKey,
						resolvedAnthropicModel,
					);
				}

				case ApiProvider.Google: {
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
					const extractedImageData = this.extractBase64ImageParts(imageUrl, "Google");
					if (!extractedImageData) {
						return null;
					}
					return await this._transcribeWithGoogle(
						extractedImageData.base64Data,
						extractedImageData.mediaType,
						systemPrompt,
						userPrompt,
						googleApiKey,
						resolvedGoogleModel,
					);
				}

				case ApiProvider.Mistral:
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

				case ApiProvider.OpenAICompatible:
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
						openaiCompatibleApiKey || "not-required",
						openaiCompatibleModel,
						openaiCompatibleEndpoint,
					);

				case ApiProvider.GitHubCopilot: {
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
				}
			}
		} catch (error: unknown) {
			const serviceError = error as ServiceErrorLike;
			let errorMessage = `Transcription failed for ${file.name}.`;
			if (serviceError.message) {
				errorMessage += ` Error: ${serviceError.message}`;
			}
			if (serviceError.response?.status) {
				errorMessage += ` Status: ${serviceError.response.status}`;
			}
			this.notificationService.notifyError(errorMessage);
			return null;
		}
	}

	private extractBase64ImageParts(
		imageUrl: string,
		providerName: string,
	): { base64Data: string; mediaType: string } | null {
		const base64Data = imageUrl.split(",")[1];
		const mediaTypeMatch = imageUrl.match(/^data:(image\/[a-z]+);base64,/);
		if (!mediaTypeMatch || !base64Data) {
			this.notificationService.notifyError(
				`Could not extract image data for ${providerName}.`,
			);
			return null;
		}
		return {
			base64Data,
			mediaType: mediaTypeMatch[1],
		};
	}

	private _useMaxCompletionTokens(model: string): boolean {
		const lowerModel = model.toLowerCase();
		return (
			lowerModel.startsWith("o1") ||
			lowerModel.startsWith("o3") ||
			lowerModel.startsWith("o4") ||
			lowerModel.startsWith("gpt-5") ||
			lowerModel.includes("gpt-5")
		);
	}

	private async _transcribeWithOpenAI(
		imageUrl: string,
		systemPrompt: string,
		userPrompt: string,
		apiKey: string,
		model: string,
		baseUrl: string,
	): Promise<string | null> {
		this.notificationService.notifyVerbose(`Sending image to OpenAI (${model})...`);
		const startTime = Date.now();

		const tokenLimitParam = this._useMaxCompletionTokens(model)
			? { max_completion_tokens: 4000 }
			: { max_tokens: 4000 };

		const requestBody = {
			model,
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
			throw: false,
		};

		const response = await requestUrl(requestParams);
		const data = response.json as OpenAiLikeResponse;

		if (response.status >= 200 && response.status < 300) {
			const transcription = data.choices?.[0]?.message?.content;
			if (transcription) {
				const endTime = Date.now();
				this.notificationService.notifyVerbose(
					`OpenAI Response received (${(endTime - startTime) / 1000}s).`,
				);
				return transcription.trim();
			}
			throw new Error("Invalid response format from OpenAI.");
		}

		const errorDetails =
			data.error?.message || response.text || `HTTP status ${response.status}`;
		throw new Error(`OpenAI API error: ${errorDetails}`);
	}

	private async _transcribeWithAnthropic(
		base64Data: string,
		mediaType: string,
		systemPrompt: string,
		userPrompt: string,
		apiKey: string,
		model: string,
	): Promise<string | null> {
		this.notificationService.notifyVerbose(`Sending image to Anthropic (${model})...`);
		const startTime = Date.now();

		const requestBody = {
			model,
			max_tokens: 4000,
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
			throw: false,
		};

		const response = await requestUrl(requestParams);
		const data = response.json as AnthropicResponse;

		if (response.status >= 200 && response.status < 300) {
			const transcription = data.content?.find(
				(block): block is AnthropicContentBlock & { type: "text"; text: string } =>
					block.type === "text" && typeof block.text === "string",
			)?.text;
			if (transcription) {
				const endTime = Date.now();
				this.notificationService.notifyVerbose(
					`Anthropic Response received (${(endTime - startTime) / 1000}s).`,
				);
				return transcription.trim();
			}
			throw new Error("Invalid response format from Anthropic.");
		}

		const errorDetails =
			data.error?.message || response.text || `HTTP status ${response.status}`;
		throw new Error(`Anthropic API error: ${errorDetails}`);
	}

	private _useGoogleV1Beta(model: string): boolean {
		const lowerModel = model.toLowerCase();
		return (
			lowerModel.includes("preview") ||
			lowerModel.includes("exp") ||
			lowerModel.includes("thinking") ||
			lowerModel.startsWith("gemini-3") ||
			lowerModel.includes("gemini-3")
		);
	}

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

		const googleApiUrl = this._useGoogleV1Beta(model)
			? GOOGLE_API_URL_V1BETA
			: GOOGLE_API_URL_V1;

		const requestParams: RequestUrlParam = {
			url: `${googleApiUrl}/${model}:generateContent?key=${apiKey}`,
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(requestBody),
			throw: false,
		};

		const response = await requestUrl(requestParams);
		const data = response.json as GoogleResponse;

		if (response.status >= 200 && response.status < 300) {
			const transcription = data.candidates?.[0]?.content?.parts?.[0]?.text;
			if (transcription) {
				const endTime = Date.now();
				this.notificationService.notifyVerbose(
					`Google Gemini Response received (${(endTime - startTime) / 1000}s).`,
				);
				return transcription.trim();
			}
			throw new Error("Invalid response format from Google Gemini.");
		}

		const errorDetails =
			data.error?.message || response.text || `HTTP status ${response.status}`;
		throw new Error(`Google Gemini API error: ${errorDetails}`);
	}

	private async _transcribeWithMistral(
		imageUrl: string,
		systemPrompt: string,
		userPrompt: string,
		apiKey: string,
		model: string,
	): Promise<string | null> {
		this.notificationService.notifyVerbose(`Sending image to Mistral (${model})...`);
		const startTime = Date.now();

		const requestBody = {
			model,
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

		const response = await requestUrl(requestParams);
		const data = response.json as OpenAiLikeResponse;

		if (response.status >= 200 && response.status < 300) {
			const transcription = data.choices?.[0]?.message?.content;
			if (transcription) {
				const endTime = Date.now();
				this.notificationService.notifyVerbose(
					`Mistral Response received (${(endTime - startTime) / 1000}s).`,
				);
				return transcription.trim();
			}
			throw new Error("Invalid response format from Mistral.");
		}

		const errorDetails =
			data.error?.message || response.text || `HTTP status ${response.status}`;
		throw new Error(`Mistral API error: ${errorDetails}`);
	}

	private async _transcribeWithCopilot(
		imageUrl: string,
		systemPrompt: string,
		userPrompt: string,
		oauthToken: string,
		model: string,
	): Promise<string | null> {
		this.notificationService.notifyVerbose(`Sending image to GitHub Copilot (${model})...`);
		const startTime = Date.now();

		const messages: CopilotChatMessage[] = [
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

		const transcription = await this.copilotService.chatCompletion(
			oauthToken,
			model,
			messages,
			4000,
		);

		if (!transcription) {
			throw new Error("Invalid response format from Copilot API.");
		}

		const endTime = Date.now();
		this.notificationService.notifyVerbose(
			`Copilot response received (${(endTime - startTime) / 1000}s).`,
		);
		return transcription;
	}
}
