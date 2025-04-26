import { TFile } from 'obsidian';

export type ProcessingStatus = 'pending' | 'processing' | 'done' | 'error';

export interface ProcessingJob {
    initialFile: TFile;
    status: ProcessingStatus;
    error?: string;
} 