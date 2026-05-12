import { TFile } from 'obsidian';
import { ProcessingJob } from '../models/processingJob';

export class ProcessingQueue {
    private queue: ProcessingJob[] = [];
    private isProcessing: boolean = false;
    private processing: ProcessingJob | null = null;
    private maxConcurrent: number = 2;
    private activeJobs: number = 0;

    private processCallback: (job: ProcessingJob) => Promise<void> = async () => {
        // Intentionally empty until a callback is registered.
    };

    public setMaxConcurrent(max: number): void {
        this.maxConcurrent = Math.max(1, Math.min(5, max));
    }

    public setProcessCallback(callback: (job: ProcessingJob) => Promise<void>): void {
        this.processCallback = callback;
    }

    addToQueue(file: TFile): void {
        if (
            this.queue.some((existingJob) => existingJob.initialFile.path === file.path) ||
            this.processing?.initialFile.path === file.path
        ) {
            return;
        }

        const newJob: ProcessingJob = {
            initialFile: file,
            status: 'pending',
        };

        this.queue.push(newJob);
        this.startProcessing();
    }

    private startProcessing(): void {
        if (this.isProcessing) {
            return;
        }

        void this.processNext();
    }

    async processNext(): Promise<void> {
        if (this.activeJobs >= this.maxConcurrent) {
            return;
        }

        if (this.isProcessing) {
            return;
        }

        const nextJob = this.queue.find((job) => job.status === 'pending');

        if (!nextJob) {
            this.isProcessing = false;
            this.processing = null;
            return;
        }

        this.isProcessing = true;
        this.processing = nextJob;
        this.activeJobs++;

        try {
            await this.processCallback(nextJob);
        } catch (error) {
            this.markAsError(nextJob, error instanceof Error ? error.message : String(error));
        } finally {
            this.processing = null;
            this.isProcessing = false;
            this.activeJobs--;
            void this.processNext();
        }
    }

    markAsDone(job: ProcessingJob): void {
        if (job.status !== 'done') {
            job.status = 'done';
        }
    }

    markAsError(job: ProcessingJob, errorMessage: string): void {
        if (job.status !== 'error') {
            job.status = 'error';
            job.error = errorMessage;
        }
    }
}
