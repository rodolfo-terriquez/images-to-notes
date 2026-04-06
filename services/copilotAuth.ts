import { requestUrl } from "obsidian";

// Copilot OAuth App client ID
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



/**
 * Manages GitHub Copilot authentication via the OAuth Device Flow.
 *
 * Flow:
 * 1. Request a device code from GitHub
 * 2. User visits github.com/login/device and enters the code
 * 3. Poll GitHub until the user authorizes -> get an OAuth token
 * 4. Exchange the OAuth token for a short-lived Copilot bearer token
 * 5. Use the bearer token for API calls (auto-refresh on expiry)
 */
export class CopilotAuthService {
	private bearerToken: CopilotBearerToken | null = null;
	private bearerTokenOAuthSource: string | null = null;

	/**
	 * Step 1: Request device and user verification codes from GitHub.
	 */
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

	/**
	 * Step 3: Poll GitHub for the OAuth access token.
	 * Returns the OAuth token (gho_xxx) once the user authorizes.
	 *
	 * @param deviceCode - The device_code from step 1
	 * @param interval - Polling interval in seconds
	 * @param onPending - Optional callback when waiting for user authorization
	 * @returns The GitHub OAuth access token
	 */
	async pollForOAuthToken(
		deviceCode: string,
		interval: number,
		onPending?: () => void,
	): Promise<string> {
		let currentInterval = interval;

		while (true) {
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

			const data = response.json;

			if (data.access_token) {
				return data.access_token as string;
			}

			if (data.error) {
				switch (data.error) {
					case "authorization_pending":
						onPending?.();
						continue;
					case "slow_down":
						// Add 5 seconds as required by RFC 8628, section 3.5
						// https://datatracker.ietf.org/doc/html/rfc8628#section-3.5
						currentInterval += 5;
						continue;
					case "expired_token":
						throw new Error(
							"The device code has expired. Please try logging in again.",
						);
					case "access_denied":
						throw new Error(
							"Login was cancelled or denied by the user.",
						);
					default:
						throw new Error(
							`OAuth error: ${data.error} - ${data.error_description || "Unknown error"}`,
						);
				}
			}
		}
	}

	/**
	 * Exchange a GitHub OAuth token for a short-lived Copilot bearer token.
	 */
	async exchangeForCopilotToken(
		oauthToken: string,
	): Promise<CopilotBearerToken> {
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

		const data = response.json;
		this.bearerToken = {
			token: data.token,
			expires_at: data.expires_at,
		};
		this.bearerTokenOAuthSource = oauthToken;

		return this.bearerToken;
	}

	/**
	 * Get a valid Copilot bearer token, refreshing if expired.
	 * Requires the OAuth token to be stored in settings.
	 */
	async getBearerToken(oauthToken: string): Promise<string> {
		if (!oauthToken) {
			throw new Error(
				"GitHub Copilot is not authenticated. Please log in via the plugin settings.",
			);
		}

		// Check if we have a valid cached bearer token (with 60s buffer)
		// Also invalidate if the OAuth token changed (e.g., different account)
		if (
			this.bearerToken &&
			this.bearerTokenOAuthSource === oauthToken &&
			this.bearerToken.expires_at > Date.now() / 1000 + 60
		) {
			return this.bearerToken.token;
		}

		// Exchange for a new bearer token
		const newToken = await this.exchangeForCopilotToken(oauthToken);
		return newToken.token;
	}

	/**
	 * Make a chat completions request to the Copilot API.
	 * Handles automatic token refresh on 401.
	 */
	async chatCompletion(
		oauthToken: string,
		model: string,
		messages: Array<{ role: string; content: any }>,
		maxTokens: number = 4000,
	): Promise<string> {
		const bearerToken = await this.getBearerToken(oauthToken);

		const requestBody = JSON.stringify({
			model: model,
			messages: messages,
			max_tokens: maxTokens,
		});

		const response = await this.postChatCompletion(bearerToken, requestBody);

		// Handle 401 by refreshing the bearer token and retrying once
		if (response.status === 401) {
			this.bearerToken = null; // Invalidate cached token
			const newBearerToken = await this.getBearerToken(oauthToken);
			const retryResponse = await this.postChatCompletion(newBearerToken, requestBody);

			if (retryResponse.status !== 200) {
				throw new Error(
					`Copilot API error after token refresh: ${retryResponse.status} ${retryResponse.text}`,
				);
			}

			const data = retryResponse.json;
			return data?.choices?.[0]?.message?.content?.trim() || "";
		}

		if (response.status !== 200) {
			let errorDetails: string;
			try {
				const errorData = response.json;
				errorDetails = errorData?.error?.message || response.text;
			} catch {
				errorDetails = response.text || `HTTP ${response.status}`;
			}
			throw new Error(`Copilot API error: ${errorDetails}`);
		}

		const data = response.json;
		const content = data?.choices?.[0]?.message?.content;
		if (!content) {
			throw new Error("Invalid response format from Copilot API.");
		}
		return content.trim();
	}

	/**
	 * Check if a stored OAuth token is still valid by attempting a token exchange.
	 */
	async validateOAuthToken(oauthToken: string): Promise<boolean> {
		try {
			await this.exchangeForCopilotToken(oauthToken);
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Fetches the list of available models from the Copilot API.
	 * Returns an array of model ID strings.
	 */
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
			body: body,
			throw: false,
		});
	}

	async listModels(oauthToken: string): Promise<string[]> {
		const bearerToken = await this.getBearerToken(oauthToken);
		const response = await this.fetchModels(bearerToken);

		if (response.status === 401) {
			// Try refreshing the bearer token
			this.bearerToken = null;
			const newBearerToken = await this.getBearerToken(oauthToken);
			const retryResponse = await this.fetchModels(newBearerToken);

			if (retryResponse.status !== 200) {
				throw new Error(
					`Failed to fetch models after token refresh: ${retryResponse.status}`,
				);
			}

			const data = retryResponse.json;
			return (data?.data || []).map((m: any) => m.id as string);
		}

		if (response.status !== 200) {
			throw new Error(`Failed to fetch Copilot models: ${response.status}`);
		}

		const data = response.json;
		return (data?.data || []).map((m: any) => m.id as string);
	}

	/**
	 * Parses the raw API response and filters to models that support
	 * /chat/completions and have vision capability (for image transcription).
	 */
	

	/**
	 * Clear cached bearer token (e.g., on logout).
	 */
	clearCache(): void {
		this.bearerToken = null;
		this.bearerTokenOAuthSource = null;
	}

	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
}
