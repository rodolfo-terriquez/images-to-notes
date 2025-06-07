# Image to notes Plugin

Use AI to transcribe photos of handwritten or printed notes into Markdown, creates a new note for each image, then adds the image to the bottom of the Note. 

Great for:
- Class notes
- Office printouts
- Random physical documents

It supports images in the following formats: .jpg, .jpeg, .png, and .heic

## How it Works

1.  Install and enable the plugin.
2.  Configure the settings (API provider, API key, model). I recommend using GPT-4.1 Mini for its low cost and high accuracy.
3.  Drag and drop your image into a folder in the Obsidian file explorer pane.
4.  The plugin will transcribe your image into a new note and add the image at the bottom.

You can drag and drop multiple images at once. They will queue and process one after the other.

![obsidian](https://github.com/user-attachments/assets/c639b86f-c014-437f-9c8d-e6b4b6cab496)

## How to set up the plugin

In the plugin settings:

1. Choose an API provider. This is the company that provides the AI model that the plugin will use to transcribe your images.
2. Paste your API key.
3. Choose an AI model.

That's it, everything else is optional.


## Configuration

The plugin settings allow you to customize how your images are processed and where the output files are stored.

*   **API Provider:** Choose between OpenAI, Anthropic, and Google.
*   **API Key:** Enter the API key for your chosen provider.
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
