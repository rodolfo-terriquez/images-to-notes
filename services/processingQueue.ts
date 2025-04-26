import { TFile } from 'obsidian';
import { ProcessingJob, ProcessingStatus } from '../models/processingJob'; // Updated import

export class ProcessingQueue { // Renamed class
    private queue: ProcessingJob[] = [];
    private isProcessing: boolean = false;

    // The actual processing logic is now injected via setProcessCallback
    private processCallback: (job: ProcessingJob) => Promise<void> = async () => { // Updated type
        // This should never be called if setProcessCallback is used correctly
        console.error('ProcessingQueue: processCallback was not set!'); // Updated error message
        // Optionally throw an error or handle it gracefully
        // throw new Error("Process callback not set");
    };

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
        const exists = this.queue.some(job => job.initialFile.path === file.path && (job.status === 'pending' || job.status === 'processing'));
        if (exists) {
            console.log(`Job for ${file.path} already in queue.`);
            return;
        }

        const newJob: ProcessingJob = {
            initialFile: file, // Store the initial file
            // originalParentPath: originalParentPath, // No longer needed here, will be derived in processing
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
        console.log(`Processing job for initial file ${nextJob.initialFile.path}`); // Log initial path

        try {
            // Call the actual processing function (will handle convert, compress, move, transcribe, etc.)
            await this.processCallback(nextJob);
            // Status (done/error) should be set within the callback or subsequent steps
        } catch (error) {
            console.error(`Error processing job for initial file ${nextJob.initialFile.path}:`, error);
            this.markAsError(nextJob, error instanceof Error ? error.message : String(error));
        } finally {
            // Remove the processed job from the queue
            // Find the index of the job based on its initial file path, as the job object reference might change if modified in callback
            const jobIndex = this.queue.findIndex(job => job.initialFile.path === nextJob.initialFile.path);
            if (jobIndex > -1) {
                this.queue.splice(jobIndex, 1);
            }
            
            this.isProcessing = false;
            console.log(`Finished processing job for initial file ${nextJob.initialFile.path}. Queue size: ${this.queue.length}`);
            // Check if there are more jobs to process
            this.processNext(); 
        }
    }

    /**
     * Marks a job as successfully completed.
     * Called by the processCallback function.
     * @param job The job to mark as done.
     */
    markAsDone(job: ProcessingJob) {
        job.status = 'done';
        console.log(`Job for initial file ${job.initialFile.path} marked as done.`);
        // Job will be removed in the finally block of processNext
    }

    /**
     * Marks a job as failed with an error.
     * Called by the processCallback function or the catch block.
     * @param job The job to mark as error.
     * @param errorMessage The error message.
     */
    markAsError(job: ProcessingJob, errorMessage: string) {
        job.status = 'error';
        job.error = errorMessage;
        console.log(`Job for initial file ${job.initialFile.path} marked as error: ${errorMessage}`);
        // Job will be removed in the finally block of processNext
    }

} 