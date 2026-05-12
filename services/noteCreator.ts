import { App, TFile, normalizePath } from "obsidian";
import { PluginSettings, NoteNamingOption, TranscriptionPlacement } from "../models/settings";
import { NotificationService } from "../ui/notificationService";
import { getParentFolderPath, sanitizeFilename, getFormattedDate } from "../utils/fileUtils";

function stripMarkdown(text: string): string {
	let cleaned = text.replace(/^[#]+\s+/, "");
	cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
	return cleaned.trim();
}

export class NoteCreator {
	constructor(
		private settings: PluginSettings,
		private notificationService: NotificationService,
		private app: App,
	) {}

	async createNote(
		transcription: string,
		imageFile: TFile,
		noteTargetParentPath: string,
	): Promise<TFile | null> {
		try {
			const title = this._generateNoteTitle(transcription, imageFile);
			const folderPath = noteTargetParentPath;
			const uniqueNotePath = await this._findUniqueNotePath(folderPath, title);

			let noteContent = transcription.trim();
			if (this.settings.includeImageInNote) {
				const imageLink = this.app.fileManager.generateMarkdownLink(imageFile, "/");
				const imageEmbed = imageLink.startsWith("!") ? imageLink : `!${imageLink}`;
				if (this.settings.transcriptionPlacement === TranscriptionPlacement.AboveImage) {
					noteContent = `${transcription.trim()}\n\n${imageEmbed}`;
				} else {
					noteContent = `${imageEmbed}\n\n${transcription.trim()}`;
				}
			}

			const newNoteFile = await this.app.vault.create(uniqueNotePath, noteContent);
			this.notificationService.notifySuccess(`Note created: ${newNoteFile.basename}`);
			return newNoteFile;
		} catch {
			this.notificationService.notifyError("Failed to create note.");
			return null;
		}
	}

	private _generateNoteTitle(transcription: string, imageFile: TFile): string {
		let titleBase = "";
		const date = getFormattedDate();
		const sanitizedImageName = sanitizeFilename(imageFile.basename);

		switch (this.settings.noteNamingOption) {
			case NoteNamingOption.FirstLine: {
				const firstLine = transcription.trim().split("\n")[0];
				if (firstLine) {
					titleBase = sanitizeFilename(stripMarkdown(firstLine));
				} else {
					titleBase = `Transcription for ${sanitizedImageName}`;
				}
				break;
			}

			case NoteNamingOption.ImageName:
				titleBase = sanitizedImageName;
				break;

			case NoteNamingOption.DateImageName:
				titleBase = `${date}_${sanitizedImageName}`;
				break;

			case NoteNamingOption.FolderDateNum:
			default: {
				const parentFolder = getParentFolderPath(imageFile.path);
				const folderName =
					parentFolder === "/" ? "Root" : parentFolder.split("/").pop() || "Folder";
				titleBase = `${folderName}_${date}_${sanitizedImageName}`;
				break;
			}
		}

		const MAX_TITLE_LENGTH = 100;
		return titleBase.substring(0, MAX_TITLE_LENGTH);
	}

	private async _findUniqueNotePath(folderPath: string, title: string): Promise<string> {
		let counter = 0;
		const validTitle = title || "Untitled Note";
		let uniquePath = normalizePath(`${folderPath}/${validTitle}.md`);

		while (await this.app.vault.adapter.exists(uniquePath)) {
			counter++;
			uniquePath = normalizePath(`${folderPath}/${validTitle}_${counter}.md`);
		}
		return uniquePath;
	}
}
