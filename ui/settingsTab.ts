import {
	App,
	PluginSettingTab,
	Setting,
	TextAreaComponent,
	DropdownComponent,
	TextComponent,
	Notice,
	ButtonComponent,
	TFolder,
	Modal,
} from "obsidian";
import ImageTranscriberPlugin from "../main"; // Corrected import
import {
	ApiProvider,
	OpenAiModel,
	AnthropicModel,
	GoogleModel,
	MistralModel,
	DEFAULT_SETTINGS,
	NoteNamingOption,
	TranscriptionPlacement,
} from "../models/settings"; // Import relevant types AND DEFAULTS AND NoteNamingOption
import { getPreservedModelOptions } from "../utils/modelSelection";

const MANAGED_BETA_FORM_URL =
	"https://docs.google.com/forms/d/e/1FAIpQLSfog58t5rqlAbjvf8lpUMCRs1dupPGhqz7kTmW9aL2sQ0hGcg/viewform";
const PRIVACY_URL = "https://madebyrodolfo.com/privacy/";

// Define available models - These should match the types in settings.ts
const OPENAI_MODELS: Record<OpenAiModel, string> = {
	"gpt-5.6-sol": "GPT-5.6 Sol",
	"gpt-5.6-terra": "GPT-5.6 Terra",
	"gpt-5.6-luna": "GPT-5.6 Luna",
	"gpt-5.4-nano": "GPT-5.4 Nano",
	"gpt-5.5": "GPT-5.5",
	"gpt-5.4": "GPT-5.4",
	"gpt-5.4-mini": "GPT-5.4 Mini",
	"gpt-4o": "GPT-4o",
	"gpt-4o-mini": "GPT-4o Mini",
	custom: "Custom Model",
};

const ANTHROPIC_MODELS: Record<AnthropicModel, string> = {
	"claude-fable-5": "Claude Fable 5",
	"claude-opus-5": "Claude Opus 5",
	"claude-sonnet-5": "Claude Sonnet 5",
	"claude-opus-4-7": "Claude Opus 4.7",
	"claude-sonnet-4-6": "Claude Sonnet 4.6",
	"claude-haiku-4-5": "Claude Haiku 4.5",
	custom: "Custom Model",
};

const GOOGLE_MODELS: Record<GoogleModel, string> = {
	"gemini-3.6-flash": "Gemini 3.6 Flash",
	"gemini-3.5-flash": "Gemini 3.5 Flash",
	"gemini-3.5-flash-lite": "Gemini 3.5 Flash-Lite",
	"gemini-3.1-pro-preview": "Gemini 3.1 Pro (Preview)",
	"gemini-3-flash-preview": "Gemini 3 Flash (Preview)",
	"gemini-3.1-flash-lite": "Gemini 3.1 Flash-Lite",
	"gemini-2.5-pro": "Gemini 2.5 Pro",
	"gemini-2.5-flash": "Gemini 2.5 Flash",
	"gemini-2.5-flash-lite": "Gemini 2.5 Flash-Lite",
	custom: "Custom Model",
};

const MISTRAL_MODELS: Record<MistralModel, string> = {
	"mistral-medium-3-5": "Mistral Medium 3.5",
	"mistral-small-2603": "Mistral Small 4",
	"mistral-large-2512": "Mistral Large 3",
	"mistral-medium-2508": "Mistral Medium 3.1",
	"ministral-14b-2512": "Ministral 3 14B",
	"ministral-8b-2512": "Ministral 3 8B",
	"ministral-3b-2512": "Ministral 3 3B",
	custom: "Custom Model",
};

function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : "Unknown error";
}

class ConfirmationModal extends Modal {
	private resolved = false;

	constructor(
		app: App,
		private title: string,
		private message: string,
		private onResolve: (confirmed: boolean) => void,
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h3", { text: this.title });
		contentEl.createEl("p", { text: this.message });

		const buttonRow = contentEl.createDiv({ cls: "imgtono-confirmation-actions" });
		new ButtonComponent(buttonRow)
			.setButtonText("Cancel")
			.onClick(() => this.finish(false));
		new ButtonComponent(buttonRow)
			.setButtonText("Clear history")
			.setWarning()
			.onClick(() => this.finish(true));
	}

	onClose(): void {
		this.contentEl.empty();
		if (!this.resolved) {
			this.onResolve(false);
		}
	}

	private finish(confirmed: boolean): void {
		if (this.resolved) {
			return;
		}
		this.resolved = true;
		this.close();
		this.onResolve(confirmed);
	}
}

// Copilot models are fetched dynamically from the API

export class TranscriptionSettingTab extends PluginSettingTab {
	plugin: ImageTranscriberPlugin;

	constructor(app: App, plugin: ImageTranscriberPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	private confirmAction(title: string, message: string): Promise<boolean> {
		return new Promise((resolve) => {
			new ConfirmationModal(this.app, title, message, resolve).open();
		});
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		// --- API Provider ---
		new Setting(containerEl)
			.setName("API provider")
			.setDesc("Select the AI provider for image transcription.")
			.addDropdown((dropdown) =>
				dropdown
					.addOption(ApiProvider.OpenAI, "OpenAI")
					.addOption(ApiProvider.Anthropic, "Anthropic")
					.addOption(ApiProvider.Google, "Google")
					.addOption(ApiProvider.Mistral, "Mistral")
					.addOption(ApiProvider.OpenAICompatible, "OpenAI-Compatible (Local/Custom)")
					.addOption(ApiProvider.GitHubCopilot, "GitHub Copilot")
					.setValue(this.plugin.settings.provider)
					.onChange(async (value) => {
						this.plugin.settings.provider = value as ApiProvider;
						await this.plugin.saveSettings();
						this.display(); // Re-render the settings tab to show/hide relevant fields
					}),
			);

		const betaDescription = createFragment();
		betaDescription.append(
			"Use Images to Notes without creating an AI account or managing an API key. Proposed beta: $6 USD/month for up to 200 images. No charge today. ",
		);
		betaDescription.createEl("a", {
			text: "Privacy details",
			href: PRIVACY_URL,
			attr: { target: "_blank", rel: "noopener noreferrer" },
		});

		new Setting(containerEl)
			.setName("Managed transcription beta")
			.setDesc(betaDescription)
			.addButton((button) =>
				button
					.setButtonText("Request a beta spot")
					.setCta()
					.onClick(() => window.open(MANAGED_BETA_FORM_URL, "_blank")),
			);

		// --- Provider Specific Settings ---
		const providerDesc = containerEl.createDiv({ cls: "imgtono-provider-settings-desc" }); // Container for descriptions/warnings
		providerDesc.empty(); // Clear previous warnings

		if (this.plugin.settings.provider === ApiProvider.OpenAI) {
			// OpenAI API Key
			new Setting(containerEl)
				.setName("OpenAI API key")
				.setDesc("Enter your OpenAI API key.")
				.addText((text) =>
					text
						.setPlaceholder("sk-...")
						.setValue(this.plugin.settings.openaiApiKey)
						.onChange(async (value) => {
							this.plugin.settings.openaiApiKey = value.trim();
							await this.plugin.saveSettings();
						})
						.inputEl.setAttribute("type", "password"),
				); // Mask the key

			// OpenAI Base URL
			new Setting(containerEl)
				.setName("OpenAI Base URL")
				.setDesc(
					"Set a custom base URL for the OpenAI API. Defaults to https://api.openai.com.",
				)
				.addText((text) =>
					text
						.setPlaceholder("https://api.openai.com")
						.setValue(this.plugin.settings.openaiBaseUrl)
						.onChange(async (value) => {
							this.plugin.settings.openaiBaseUrl = value.trim();
							await this.plugin.saveSettings();
						}),
				);

			// OpenAI Model
			new Setting(containerEl)
				.setName("OpenAI model")
				.setDesc(
					"Select the OpenAI model to use. GPT-5.4 Mini remains the default; newer models may have different pricing and availability.",
				)
				.addDropdown((dropdown) => {
					// Use the imported type and constant
					for (const modelId in OPENAI_MODELS) {
						dropdown.addOption(modelId, OPENAI_MODELS[modelId as OpenAiModel]);
					}
					dropdown.setValue(this.plugin.settings.openaiModel);
					dropdown.onChange(async (value) => {
						this.plugin.settings.openaiModel = value as OpenAiModel; // Cast to specific type
						await this.plugin.saveSettings();
						this.display(); // Re-render to show/hide custom model input
					});
				});

			// Custom model input for OpenAI
			if (this.plugin.settings.openaiModel === "custom") {
				new Setting(containerEl)
					.setName("Custom model name")
					.setDesc("Enter the exact model name to use (e.g., gpt-4-turbo-2024-04-09).")
					.addText((text) =>
						text
							.setPlaceholder("Enter model name")
							.setValue(this.plugin.settings.openaiCustomModel)
							.onChange(async (value) => {
								this.plugin.settings.openaiCustomModel = value.trim();
								await this.plugin.saveSettings();
							}),
					);
			}

			if (!this.plugin.settings.openaiApiKey) {
				providerDesc.createEl("p", {
					text: "⚠️ OpenAI API key is required.",
					cls: "imgtono-setting-warning",
				});
			}
		} else if (this.plugin.settings.provider === ApiProvider.Anthropic) {
			// Anthropic API Key
			new Setting(containerEl)
				.setName("Anthropic API key")
				.setDesc("Enter your Anthropic API key.")
				.addText((text) =>
					text
						.setPlaceholder("sk-ant-...")
						.setValue(this.plugin.settings.anthropicApiKey)
						.onChange(async (value) => {
							this.plugin.settings.anthropicApiKey = value.trim();
							await this.plugin.saveSettings();
						})
						.inputEl.setAttribute("type", "password"),
				); // Mask the key

			// Anthropic Model
			new Setting(containerEl)
				.setName("Anthropic model")
				.setDesc("Select the Anthropic model to use.")
				.addDropdown((dropdown) => {
					// Use the imported type and constant
					for (const modelId in ANTHROPIC_MODELS) {
						dropdown.addOption(modelId, ANTHROPIC_MODELS[modelId as AnthropicModel]);
					}
					dropdown.setValue(this.plugin.settings.anthropicModel);
					dropdown.onChange(async (value) => {
						this.plugin.settings.anthropicModel = value as AnthropicModel; // Cast to specific type
						await this.plugin.saveSettings();
						this.display(); // Re-render to show/hide custom model input
					});
				});

			// Custom model input for Anthropic
			if (this.plugin.settings.anthropicModel === "custom") {
				new Setting(containerEl)
					.setName("Custom model name")
					.setDesc("Enter the exact model name to use (e.g., claude-3-opus-20240229).")
					.addText((text) =>
						text
							.setPlaceholder("Enter model name")
							.setValue(this.plugin.settings.anthropicCustomModel)
							.onChange(async (value) => {
								this.plugin.settings.anthropicCustomModel = value.trim();
								await this.plugin.saveSettings();
							}),
					);
			}

			if (!this.plugin.settings.anthropicApiKey) {
				providerDesc.createEl("p", {
					text: "⚠️ Anthropic API key is required.",
					cls: "imgtono-setting-warning",
				});
			}
		} else if (this.plugin.settings.provider === ApiProvider.Google) {
			// Google API Key
			new Setting(containerEl)
				.setName("Google API key")
				.setDesc("Enter your Google API key for Gemini models.")
				.addText((text) =>
					text
						.setPlaceholder("AIza...")
						.setValue(this.plugin.settings.googleApiKey)
						.onChange(async (value) => {
							this.plugin.settings.googleApiKey = value.trim();
							await this.plugin.saveSettings();
						})
						.inputEl.setAttribute("type", "password"),
				); // Mask the key

			// Google Model
			new Setting(containerEl)
				.setName("Google model")
				.setDesc("Select the Google Gemini model to use.")
				.addDropdown((dropdown) => {
					// Use the imported type and constant
					for (const modelId in GOOGLE_MODELS) {
						dropdown.addOption(modelId, GOOGLE_MODELS[modelId as GoogleModel]);
					}
					dropdown.setValue(this.plugin.settings.googleModel);
					dropdown.onChange(async (value) => {
						this.plugin.settings.googleModel = value as GoogleModel; // Cast to specific type
						await this.plugin.saveSettings();
						this.display(); // Re-render to show/hide custom model input
					});
				});

			// Custom model input for Google
			if (this.plugin.settings.googleModel === "custom") {
				new Setting(containerEl)
					.setName("Custom model name")
					.setDesc("Enter the exact model name to use (e.g., gemini-1.5-pro).")
					.addText((text) =>
						text
							.setPlaceholder("Enter model name")
							.setValue(this.plugin.settings.googleCustomModel)
							.onChange(async (value) => {
								this.plugin.settings.googleCustomModel = value.trim();
								await this.plugin.saveSettings();
							}),
					);
			}

			if (!this.plugin.settings.googleApiKey) {
				providerDesc.createEl("p", {
					text: "⚠️ Google API key is required.",
					cls: "imgtono-setting-warning",
				});
			}
		} else if (this.plugin.settings.provider === ApiProvider.Mistral) {
			// Mistral API Key
			new Setting(containerEl)
				.setName("Mistral API key")
				.setDesc("Enter your Mistral API key.")
				.addText((text) =>
					text
						.setPlaceholder("mistral-...")
						.setValue(this.plugin.settings.mistralApiKey)
						.onChange(async (value) => {
							this.plugin.settings.mistralApiKey = value.trim();
							await this.plugin.saveSettings();
						})
						.inputEl.setAttribute("type", "password"),
				); // Mask the key

			// Mistral Model
			new Setting(containerEl)
				.setName("Mistral model")
				.setDesc("Select the Mistral model to use.")
				.addDropdown((dropdown) => {
					for (const modelId in MISTRAL_MODELS) {
						dropdown.addOption(modelId, MISTRAL_MODELS[modelId as MistralModel]);
					}
					dropdown.setValue(this.plugin.settings.mistralModel);
					dropdown.onChange(async (value) => {
						this.plugin.settings.mistralModel = value as MistralModel;
						await this.plugin.saveSettings();
						this.display(); // Re-render to show/hide custom model input
					});
				});

			// Custom model input for Mistral
			if (this.plugin.settings.mistralModel === "custom") {
				new Setting(containerEl)
					.setName("Custom model name")
					.setDesc("Enter the exact model name to use (e.g., mistral-large-latest).")
					.addText((text) =>
						text
							.setPlaceholder("Enter model name")
							.setValue(this.plugin.settings.mistralCustomModel)
							.onChange(async (value) => {
								this.plugin.settings.mistralCustomModel = value.trim();
								await this.plugin.saveSettings();
							}),
					);
			}

			if (!this.plugin.settings.mistralApiKey) {
				providerDesc.createEl("p", {
					text: "⚠️ Mistral API key is required.",
					cls: "imgtono-setting-warning",
				});
			}
		} else if (this.plugin.settings.provider === ApiProvider.OpenAICompatible) {
			// OpenAI-Compatible Endpoint URL
			new Setting(containerEl)
				.setName("Endpoint URL")
				.setDesc(
					"The base URL for your OpenAI-compatible API (e.g., http://localhost:1234/v1 for LM Studio, http://localhost:11434/v1 for Ollama).",
				)
				.addText((text) =>
					text
						.setPlaceholder("http://localhost:1234/v1")
						.setValue(this.plugin.settings.openaiCompatibleEndpoint)
						.onChange(async (value) => {
							this.plugin.settings.openaiCompatibleEndpoint = value.trim();
							await this.plugin.saveSettings();
						}),
				);

			// OpenAI-Compatible API Key (optional)
			new Setting(containerEl)
				.setName("API key (optional)")
				.setDesc(
					"Some servers require an API key. Leave empty if your server doesn't require authentication.",
				)
				.addText((text) =>
					text
						.setPlaceholder("Optional API key")
						.setValue(this.plugin.settings.openaiCompatibleApiKey)
						.onChange(async (value) => {
							this.plugin.settings.openaiCompatibleApiKey = value.trim();
							await this.plugin.saveSettings();
						})
						.inputEl.setAttribute("type", "password"),
				);

			// OpenAI-Compatible Model Name
			new Setting(containerEl)
				.setName("Model name")
				.setDesc(
					"The exact model name to use (e.g., llava, llama-3.2-vision, or the model you have loaded).",
				)
				.addText((text) =>
					text
						.setPlaceholder("Enter model name")
						.setValue(this.plugin.settings.openaiCompatibleModel)
						.onChange(async (value) => {
							this.plugin.settings.openaiCompatibleModel = value.trim();
							await this.plugin.saveSettings();
						}),
				);

			if (!this.plugin.settings.openaiCompatibleModel) {
				providerDesc.createEl("p", {
					text: "⚠️ Model name is required.",
					cls: "imgtono-setting-warning",
				});
			}
		} else if (this.plugin.settings.provider === ApiProvider.GitHubCopilot) {
			// GitHub Copilot - OAuth Login
			const copilotService = this.plugin.copilotService;
			const isLoggedIn = !!this.plugin.settings.copilotOAuthToken;
			const copilotLoginPrompt = "Log in with your GitHub account to use Copilot.";

			const loginSetting = new Setting(containerEl)
				.setName("GitHub account")
				.setDesc(
					isLoggedIn
						? "You are logged in to GitHub Copilot."
						: copilotLoginPrompt,
				);

			if (isLoggedIn) {
				loginSetting.addButton((button: ButtonComponent) =>
					button
						.setButtonText("Logout")
						.setWarning()
						.onClick(async () => {
							this.plugin.settings.copilotOAuthToken = "";
							copilotService.clearCache();
							await this.plugin.saveSettings();
							this.display();
						}),
				);
			} else {
				loginSetting.addButton((button: ButtonComponent) =>
					button
						.setButtonText("Login with GitHub")
						.setCta()
						.onClick(async () => {
							try {
								button.setButtonText("Starting...");
								button.setDisabled(true);

								const deviceCode = await copilotService.requestDeviceCode();

								// Copy user code to clipboard (best-effort; may fail on mobile)
								let clipboardSuccess = false;
								try {
									await navigator.clipboard.writeText(deviceCode.user_code);
									clipboardSuccess = true;
								} catch {
									// Clipboard access is best-effort and can fail on some platforms.
								}

								// Open the verification URL in the user's browser
								window.open(deviceCode.verification_uri, "_blank");

								// Show the code in the setting description
								const descEl = loginSetting.descEl;
								descEl.empty();
								descEl.createSpan({ text: "Your code: " });
								descEl.createEl("code", { text: deviceCode.user_code});
								descEl.createSpan({text: clipboardSuccess ? " (copied to clipboard). Open " : ". Open "});
								descEl.createEl("a", {
									text: deviceCode.verification_uri,
									href: deviceCode.verification_uri,
									attr: {target: "_blank"},
								});
								descEl.createSpan({text: " and paste the code."});

								button.setButtonText("Waiting for authorization...");

								const oauthToken = await copilotService.pollForOAuthToken(
									deviceCode.device_code,
									deviceCode.interval,
									deviceCode.expires_in,
								);

								this.plugin.settings.copilotOAuthToken = oauthToken;
								await this.plugin.saveSettings();

								new Notice("Successfully logged in to GitHub Copilot!");
								this.display();
							} catch (error: unknown) {
								new Notice(`GitHub login failed: ${getErrorMessage(error)}`);
								loginSetting.setDesc(copilotLoginPrompt);
								button.setButtonText("Login with GitHub");
								button.setDisabled(false);
							}
						}),
				);
			}

			// Copilot Model - dynamically fetched from API
			if (isLoggedIn) {
				const modelSetting = new Setting(containerEl)
					.setName("Copilot model");

				// Show spinner in description while loading
				const descEl = modelSetting.descEl;
				descEl.empty();
				const loadingContainer = descEl.createSpan({ cls: "imgtono-model-loading-inline" });
				loadingContainer.createSpan({ cls: "imgtono-spinner" });
				loadingContainer.createSpan({ text: "Fetching available models..." });

				modelSetting.addDropdown((dropdown) => {
					// Show current model as placeholder while loading
					if (this.plugin.settings.copilotModel && this.plugin.settings.copilotModel !== "custom") {
						dropdown.addOption(
							this.plugin.settings.copilotModel,
							this.plugin.settings.copilotModel,
						);
					}
					dropdown.addOption("custom", "Custom Model");
					dropdown.setValue(this.plugin.settings.copilotModel);

					dropdown.onChange(async (value) => {
						this.plugin.settings.copilotModel = value;
						await this.plugin.saveSettings();
						customModelSetting.settingEl.toggle(value === "custom");
					});

					// Fetch models asynchronously and populate dropdown
					copilotService
					.listModels(this.plugin.settings.copilotOAuthToken)
					.then((models) => {
						const currentModel = this.plugin.settings.copilotModel;
						const options = getPreservedModelOptions(currentModel, models);
						dropdown.selectEl.empty();
						for (const modelId of options) {
							dropdown.addOption(
								modelId,
								modelId === "custom" ? "Custom Model" : modelId,
							);
						}
						dropdown.setValue(currentModel);
						customModelSetting.settingEl.toggle(currentModel === "custom");

						descEl.empty();
						descEl.setText(
							currentModel !== "custom" && !models.includes(currentModel)
								? "Your saved model is no longer advertised by GitHub Copilot. It will remain selected until you choose another model."
								: "Select the model to use via GitHub Copilot.",
						);
					})
					.catch(() => {
						const currentModel = this.plugin.settings.copilotModel;
						const options = getPreservedModelOptions(currentModel, []);
						dropdown.selectEl.empty();
						for (const modelId of options) {
							dropdown.addOption(
								modelId,
								modelId === "custom" ? "Custom Model" : modelId,
							);
						}
						dropdown.setValue(currentModel);
						customModelSetting.settingEl.toggle(currentModel === "custom");

						descEl.empty();
						descEl.setText(
							"Failed to refresh models. Your saved selection was not changed; try logging out and back in if the problem continues.",
						);
					});
				});

				// Custom model input - always rendered, visibility toggled
				const customModelSetting = new Setting(containerEl)
					.setName("Custom model name")
					.setDesc(
						"Enter the exact model name available on GitHub Copilot (e.g., gpt-4o-mini).",
					)
					.addText((text) =>
						text
							.setPlaceholder("Enter model name")
							.setValue(this.plugin.settings.copilotCustomModel)
							.onChange(async (value) => {
								this.plugin.settings.copilotCustomModel = value.trim();
								await this.plugin.saveSettings();
							}),
					);
				customModelSetting.settingEl.toggle(this.plugin.settings.copilotModel === "custom");
			}

			if (!isLoggedIn) {
				providerDesc.createEl("p", {
					text: "⚠️ GitHub Copilot authentication is required. Click 'Login with GitHub' below.",
					cls: "imgtono-setting-warning",
				});
			}
		}

		// --- System Prompt ---
		let systemPromptTextArea: TextAreaComponent; // Variable to hold the text area component

		// Create the system prompt setting with vertical layout
		const systemPromptContainer = containerEl.createDiv({
			cls: "imgtono-vertical-layout-container",
		});

		// Add the setting header (name and description)
		const systemPromptHeader = systemPromptContainer.createDiv({
			cls: "imgtono-setting-item-info",
		});
		const systemPromptName = systemPromptHeader.createDiv({ cls: "imgtono-setting-item-name" });
		systemPromptName.setText("System prompt");
		const systemPromptDesc = systemPromptHeader.createDiv({
			cls: "imgtono-setting-item-description",
		});
		systemPromptDesc.setText(
			"The system prompt to guide the AI model's behavior (e.g., role, context).",
		);

		// Add the text area below the description
		const systemPromptControl = systemPromptContainer.createDiv({
			cls: "imgtono-setting-item-control",
		});
		systemPromptTextArea = new TextAreaComponent(systemPromptControl);
		systemPromptTextArea
			.setPlaceholder(DEFAULT_SETTINGS.systemPrompt)
			.setValue(this.plugin.settings.systemPrompt)
			.onChange(async (value) => {
				this.plugin.settings.systemPrompt = value;
				await this.plugin.saveSettings();
			});
		systemPromptTextArea.inputEl.rows = 4;

		// Add reset button below the text area
		const systemPromptButtonContainer = systemPromptContainer.createDiv({
			cls: "imgtono-setting-button-row",
		});
		new ButtonComponent(systemPromptButtonContainer)
			.setIcon("reset")
			.setButtonText("Reset to default")
			.onClick(async () => {
				this.plugin.settings.systemPrompt = DEFAULT_SETTINGS.systemPrompt;
				systemPromptTextArea.setValue(this.plugin.settings.systemPrompt);
				await this.plugin.saveSettings();
				new Notice("System prompt reset to default.");
			});

		// --- User Prompt (Previously Transcription Prompt) ---
		let userPromptTextArea: TextAreaComponent; // Variable to hold the text area component

		// Create the user prompt setting with vertical layout
		const userPromptContainer = containerEl.createDiv({
			cls: "imgtono-vertical-layout-container",
		});

		// Add the setting header (name and description)
		const userPromptHeader = userPromptContainer.createDiv({
			cls: "imgtono-setting-item-info",
		});
		const userPromptName = userPromptHeader.createDiv({ cls: "imgtono-setting-item-name" });
		userPromptName.setText("User prompt");
		const userPromptDesc = userPromptHeader.createDiv({
			cls: "imgtono-setting-item-description",
		});
		userPromptDesc.setText("The specific instruction for the AI for this image.");

		// Add the text area below the description
		const userPromptControl = userPromptContainer.createDiv({
			cls: "imgtono-setting-item-control",
		});
		userPromptTextArea = new TextAreaComponent(userPromptControl);
		userPromptTextArea
			.setPlaceholder(DEFAULT_SETTINGS.userPrompt)
			.setValue(this.plugin.settings.userPrompt)
			.onChange(async (value) => {
				this.plugin.settings.userPrompt = value;
				await this.plugin.saveSettings();
			});
		userPromptTextArea.inputEl.rows = 6; // Make it taller

		// Add reset button below the text area
		const userPromptButtonContainer = userPromptContainer.createDiv({
			cls: "imgtono-setting-button-row",
		});
		new ButtonComponent(userPromptButtonContainer)
			.setIcon("reset")
			.setButtonText("Reset to default")
			.onClick(async () => {
				this.plugin.settings.userPrompt = DEFAULT_SETTINGS.userPrompt;
				userPromptTextArea.setValue(this.plugin.settings.userPrompt);
				await this.plugin.saveSettings();
				new Notice("User prompt reset to default.");
			});

		// --- Note Naming ---
		this.createNoteNamingSetting(containerEl);

		// --- Note Content ---
		new Setting(containerEl).setName("Note Content").setHeading();

		new Setting(containerEl)
			.setName("Include image in note")
			.setDesc("If enabled, the processed image will be linked in the transcribed note.")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.includeImageInNote).onChange(async (value) => {
					this.plugin.settings.includeImageInNote = value;
					await this.plugin.saveSettings();
				}),
			);

		new Setting(containerEl)
			.setName("Transcription placement")
			.setDesc("Choose where to place the transcription relative to the image.")
			.addDropdown((dropdown) =>
				dropdown
					.addOption(TranscriptionPlacement.AboveImage, "Above image")
					.addOption(TranscriptionPlacement.BelowImage, "Below image")
					.setValue(this.plugin.settings.transcriptionPlacement)
					.onChange(async (value) => {
						this.plugin.settings.transcriptionPlacement =
							value as TranscriptionPlacement;
						await this.plugin.saveSettings();
					}),
			);

		// --- Image Source Control ---
		new Setting(containerEl).setName("Image Source Control").setHeading();
		this.createSourceFolderSetting(containerEl);

		// --- Output Destination ---
		new Setting(containerEl).setName("Output Destination").setHeading();
		this.createImageDestinationSetting(containerEl);
		this.createNoteDestinationSetting(containerEl);

		// --- Image Folder Name ---
		// This setting is now conditional, shown only when imageDestinationOption is 'subfolder'
		if (this.plugin.settings.imageDestinationOption === "subfolder") {
			this.createImageFolderNameSetting(containerEl);
		}

		// --- Mobile Optimizations ---
		new Setting(containerEl).setName("Mobile Optimizations").setHeading();

		new Setting(containerEl)
			.setName("Enable mobile optimization")
			.setDesc("If enabled, the plugin will optimize images for mobile devices.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.mobileOptimizationEnabled)
					.onChange(async (value) => {
						this.plugin.settings.mobileOptimizationEnabled = value;
						await this.plugin.saveSettings();
					}),
			);

		// --- Add the new setting toggle
		new Setting(containerEl)
			.setName("Enable verbose notifications")
			.setDesc(
				"Show detailed notifications for every processing step, not just start, finish, and errors.",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.verboseNotifications)
					.onChange(async (value) => {
						this.plugin.settings.verboseNotifications = value;
						await this.plugin.saveSettings();
					}),
			);

		// --- Clear Processed Image History ---
		new Setting(containerEl).setName("Maintenance").setHeading();
		new Setting(containerEl)
			.setName("Clear processed image history")
			.setDesc(
				"Removes the record of images that have already been processed. " +
					"Use this if you want the plugin to re-process images it previously skipped, " +
					"or if you have cleared your vault and want to reset the history. " +
					"Currently processed count: " +
					this.plugin.settings.processedImagePaths.length,
			)
			.addButton((button) =>
				button
					.setButtonText("Clear history")
					.setWarning() // Makes the button red for caution
					.onClick(async () => {
						const confirmed = await this.confirmAction(
							"Clear processed image history?",
							"Are you sure you want to clear the entire processed image history? This cannot be undone.",
						);

						if (confirmed) {
							this.plugin.settings.processedImagePaths = [];
							await this.plugin.saveSettings();
							new Notice("Processed image history cleared.");
							this.display();
						} else {
							new Notice("Clear history cancelled.");
						}
					}),
			);
	}

	private createFolderSetting(
		containerEl: HTMLElement,
		settingName: string,
		settingDesc: string,
		value: string,
		placeholder: string,
		onChange: (value: string) => Promise<void>,
	): void {
		let folderInput: TextComponent;
		const folderSettingContainer = containerEl.createDiv({
			cls: "imgtono-vertical-layout-container",
		});

		const folderHeader = folderSettingContainer.createDiv({ cls: "imgtono-setting-item-info" });
		const folderName = folderHeader.createDiv({ cls: "imgtono-setting-item-name" });
		folderName.setText(settingName);
		const folderDesc = folderHeader.createDiv({ cls: "imgtono-setting-item-description" });
		folderDesc.setText(settingDesc);

		const folderControl = folderSettingContainer.createDiv({
			cls: "imgtono-setting-item-control",
		});
		folderInput = new TextComponent(folderControl);
		folderInput.setPlaceholder(placeholder).setValue(value).onChange(onChange);
		folderInput.inputEl.addClass("imgtono-full-width-input");

		const folderButtonContainer = folderSettingContainer.createDiv({
			cls: "imgtono-setting-button-row",
		});
		new ButtonComponent(folderButtonContainer)
			.setIcon("reset")
			.setButtonText("Reset")
			.onClick(async () => {
				folderInput.setValue("");
				await onChange("");
				new Notice(`${settingName} folder path cleared.`);
			});
	}

	private createFolderDropdownSetting(
		containerEl: HTMLElement,
		settingName: string,
		settingDesc: string,
		value: string,
		onChange: (value: string) => Promise<void>,
	): void {
		const folderSettingContainer = containerEl.createDiv({
			cls: "imgtono-vertical-layout-container",
		});

		const folderHeader = folderSettingContainer.createDiv({ cls: "imgtono-setting-item-info" });
		folderHeader.createDiv({ cls: "imgtono-setting-item-name" }).setText(settingName);
		folderHeader.createDiv({ cls: "imgtono-setting-item-description" }).setText(settingDesc);

		const folderControl = folderSettingContainer.createDiv({
			cls: "imgtono-setting-item-control",
		});
		const dropdown = new DropdownComponent(folderControl);
		dropdown.addOption("", "-- Select a folder --");

		const folders = this.app.vault
			.getAllLoadedFiles()
			.filter((file): file is TFolder => file instanceof TFolder);
		folders.forEach((folder) => {
			dropdown.addOption(folder.path, folder.path === "/" ? "Vault Root (/)" : folder.path);
		});

		dropdown.setValue(value).onChange(onChange);
		dropdown.selectEl.addClass("imgtono-full-width-select");

		if (!value && folders.length > 0) {
			folderHeader.createEl("p", {
				text: "⚠️ Please select a folder.",
				cls: "imgtono-setting-warning",
			});
		} else if (folders.length === 0) {
			folderHeader.createEl("p", {
				text: "No folders found in your vault. Create a folder to use this feature.",
				cls: "imgtono-setting-warning",
			});
			dropdown.setDisabled(true);
		}
	}

	private createImageDestinationSetting(containerEl: HTMLElement): void {
		const imageDestContainer = containerEl.createDiv({
			cls: "imgtono-vertical-layout-container",
		});
		const imageDestHeader = imageDestContainer.createDiv({ cls: "imgtono-setting-item-info" });
		imageDestHeader
			.createDiv({ cls: "imgtono-setting-item-name" })
			.setText("Image destination");
		imageDestHeader
			.createDiv({ cls: "imgtono-setting-item-description" })
			.setText("Where should processed images be saved?");

		const imageDestControl = imageDestContainer.createDiv({
			cls: "imgtono-setting-item-control",
		});
		const imageDestDropdown = new DropdownComponent(imageDestControl);
		imageDestDropdown
			.addOption("subfolder", "Create a subfolder in the current folder (default)")
			.addOption("specificFolder", "Save to a specific folder")
			.setValue(this.plugin.settings.imageDestinationOption)
			.onChange(async (value) => {
				this.plugin.settings.imageDestinationOption = value as
					| "subfolder"
					| "specificFolder";
				await this.plugin.saveSettings();
				this.display();
			});

		if (this.plugin.settings.imageDestinationOption === "specificFolder") {
			this.createFolderDropdownSetting(
				imageDestContainer,
				"Specific image folder path",
				"The path to the folder for processed images (e.g., Assets/Images).",
				this.plugin.settings.specificImageFolderPath,
				async (value) => {
					this.plugin.settings.specificImageFolderPath = value;
					await this.plugin.saveSettings();
				},
			);
		}
	}

	private createNoteDestinationSetting(containerEl: HTMLElement): void {
		const noteDestContainer = containerEl.createDiv({
			cls: "imgtono-vertical-layout-container",
		});
		const noteDestHeader = noteDestContainer.createDiv({ cls: "imgtono-setting-item-info" });
		noteDestHeader.createDiv({ cls: "imgtono-setting-item-name" }).setText("Note destination");
		noteDestHeader
			.createDiv({ cls: "imgtono-setting-item-description" })
			.setText("Where should new transcription notes be created?");

		const noteDestControl = noteDestContainer.createDiv({
			cls: "imgtono-setting-item-control",
		});
		const noteDestDropdown = new DropdownComponent(noteDestControl);
		noteDestDropdown
			.addOption("alongside", "Alongside the original image's location (default)")
			.addOption("specificFolder", "Save to a specific folder")
			.setValue(this.plugin.settings.noteDestinationOption)
			.onChange(async (value) => {
				this.plugin.settings.noteDestinationOption = value as
					| "alongside"
					| "specificFolder";
				await this.plugin.saveSettings();
				this.display();
			});

		if (this.plugin.settings.noteDestinationOption === "specificFolder") {
			this.createFolderDropdownSetting(
				noteDestContainer,
				"Specific note folder path",
				"The path to the folder for new notes (e.g., Inbox/Transcriptions).",
				this.plugin.settings.specificNoteFolderPath,
				async (value) => {
					this.plugin.settings.specificNoteFolderPath = value;
					await this.plugin.saveSettings();
				},
			);
		}
	}

	private createImageFolderNameSetting(containerEl: HTMLElement): void {
		let folderNameInput: TextComponent;
		const folderNameContainer = containerEl.createDiv({
			cls: "imgtono-vertical-layout-container",
		});

		const folderNameHeader = folderNameContainer.createDiv({
			cls: "imgtono-setting-item-info",
		});
		folderNameHeader
			.createDiv({ cls: "imgtono-setting-item-name" })
			.setText("Processed image folder name");
		folderNameHeader
			.createDiv({ cls: "imgtono-setting-item-description" })
			.setText(
				"Name of the subfolder where processed images will be saved (e.g., 'Images').",
			);

		const folderNameControl = folderNameContainer.createDiv({
			cls: "imgtono-setting-item-control",
		});
		folderNameInput = new TextComponent(folderNameControl);
		folderNameInput
			.setPlaceholder(DEFAULT_SETTINGS.imageFolderName)
			.setValue(this.plugin.settings.imageFolderName)
			.onChange(async (value) => {
				this.plugin.settings.imageFolderName =
					value.trim() || DEFAULT_SETTINGS.imageFolderName;
				await this.plugin.saveSettings();
				folderNameInput.setValue(this.plugin.settings.imageFolderName); // Ensure UI reflects the possibly defaulted value
			});
		folderNameInput.inputEl.addClass("imgtono-full-width-input");

		const folderNameButtonContainer = folderNameContainer.createDiv({
			cls: "imgtono-setting-button-row",
		});
		new ButtonComponent(folderNameButtonContainer)
			.setIcon("reset")
			.setButtonText("Reset to default")
			.onClick(async () => {
				this.plugin.settings.imageFolderName = DEFAULT_SETTINGS.imageFolderName;
				folderNameInput.setValue(this.plugin.settings.imageFolderName);
				await this.plugin.saveSettings();
				new Notice("Image folder name reset to default.");
			});
	}

	private createNoteNamingSetting(containerEl: HTMLElement): void {
		// Create the note naming setting with vertical layout
		const noteNamingContainer = containerEl.createDiv({
			cls: "imgtono-vertical-layout-container",
		});

		// Add the setting header (name and description)
		const noteNamingHeader = noteNamingContainer.createDiv({
			cls: "imgtono-setting-item-info",
		});
		const noteNamingName = noteNamingHeader.createDiv({ cls: "imgtono-setting-item-name" });
		noteNamingName.setText("Note naming convention");
		const noteNamingDesc = noteNamingHeader.createDiv({
			cls: "imgtono-setting-item-description",
		});
		noteNamingDesc.setText("How should the new transcription note be named?");

		// Add the dropdown below the description
		const noteNamingControl = noteNamingContainer.createDiv({
			cls: "imgtono-setting-item-control",
		});
		const dropdown = new DropdownComponent(noteNamingControl);

		// Use the enum keys for values and provide user-friendly names
		dropdown
			.addOption(
				NoteNamingOption.FirstLine,
				"Use first line of transcription (strips markdown)",
			)
			.addOption(NoteNamingOption.ImageName, "Use image name (e.g., ImageName.md)")
			.addOption(
				NoteNamingOption.DateImageName,
				"Use date + image name (e.g., YYYYMMDD_ImageName.md)",
			)
			.addOption(
				NoteNamingOption.FolderDateNum,
				"Use folder + date + image name (e.g., Folder_YYYYMMDD_ImageName.md)",
			)
			.setValue(this.plugin.settings.noteNamingOption)
			.onChange(async (value) => {
				this.plugin.settings.noteNamingOption = value as NoteNamingOption;
				await this.plugin.saveSettings();
			});
		dropdown.selectEl.addClass("imgtono-full-width-select");
	}

	private createSourceFolderSetting(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName("Transcribe only from a specific folder")
			.setDesc(
				"If enabled, only images added to the selected folder below will be transcribed.",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.transcribeOnlySpecificFolder)
					.onChange(async (value) => {
						this.plugin.settings.transcribeOnlySpecificFolder = value;
						await this.plugin.saveSettings();
						this.display();
					}),
			);

		if (this.plugin.settings.transcribeOnlySpecificFolder) {
			this.createFolderDropdownSetting(
				containerEl,
				"Folder for transcription",
				"Choose the folder to monitor for new images.",
				this.plugin.settings.specificFolderForTranscription,
				async (value) => {
					this.plugin.settings.specificFolderForTranscription = value;
					await this.plugin.saveSettings();
				},
			);
		}
	}
}
