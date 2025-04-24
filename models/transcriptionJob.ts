import { TFile } from 'obsidian';

export type TranscriptionStatus = 'pending' | 'processing' | 'done' | 'error';

export interface TranscriptionJob {
    file: TFile;
    status: TranscriptionStatus;
    error?: string; // Optional error message if status is 'error'
} 