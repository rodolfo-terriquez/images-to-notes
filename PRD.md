# Product Requirements Document: Obsidian Image Transcription Plugin

## 1. Product Overview

**Plugin Name:** Obsidian Image Transcription Plugin  
**Version:** 1.0.0  
**Purpose:** Automate the conversion of handwritten note images into Markdown text in Obsidian using AI transcription.  
**Target Users:** Students  
**Implementation Platform:** Obsidian Desktop Plugin API

## 2. Technical Specifications

### 2.1 Plugin Architecture

```
- main.ts (Plugin entry point)
- services/
  - fileWatcher.ts (Detects new images in vault)
  - transcriptionQueue.ts (Manages image processing queue)
  - aiService.ts (Handles API communication)
  - noteCreator.ts (Generates new notes from transcriptions)
- ui/
  - settingsTab.ts (Defines settings panel UI)
  - notificationService.ts (Manages user notifications)
- models/
  - settings.ts (Settings interface definitions)
  - transcriptionJob.ts (Job status tracking)
- utils/
  - markdownFormatter.ts (Ensures proper Markdown formatting)
  - imageProcessor.ts (Handles image validation and preparation)
```

### 2.2 Supported File Types

- Image formats: JPG/JPEG (.jpg, .jpeg), PNG (.png)
- Maximum file size: 25MB (or API provider's limit, whichever is smaller)

### 2.3 API Integration

- Supported providers: OpenAI, Anthropic
- OpenAI models: GPT-4 Vision, GPT-4o
- Anthropic models: Claude 3 Opus, Claude 3 Sonnet
- API rate limiting: Implement exponential backoff for retries

## 3. Functional Requirements

### 3.1 Image Detection & Processing

**Requirements:**
- FR-1.1: Plugin MUST detect when new image files (JPG, PNG) are added to any folder within the Obsidian vault.
- FR-1.2: Plugin MUST validate images for supported formats and dimensions before processing.
- FR-1.3: Plugin MUST add detected images to a transcription queue.
- FR-1.4: Plugin MUST process multiple images sequentially when dropped simultaneously.
- FR-1.5: Plugin MUST display a status indicator during active transcription processes.

**Implementation Notes:**
```typescript
// Monitor file system events
this.registerEvent(
  this.app.vault.on('create', (file) => {
    if (isImageFile(file) && file.path.endsWith('.jpg') || file.path.endsWith('.png')) {
      this.transcriptionQueue.addToQueue(file);
      this.notificationService.notify('Image added to transcription queue');
    }
  })
);
```

### 3.2 AI Transcription

**Requirements:**
- FR-2.1: Plugin MUST send images to the configured AI provider (OpenAI or Anthropic).
- FR-2.2: Plugin MUST use the user's stored API key for authentication.
- FR-2.3: Plugin MUST use the configured AI prompt for transcription requests.
- FR-2.4: Plugin MUST handle API errors gracefully with appropriate user notifications.
- FR-2.5: Plugin MUST properly format received transcriptions as Markdown.

**API Request Structure:**
```typescript
// OpenAI implementation example
async function transcribeWithOpenAI(imageBase64: string, prompt: string): Promise {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.settings.openaiApiKey}`
    },
    body: JSON.stringify({
      model: "gpt-4-vision-preview",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { 
              type: "image_url", 
              image_url: { url: `data:image/jpeg;base64,${imageBase64}` }
            }
          ]
        }
      ],
      max_tokens: 4096
    })
  });
  
  const data = await response.json();
  return data.choices[0].message.content;
}
```

### 3.3 Note Creation

**Requirements:**
- FR-3.1: Plugin MUST create a new Markdown note for each transcribed image.
- FR-3.2: Plugin MUST place the new note in the same folder as the original image.
- FR-3.3: Plugin MUST determine the note title based on user settings (first line of transcription or folder name + date + number).
- FR-3.4: Plugin MUST append the original image at the bottom of the note.
- FR-3.5: Plugin MUST sanitize note titles to be valid filenames.

**Note Structure:**
```markdown
# [Note Title]

[Transcribed content in Markdown format]

![Original Image]([image path])
```

**Implementation Notes:**
```typescript
async function createNoteFromTranscription(transcription: string, imagePath: string): Promise {
  // Determine note title based on settings
  const noteTitle = this.settings.useFirstLineAsTitle 
    ? transcription.split('\n')[0].replace(/^#\s*/, '') 
    : `${getParentFolderName(imagePath)}_${getFormattedDate()}_${getSequentialNumber()}`;
  
  const sanitizedTitle = sanitizeFilename(noteTitle);
  const folderPath = getParentFolderPath(imagePath);
  const noteContent = `${transcription}\n\n![Original Image](${imagePath})`;
  
  return this.app.vault.create(`${folderPath}/${sanitizedTitle}.md`, noteContent);
}
```

### 3.4 Notification System

**Requirements:**
- FR-4.1: Plugin MUST notify users when transcription process begins.
- FR-4.2: Plugin MUST notify users when transcription is successfully completed.
- FR-4.3: Plugin MUST notify users when errors occur during transcription.
- FR-4.4: Plugin MUST notify users when API quota is exceeded.
- FR-4.5: Plugin MUST display current queue status when multiple images are being processed.

**Notification Types:**
1. Info: Blue notification for general information
2. Success: Green notification for successful operations
3. Error: Red notification for errors
4. Warning: Yellow notification for warnings

## 4. Settings Panel

### 4.1 API Configuration

**Required Fields:**
- Provider selection: Radio buttons for "OpenAI" or "Anthropic"
- API Key: Password field for entering provider API key
- Model selection: Dropdown with available models for selected provider

### 4.2 Transcription Options

**Required Fields:**
- Prompt customization: Text area with minimum height of 150px
- Note naming options: Radio buttons for:
  - "Use first line of transcription" (default)
  - "Use folder name + date + number"

### 4.3 Default Settings

```typescript
interface PluginSettings {
  provider: 'openai' | 'anthropic';
  openaiApiKey: string;
  anthropicApiKey: string;
  openaiModel: 'gpt-4-vision-preview' | 'gpt-4o';
  anthropicModel: 'claude-3-opus-20240229' | 'claude-3-sonnet-20240229';
  transcriptionPrompt: string;
  useFirstLineAsTitle: boolean;
}

const DEFAULT_SETTINGS: PluginSettings = {
  provider: 'openai',
  openaiApiKey: '',
  anthropicApiKey: '',
  openaiModel: 'gpt-4-vision-preview',
  anthropicModel: 'claude-3-opus-20240229',
  transcriptionPrompt: 'Transcribe the handwritten notes in this image into properly formatted Markdown. Maintain the original structure including paragraphs, bullet points, and numbering. Format any tables correctly using Markdown table syntax. Describe any diagrams or drawings briefly and note their presence. Preserve any emphasis (underlines, highlights) using appropriate Markdown formatting.',
  useFirstLineAsTitle: true
};
```

## 5. Error Handling

### 5.1 API Errors

**Required Error Handlers:**
- Authentication failure: Check for 401 status codes, prompt user to verify API key
- Rate limit exceeded: Check for 429 status codes, implement exponential backoff
- Service unavailable: Check for 5xx status codes, retry after delay
- Timeout: Implement 30-second timeout for API requests

### 5.2 Processing Errors

**Required Error Handlers:**
- Unsupported file type: Skip non-image files with warning notification
- Invalid file size: Skip oversized files with warning notification
- Failed transcription: Log error, notify user, and provide retry option
- Note creation failure: Preserve transcription text for manual recovery

## 6. Performance Considerations

- Process images sequentially to manage API rate limits
- Implement request throttling based on provider's limits
- Cache API responses to avoid redundant processing of identical images
- Minimize main thread blocking during image processing

## 7. Testing Requirements

- Verify correct operation with various image sizes and quality
- Test plugin recovery after Obsidian restart with pending queue
- Validate handling of network interruptions
- Ensure proper functioning with both API providers

## 8. Implementation Priority

1. Core file monitoring and transcription functionality
2. Note creation and image attachment
3. Settings panel and API integration
4. Notification system
5. Error handling and recovery mechanisms

## 9. Required Obsidian API Usage

```typescript
// Required Obsidian API imports
import {
  App,
  Editor,
  MarkdownView,
  Modal,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  TFile,
  TFolder,
  normalizePath
} from 'obsidian';

// Required plugin lifecycle methods
onload() {
  // Initialize services
  // Register settings tab
  // Set up file watchers
  // Create command palette entries
}

onunload() {
  // Clean up resources
  // Save pending queue
}
```

## 10. Data Privacy

- API keys must be stored securely using Obsidian's built-in data storage
- No user data should be stored beyond the current session except configuration settings
- Images and transcriptions are processed through third-party APIs (OpenAI/Anthropic)
- No analytics or usage tracking should be implemented