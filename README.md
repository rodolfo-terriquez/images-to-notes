# Obsidian Images to notes Plugin

This plugin uses AI to transcribe photos of handwritten notes into markdown, creates a new note for each image, then adds the image to the markdown file.

It supports images in the following formats: .jpg, .jpeg, .png, and .heic

## How it Works

1.  Install and enable the plugin.
2.  Configure the settings (API provider, API key, model). I recommend using GPT-4.1 Mini for its low cost and high accuracy.
3.  Add an image file (by dragging it into a folder in the Obsidian file explorer pane).
4.  The plugin will automatically transcribe your image into a markdown file and add the image to the file.

**Note:** Images dragged directly into the *editor* pane of an open note will be handled by Obsidian's default embedding mechanism and will **not** be transcribed by this plugin. This is to prevent the plugin from interfering with your note taking workflow.

## Configuration

There are a couple of things you can configure:

*   **API Provider:** Choose between OpenAI and Anthropic.
*   **API Key:** Enter the API key for your preferred provider.
*   **Model:** Select the model you want to use for transcription.
*   **System Prompt:** This defines the overall role or context for the AI. You can change this and reset it if you mess it up.
*   **User Prompt:** Provide the specific instructions for transcribing the image. Edit this to better suit your handwritten note style or change something about the format of the transcription.
*   **Note Naming Conventions:**
    *   `Folder + Date + Image Name`: Creates notes like `FolderName_YYYYMMDD_ImageName.md`.
    *   `Use First Line of Transcription`: Uses the first non-empty line of the transcription as the note title.
*   **Image Folder Name:** Specify the name of the subfolder where processed images should be stored (defaults to `Images`).
*   **Maintenance:**
    *   **Clear Processed Image History:** A button to reset the list of images the plugin knows it has already processed. Useful for re-processing or after clearing parts of your vault.