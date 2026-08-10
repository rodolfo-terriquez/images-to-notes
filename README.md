# Images to Notes

Use AI to transcribe photos of handwritten or printed notes into Markdown. The plugin creates a new note for each image, then adds the image to the note.

Great for:
- Class notes
- Office printouts
- Random physical documents

It supports images in the following formats: .jpg, .jpeg, .png, and .heic

## How it Works

1.  Install and enable the plugin.
2.  Configure the settings (API provider, authentication, and model). The default model is a reasonable starting point, but pricing and availability vary by provider.
3.  Drag and drop your image into a folder in the Obsidian file explorer pane.
4.  The plugin will transcribe your image into a new note and add the image at the bottom.

You can drag and drop multiple images at once. They will queue and process one after the other.

![obsidian](https://github.com/user-attachments/assets/c639b86f-c014-437f-9c8d-e6b4b6cab496)

## How to set up the plugin

In the plugin settings:

1. Choose an API provider. This is the company that provides the AI model that the plugin will use to transcribe your images.
2. Authenticate:
   - **OpenAI, Anthropic, Google, Mistral:** Paste your API key.
   - **GitHub Copilot:** Click "Login with GitHub" and enter the code shown in the settings on the GitHub page that opens.
3. Choose an AI model.

That's it, everything else is optional.

The model menus contain a curated set of current and older supported models. You can also enter a custom model ID for any supported provider. Updating the catalog never automatically changes your saved model selection. GitHub Copilot models are fetched dynamically, and a saved model remains selected even if a refresh omits it or fails.

## Optional managed beta

The plugin settings contain a static link to request a spot in a proposed managed transcription beta: **$6 USD per month for up to 200 images**. The beta is intended for people who do not want to create an AI provider account or manage an API key.

The managed service has not been built, there is no charge today, and submitting the interest form does not create a subscription. The existing bring-your-own-key and GitHub Copilot options remain free features of the plugin.

[Request a beta spot](https://docs.google.com/forms/d/e/1FAIpQLSfog58t5rqlAbjvf8lpUMCRs1dupPGhqz7kTmW9aL2sQ0hGcg/viewform)

## Network use and privacy

When you process an image using OpenAI, Anthropic, Google Gemini, Mistral, an OpenAI-compatible endpoint, or GitHub Copilot, the plugin sends the image and your configured prompts directly to that provider. The provider's terms, privacy policy, account access, and pricing apply.

In the current bring-your-own-key and GitHub Copilot modes, the plugin developer does not receive your images or transcriptions. Images to Notes has no analytics, tracking, or client-side telemetry. API credentials and plugin settings are stored in the plugin configuration associated with your Obsidian vault; your Obsidian and sync configuration determines where that configuration is copied.

Opening the managed-beta link takes you to a Google Form. Information submitted there is handled as described in the [Images to Notes privacy notice](https://madebyrodolfo.com/privacy/).


## Configuration

The plugin settings allow you to customize how your images are processed and where the output files are stored.

*   **API Provider:** Choose between OpenAI, Anthropic, Google, Mistral, an OpenAI-compatible endpoint, and GitHub Copilot.
*   **API Key:** Enter the API key for your chosen provider. (Not required for GitHub Copilot or compatible endpoints that do not require authentication.)
*   **Model:** Select the specific AI model you want to use for transcription.
*   **System Prompt:** Defines the overall role or context for the AI (e.g., "You are an expert at transcribing handwritten notes..."). You can customize this and reset it to the default if needed.
*   **User Prompt:** The specific instruction for the AI for each image. You can edit this to better suit your note style or change the output format.
*   **Note Naming Conventions:** Choose how your new transcription notes are named. Options include using the first line of the transcription, the image name, or various combinations with dates and folder names.
*   **Image Source Control:**
    *   **Transcribe only from a specific folder:** When enabled, the plugin will only process images that are added to the folder you select here. This is useful for preventing accidental transcriptions.
*   **Output Destination:**
    *   **Image destination:** You can choose to save processed images either in a subfolder (default) or in a specific folder you select from a dropdown.
    *   **Note destination:** You can choose to create transcription notes either alongside the original image's location (default) or in a specific folder you select from a dropdown.
*   **Image subfolder name:** If you choose the "Create a subfolder" option for image destinations, this setting lets you define the name of that subfolder (defaults to `Images`).
*   **Mobile Optimizations:**
    *   **Enable mobile optimization:** Optimizes image processing on mobile devices to improve performance.
*   **Verbose Notifications:**
    *   **Enable verbose notifications:** Show detailed notifications for every processing step, not just start, finish, and errors.
*   **Maintenance:**
    *   **Clear Processed Image History:** A button to reset the list of images the plugin knows it has already processed. Useful for re-processing or after clearing parts of your vault.
