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

There are a couple of things you can configure:

*   **API Provider:** Choose between OpenAI, Anthropic, and Google.
*   **API Key:** Enter the API key for your preferred provider.
*   **Model:** Select the model you want to use for transcription.
*   **System Prompt:** This defines the overall role or context for the AI. You can change this and reset it if you mess it up.
*   **User Prompt:** Provide the specific instructions for transcribing the image. Edit this to better suit your handwritten note style or change something about the format of the transcription.
*   **Note Naming Conventions:**
    *   `Use First Line of Transcription`: Uses the first non-empty line of the transcription as the note title.
    *   `Use Image Name`: Uses the image name as the note title.
    *   `Use Date + Image Name`: Creates notes like `YYYYMMDD_ImageName.md`.
    *   `Folder + Date + Image Name`: Creates notes like `FolderName_YYYYMMDD_ImageName.md`.
    
*   **Image Folder Name:** Specify the name of the subfolder where processed images should be stored (defaults to `Images`).
*   **Maintenance:**
    *   **Clear Processed Image History:** A button to reset the list of images the plugin knows it has already processed. Useful for re-processing or after clearing parts of your vault.
