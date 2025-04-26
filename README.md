# Obsidian Image Transcriber Plugin

This plugin automatically transcribes text from images added to folders within your Obsidian vault, creating a new Markdown note with the extracted content.

## Features

*   **Automatic Detection:** Watches your folders for newly added image files (`.jpg`, `.jpeg`, `.png`, `.gif`, `.bmp`, `.heic`).
*   **Image Compression:** Compresses images before transcription to potentially reduce API costs and improve processing speed (currently always enabled).
*   **Organized Image Storage:** Moves the processed image (original or converted/compressed) into a configurable subfolder (default: `Images`) within the image's original parent directory.
*   **AI-Powered Transcription:** Uses either OpenAI (GPT-4.1, GPT-4.1-mini, o4-mini) or Anthropic (Claude 3.5 Sonnet, Claude 3.7 Sonnet) models to extract text.
*   **Markdown Note Creation:** Generates a new `.md` file containing the transcription.
*   **Configurable Prompts:** Customize the system and user prompts sent to the AI for fine-tuning transcription results.
*   **Editor Drop Handling:** Ignores images dropped directly into the Obsidian editor view, preventing unnecessary transcriptions for embedded images.
*   **Processed History Management:** Keeps track of processed images to avoid duplicates and provides an option to clear this history.
*   **Status Notifications:** Displays notices for key steps like transcription start, completion, and errors.

## How it Works

1.  When a supported image file is detected in your vault (outside of the editor view):
    *   If it's a HEIC file, it's converted to JPG.
    *   The image is compressed.
    *   The image is moved to the configured subfolder (e.g., `ParentFolder/Images/image.jpg`).
    *   If the image hasn't been processed before (based on its final path), it's added to a queue.
2.  The queue processes images one by one:
    *   The image data is sent to your chosen AI provider (OpenAI or Anthropic) along with your configured prompts.
    *   The AI returns the transcribed text.
3.  A new Markdown note is created in the parent folder (e.g., `ParentFolder/NoteName.md`) containing the transcription.
4.  The image path is marked as processed to prevent re-transcription.

## Configuration

Access the plugin settings via Obsidian's settings menu (`Community Plugins` > `Image Transcriber`).

*   **API Provider:** Choose between OpenAI and Anthropic.
*   **API Key:** Enter the API key for your selected provider.
*   **Model:** Select the specific vision-capable model you want to use.
*   **System Prompt:** Define the overall role or context for the AI (e.g., "You are an expert transcriber..."). Includes a button to reset to the default.
*   **User Prompt:** Provide the specific instructions for transcribing the image (e.g., "Transcribe all text..."). Includes a button to reset to the default.
*   **Note Naming Convention:**
    *   `Folder + Date + Image Name`: Creates notes like `FolderName_YYYYMMDD_ImageName.md`.
    *   `Use First Line of Transcription`: Uses the first non-empty line of the transcription as the note title.
*   **Image Folder Name:** Specify the name of the subfolder where processed images should be stored (defaults to `Images`).
*   **Maintenance:**
    *   **Clear Processed Image History:** A button to reset the list of images the plugin knows it has already processed. Useful for re-processing or after clearing parts of your vault.

## Usage

1.  Install and enable the plugin.
2.  Configure the settings, especially your API provider and API key.
3.  Add an image file (e.g., by dragging it into a folder in the Obsidian file explorer pane).
4.  The plugin will automatically handle the conversion (if needed), compression, moving, and transcription, creating a new note nearby.

**Note:** Images dragged directly into the *editor* pane of an open note will be handled by Obsidian's default embedding mechanism and will **not** be transcribed by this plugin.

## Installation

1.  Search for "Image Transcriber" in Obsidian's Community Plugins browser.
2.  Install the plugin.
3.  Enable the plugin under the "Community plugins" tab in settings.
4.  Configure the required API settings.
