import { requestUrl } from "obsidian";

const COPILOT_CLIENT_ID = "Iv1.b507a08c87ecfe98";
const GITHUB_DEVICE_CODE_URL = "https://github.com/login/device/code";
const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";
const COPILOT_TOKEN_URL = "https://api.github.com/copilot_internal/v2/token";
const COPILOT_API_BASE = "https://api.githubcopilot.com";

export interface DeviceCodeResponse {
	device_code: string;
	user_code: string;
	verification_uri: string;
	expires_in: number;
	interval: number;
}

export interface CopilotBearerToken {
	token: string;
	expires_at: number;
}

interface OAuthTokenResponse {
	access_token?: string;
	error?: string;
	error_description?: string;
}

interface CopilotTokenResponse {
	token: string;
	expires_at: number;
}

interface CopilotChatResponse {
	choices?: Array<{
		message?: {
			content?: string;
		};
	}>;
	error?: {
		message?: string;
	};
}

interface CopilotModelDescriptor {
	id?: string;
}

interface CopilotModelsResponse {
	data?: CopilotModelDescriptor[];
}

interface CopilotTextContent {
	type: "text";
	text: string;
}

interface CopilotImageContent {
	type: "image_url";
	image_url: {
		url: string;
	};
}

export type CopilotChatMessage = {
	role: string;
	content: string | Array<CopilotTextContent | CopilotImageContent>;
};

export class CopilotService {
	private bearerToken: CopilotBearerToken | null = null;

	async requestDeviceCode(): Promise<DeviceCodeResponse> {
		const response = await requestUrl({
			url: GITHUB_DEVICE_CODE_URL,
			method: "POST",
			headers: {
				Accept: "application/json",
				"Content-Type": "application/x-www-form-urlencoded",
			},
			body: `client_id=${COPILOT_CLIENT_ID}`,
			throw: false,
		});

		if (response.status !== 200) {
			throw new Error(
				`Failed to request device code: ${response.status} ${response.text}`,
			);
		}

		return response.json as DeviceCodeResponse;
	}

	async pollForOAuthToken(
		deviceCode: string,
		interval: number,
		expiresIn: number = 900,
		onPending?: () => void,
	): Promise<string> {
		let currentInterval = interval;
		const deadline = Date.now() + expiresIn * 1000;

		while (Date.now() < deadline) {
			await this.sleep(currentInterval * 1000);

			const response = await requestUrl({
				url: GITHUB_TOKEN_URL,
				method: "POST",
				headers: {
					Accept: "application/json",
					"Content-Type": "application/x-www-form-urlencoded",
				},
				body: new URLSearchParams({
					client_id: COPILOT_CLIENT_ID,
					device_code: deviceCode,
					grant_type: "urn:ietf:params:oauth:grant-type:device_code",
				}).toString(),
				throw: false,
			});

			if (response.status !== 200) {
				throw new Error(
					`Token request failed: ${response.status} ${response.text}`,
				);
			}

			const data = response.json as OAuthTokenResponse;

			if (data.access_token) {
				return data.access_token;
			}

			if (!data.error) {
				throw new Error(`Unexpected token response: ${JSON.stringify(data)}`);
			}

			switch (data.error) {
				case "authorization_pending":
					onPending?.();
					continue;
				case "slow_down":
					currentInterval += 5;
					continue;
				case "expired_token":
					throw new Error(
						"The device code has expired. Please try logging in again.",
					);
				case "access_denied":
					throw new Error("Login was cancelled or denied by the user.");
				default:
					throw new Error(
						`OAuth error: ${data.error} - ${data.error_description || "Unknown error"}`,
					);
			}
		}

		throw new Error("The device code has expired. Please try logging in again.");
	}

	async exchangeForCopilotToken(oauthToken: string): Promise<CopilotBearerToken> {
		const response = await requestUrl({
			url: COPILOT_TOKEN_URL,
			method: "GET",
			headers: {
				Authorization: `Token ${oauthToken}`,
				Accept: "application/json",
				"User-Agent": "ImgToNotes-Obsidian/1.0",
			},
			throw: false,
		});

		if (response.status === 401) {
			throw new Error(
				"GitHub Copilot authentication failed. Your OAuth token may be invalid or your Copilot subscription may not be active.",
			);
		}

		if (response.status !== 200) {
			throw new Error(
				`Failed to get Copilot token: ${response.status} ${response.text}`,
			);
		}

		const data = response.json as CopilotTokenResponse;
		this.bearerToken = {
			token: data.token,
			expires_at: data.expires_at,
		};

		return this.bearerToken;
	}

	async getBearerToken(oauthToken: string): Promise<string> {
		if (!oauthToken) {
			throw new Error(
				"GitHub Copilot is not authenticated. Please log in via the plugin settings.",
			);
		}

		if (
			this.bearerToken &&
			this.bearerToken.expires_at > Date.now() / 1000 + 60
		) {
			return this.bearerToken.token;
		}

		const newToken = await this.exchangeForCopilotToken(oauthToken);
		return newToken.token;
	}

	async chatCompletion(
		oauthToken: string,
		model: string,
		messages: CopilotChatMessage[],
		maxTokens: number = 4000,
	): Promise<string> {
		const bearerToken = await this.getBearerToken(oauthToken);

		const requestBody = JSON.stringify({
			model,
			messages,
			max_tokens: maxTokens,
		});

		const response = await this.postChatCompletion(bearerToken, requestBody);

		if (response.status === 401) {
			this.bearerToken = null;
			const newBearerToken = await this.getBearerToken(oauthToken);
			const retryResponse = await this.postChatCompletion(newBearerToken, requestBody);

			if (retryResponse.status !== 200) {
				throw new Error(
					`Copilot API error after token refresh: ${retryResponse.status} ${retryResponse.text}`,
				);
			}

			const data = retryResponse.json as CopilotChatResponse;
			return data.choices?.[0]?.message?.content?.trim() || "";
		}

		if (response.status !== 200) {
			let errorDetails: string;
			const errorData = response.json as CopilotChatResponse;
			errorDetails = errorData.error?.message || response.text || `HTTP ${response.status}`;
			throw new Error(`Copilot API error: ${errorDetails}`);
		}

		const data = response.json as CopilotChatResponse;
		const content = data.choices?.[0]?.message?.content;
		if (!content) {
			throw new Error("Invalid response format from Copilot API.");
		}
		return content.trim();
	}

	async validateOAuthToken(oauthToken: string): Promise<boolean> {
		try {
			await this.exchangeForCopilotToken(oauthToken);
			return true;
		} catch {
			return false;
		}
	}

	private async fetchModels(bearerToken: string) {
		return requestUrl({
			url: `${COPILOT_API_BASE}/models`,
			method: "GET",
			headers: {
				Authorization: `Bearer ${bearerToken}`,
				"Content-Type": "application/json",
				"Editor-Version": "ImgToNotes/1.0",
				"Editor-Plugin-Version": "ImgToNotes/1.0",
				"Copilot-Integration-Id": "vscode-chat",
			},
			throw: false,
		});
	}

	private async postChatCompletion(bearerToken: string, body: string) {
		return requestUrl({
			url: `${COPILOT_API_BASE}/chat/completions`,
			method: "POST",
			headers: {
				Authorization: `Bearer ${bearerToken}`,
				"Content-Type": "application/json",
				"Editor-Version": "ImgToNotes/1.0",
				"Editor-Plugin-Version": "ImgToNotes/1.0",
				"Copilot-Integration-Id": "vscode-chat",
			},
			body,
			throw: false,
		});
	}

	async listModels(oauthToken: string): Promise<string[]> {
		const bearerToken = await this.getBearerToken(oauthToken);
		const response = await this.fetchModels(bearerToken);

		if (response.status === 401) {
			this.bearerToken = null;
			const newBearerToken = await this.getBearerToken(oauthToken);
			const retryResponse = await this.fetchModels(newBearerToken);

			if (retryResponse.status !== 200) {
				throw new Error(
					`Failed to fetch models after token refresh: ${retryResponse.status}`,
				);
			}

			return this.extractModelIds(retryResponse.json as CopilotModelsResponse);
		}

		if (response.status !== 200) {
			throw new Error(`Failed to fetch Copilot models: ${response.status}`);
		}

		return this.extractModelIds(response.json as CopilotModelsResponse);
	}

	clearCache(): void {
		this.bearerToken = null;
	}

	private extractModelIds(data: CopilotModelsResponse): string[] {
		return (data.data || [])
			.map((model) => model.id)
			.filter((id): id is string => typeof id === "string" && id.length > 0);
	}

	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => activeWindow.setTimeout(resolve, ms));
	}
}
