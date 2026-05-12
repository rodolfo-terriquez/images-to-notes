import { TFile } from 'obsidian';
import { TranscriptionJob } from '../models/transcriptionJob';

export class TranscriptionQueue {
    private queue: TranscriptionJob[] = [];
    private isProcessing: boolean = false;
    private processing: TranscriptionJob | null = null;

    private processCallback: (job: TranscriptionJob) => Promise<void> = async () => {
        // Intentionally empty until a callback is registered.
    };

    public setProcessCallback(callback: (job: TranscriptionJob) => Promise<void>): void {
        this.processCallback = callback;
    }

    addToQueue(file: TFile, originalParentPath: string): void {
        if (
            this.queue.some((job) => job.file.path === file.path) ||
            this.processing?.file.path === file.path
        ) {
            return;
        }

        const newJob: TranscriptionJob = {
            file,
            originalParentPath,
            status: 'pending',
        };

        this.queue.push(newJob);
        this.triggerProcessing();
    }

    private triggerProcessing(): void {
        if (this.isProcessing) {
            return;
        }

        void this.processNext();
    }

    async processNext(): Promise<void> {
        if (this.isProcessing) {
            return;
        }

        const nextJob = this.queue.find((job) => job.status === 'pending');

        if (!nextJob) {
            this.isProcessing = false;
            return;
        }

        this.isProcessing = true;
        this.processing = nextJob;
        nextJob.status = 'processing';

        try {
            await this.processCallback(nextJob);
        } catch (error) {
            this.markAsError(nextJob, error instanceof Error ? error.message : String(error));
        } finally {
            this.processing = null;
            this.isProcessing = false;
            void this.processNext();
        }
    }

    markAsDone(job: TranscriptionJob): void {
        job.status = 'done';
    }

    markAsError(job: TranscriptionJob, errorMessage: string): void {
        job.status = 'error';
        job.error = errorMessage;
    }
}
