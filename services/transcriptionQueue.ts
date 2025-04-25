import { TFile } from 'obsidian';
import { TranscriptionJob, TranscriptionStatus } from '../models/transcriptionJob';

export class TranscriptionQueue {
    private queue: TranscriptionJob[] = [];
    private isProcessing: boolean = false;

    // The actual processing logic is now injected via setProcessCallback
    private processCallback: (job: TranscriptionJob) => Promise<void> = async () => {
        // This should never be called if setProcessCallback is used correctly
        console.error('TranscriptionQueue: processCallback was not set!');
        // Optionally throw an error or handle it gracefully
        // throw new Error("Process callback not set");
    };

    // Setter for the processing callback
    public setProcessCallback(callback: (job: TranscriptionJob) => Promise<void>) {
        this.processCallback = callback;
    }

    /**
     * Adds a file to the transcription queue.
     * @param file The image file to transcribe.
     * @param originalParentPath The original folder path where the image was created.
     */
    addToQueue(file: TFile, originalParentPath: string) {
        // Avoid adding duplicates if the file is already pending or processing
        const exists = this.queue.some(job => job.file.path === file.path && (job.status === 'pending' || job.status === 'processing'));
        if (exists) {
            console.log(`Job for ${file.path} already in queue.`);
            return;
        }

        const newJob: TranscriptionJob = {
            file: file,
            originalParentPath: originalParentPath,
            status: 'pending',
        };
        this.queue.push(newJob);
        console.log(`Added ${file.path} to queue. Queue size: ${this.queue.length}`);
        this.triggerProcessing();
    }

    /**
     * Triggers the processing of the next job if not already processing.
     */
    private triggerProcessing() {
        if (this.isProcessing) {
            console.log('Already processing, skipping trigger.');
            return;
        }
        this.processNext();
    }

    /**
     * Processes the next pending job in the queue.
     */
    async processNext() {
        if (this.isProcessing) {
            return; // Already processing
        }

        const nextJob = this.queue.find(job => job.status === 'pending');

        if (!nextJob) {
            console.log('No pending jobs in queue.');
            this.isProcessing = false;
            return; // No pending jobs
        }

        this.isProcessing = true;
        nextJob.status = 'processing';
        console.log(`Processing job for ${nextJob.file.path}`);

        try {
            // Call the actual processing function (AI transcription)
            await this.processCallback(nextJob);
            // Status (done/error) should be set within the callback or subsequent steps
        } catch (error) {
            console.error(`Error processing job for ${nextJob.file.path}:`, error);
            this.markAsError(nextJob, error instanceof Error ? error.message : String(error));
        } finally {
            // Remove the processed job from the queue for simplicity 
            // (Alternative: keep history with done/error status)
            this.queue = this.queue.filter(job => job.file.path !== nextJob.file.path || (job.status !== 'done' && job.status !== 'error'));
            
            this.isProcessing = false;
            console.log(`Finished processing job for ${nextJob.file.path}. Queue size: ${this.queue.length}`);
            // Check if there are more jobs to process
            this.processNext(); 
        }
    }

    /**
     * Marks a job as successfully completed.
     * @param job The job to mark as done.
     */
    markAsDone(job: TranscriptionJob) {
        job.status = 'done';
        console.log(`Job for ${job.file.path} marked as done.`);
        // Optionally: keep the job in the queue with status 'done' or remove it
    }

    /**
     * Marks a job as failed with an error.
     * @param job The job to mark as error.
     * @param errorMessage The error message.
     */
    markAsError(job: TranscriptionJob, errorMessage: string) {
        job.status = 'error';
        job.error = errorMessage;
        console.log(`Job for ${job.file.path} marked as error: ${errorMessage}`);
        // Optionally: keep the job in the queue with status 'error' or remove it
    }

    // Optional: Methods for persisting/restoring queue state could be added here
    // loadQueueState() { ... }
    // saveQueueState() { ... }
} 