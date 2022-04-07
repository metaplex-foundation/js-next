import { Metaplex } from '../Metaplex';

export type LoaderStatus = 'pending' | 'running' | 'successful' | 'failed' | 'canceled';

export interface LoaderOptions {
  failSilently?: boolean;
}

export abstract class Loader {
  protected status: LoaderStatus = 'pending';
  protected error?: unknown;
  protected abortSignal: AbortSignal;

  public abstract handle(metaplex: Metaplex): Promise<void>;

  constructor() {
    this.abortSignal = new AbortController().signal;
  }

  setAbortSignal(abortSignal: AbortSignal) {
    this.abortSignal = abortSignal;

    return this;
  }

  async reload(metaplex: Metaplex, options: LoaderOptions = {}) {
    if (this.isLoading()) return;

    // Prepare abort listener.
    const abortListener = (reason: unknown) => {
      this.status = 'canceled';
      this.error = reason;
    };
    this.abortSignal.addEventListener('abort', abortListener, { once: true });

    try {
      // Start loading.
      this.status = 'running';
      await this.handle(metaplex);

      // Mark as successful if the loader wasn't aborted.
      if (!this.wasCanceled()) {
        this.status = 'successful';
      }
    } catch (error) {
      // Capture the error and the failed status.
      this.status = 'failed';
      this.error = error;

      // Re-thow the error unless we want to fail silently.
      if (!(options.failSilently ?? false)) {
        throw error;
      }
    } finally {
      // Clean up the abort listener.
      this.abortSignal.removeEventListener('abort', abortListener);
    }
  }

  async load(metaplex: Metaplex, options: LoaderOptions = {}) {
    if (this.status !== 'pending') return;
    await this.reload(metaplex, options);
  }

  reset() {
    this.status = 'pending';
    this.error = undefined;
  }

  getStatus(): LoaderStatus {
    return this.status;
  }

  getError(): unknown {
    return this.error;
  }

  isLoading(): boolean {
    return this.status === 'running';
  }

  isLoaded(): boolean {
    return this.status !== 'pending' && this.status !== 'running';
  }

  wasSuccessful(): boolean {
    return this.status === 'successful';
  }

  wasFailed(): boolean {
    return this.status === 'failed';
  }

  wasCanceled(): boolean {
    return this.status === 'canceled';
  }
}
