import { TFile } from 'obsidian';
import { ProcessingJob, ProcessingStatus } from '../models/processingJob';

export class ProcessingQueue {
    private queue: ProcessingJob[] = [];
    private isProcessing: boolean = false;
    private processing: ProcessingJob | null = null;
    private maxConcurrent: number = 2; // Default max concurrent processing jobs
    private activeJobs: number = 0; // Track number of active jobs

    // The actual processing logic is now injected via setProcessCallback
    private processCallback: (job: ProcessingJob) => Promise<void> = async () => { // Updated type
        // This should never be called if setProcessCallback is used correctly
        // console.error('ProcessingQueue: processCallback was not set!'); // Updated error message
        // Optionally throw an error or handle it gracefully
        // throw new Error("Process callback not set");
    };
    
    /**
     * Sets the maximum number of concurrent processing jobs.
     * Useful for mobile optimization to limit resource usage.
     * @param max The maximum number of concurrent jobs (1-5)
     */
    public setMaxConcurrent(max: number): void {
        // Ensure max is between 1 and 5
        this.maxConcurrent = Math.max(1, Math.min(5, max));
        console.log(`ProcessingQueue: Max concurrent jobs set to ${this.maxConcurrent}`);
    }

    // Setter for the processing callback
    public setProcessCallback(callback: (job: ProcessingJob) => Promise<void>) { // Updated type
        this.processCallback = callback;
    }

    /**
     * Adds a file to the processing queue.
     * @param file The initial image file to process.
     */
    addToQueue(file: TFile) { // Simplified: only needs the initial file
        // Avoid adding duplicates if the file is already pending or processing
        if (this.queue.some(existingJob => existingJob.initialFile.path === file.path) || this.processing?.initialFile.path === file.path) {
            // console.log(`Job for ${file.path} already in queue.`);
            return;
        }

        const newJob: ProcessingJob = {
            initialFile: file,
            status: 'pending', // Use string literal
            // error is initially undefined by default for optional properties
            // Removed startTime and explicit error: null assignment
        };
        // Removed jobId generation
        this.queue.push(newJob);
        // Removed jobMap usage for now
        // console.log(`Added ${file.path} to queue. Queue size: ${this.queue.length}`);
        this.startProcessing();
        // Removed return statement
    }

    /**
     * Triggers the processing of the next job if not already processing.
     */
    private startProcessing(): void {
        if (this.isProcessing) {
            // console.log('Already processing, skipping trigger.');
            return;
        }
        this.processNext();
    }

    /**
     * Processes the next pending job in the queue.
     * Respects maxConcurrent limit for mobile optimization.
     */
    async processNext() {
        // Check if we're already at the maximum number of concurrent jobs
        if (this.activeJobs >= this.maxConcurrent) {
            // console.log(`Already at max concurrent jobs (${this.activeJobs}/${this.maxConcurrent}), waiting...`);
            return; // Already at max concurrent jobs
        }

        // Check if we're already processing (legacy check, can be removed if activeJobs is fully implemented)
        if (this.isProcessing) {
            return; // Already processing
        }

        const nextJob = this.queue.find(job => job.status === 'pending');

        if (!nextJob) {
            // console.log('No pending jobs in queue.');
            this.isProcessing = false;
            this.processing = null;
            return; // No pending jobs
        }

        this.isProcessing = true;
        this.processing = nextJob;
        this.activeJobs++; // Increment active jobs counter

        // console.log(`Processing job for initial file ${nextJob.initialFile.path}. Active jobs: ${this.activeJobs}/${this.maxConcurrent}`);

        try {
            // Call the actual processing function (will handle convert, compress, move, transcribe, etc.)
            await this.processCallback(nextJob);
            // Status (done/error) should be set within the callback or subsequent steps
        } catch (error) {
            // console.error(`Error processing job for initial file ${nextJob.initialFile.path}:`, error);
            this.markAsError(nextJob, error instanceof Error ? error.message : String(error));
        } finally {
            // Regardless of success or error, clean up
            // console.log(`Finished processing job for initial file ${nextJob.initialFile.path}. Queue size: ${this.queue.length}`);
            this.processing = null;
            this.isProcessing = false;
            this.activeJobs--; // Decrement active jobs counter
            
            // Check if there are more jobs to process
            this.processNext(); 
        }
    }

    /**
     * Marks a job as successfully completed.
     * Called by the processCallback function.
     * @param job The job to mark as done.
     */
    markAsDone(job: ProcessingJob): void {
        if (job.status !== 'done') { // Use string literal
            job.status = 'done'; // Use string literal
            // console.log(`Job for initial file ${job.initialFile.path} marked as done.`);
        }
    }

    /**
     * Marks a job as failed with an error.
     * Called by the processCallback function or the catch block.
     * @param job The job to mark as error.
     * @param errorMessage The error message.
     */
    markAsError(job: ProcessingJob, errorMessage: string): void {
        if (job.status !== 'error') { // Use string literal
            job.status = 'error'; // Use string literal
            job.error = errorMessage;
            // console.log(`Job for initial file ${job.initialFile.path} marked as error: ${errorMessage}`);
        }
    }

} 