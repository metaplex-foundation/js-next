import { AbortSignal } from 'abort-controller';
import { EventEmitter } from 'eventemitter3';

export type AbortSignalScope = {
  isCanceled: () => boolean;
  getCancelationError: () => unknown;
  throwIfCanceled: () => void;
};

export const useAbortSignal = (signal: AbortSignal | undefined) => {
  // Abort getters.
  let cancelationError: unknown = null;
  const isCanceled = () => signal?.aborted ?? false;
  const getCancelationError = () => cancelationError;

  // Abort listeners.
  const eventEmitter = new EventEmitter();
  const close = () => {
    signal?.removeEventListener('abort', abortListener);
    eventEmitter.removeAllListeners();
  };
  const abortListener = (error: unknown) => {
    cancelationError = error;
    eventEmitter.emit('cancel', error);
    close();
  };
  signal?.addEventListener('abort', abortListener);

  // Abort scope to give to the callback.
  const scope: AbortSignalScope = {
    isCanceled,
    getCancelationError,
    throwIfCanceled: () => {
      if (isCanceled()) {
        throw getCancelationError();
      }
    },
  };
  const run = async <T = unknown>(callback: (scope: AbortSignalScope) => T): Promise<T> => {
    try {
      return await Promise.resolve(callback(scope));
    } finally {
      close();
    }
  };

  return {
    run,
    isCanceled,
    getCancelationError,
    onCancel(callback: (reason: unknown) => unknown) {
      eventEmitter.on('cancel', callback);
      return this; 
    },
  };
};
