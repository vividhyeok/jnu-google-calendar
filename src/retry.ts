type RetryOptions = {
  retries: number;
  delayMs: number;
  factor?: number;
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function withRetry<T>(
  task: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  const {
    retries,
    delayMs,
    factor = 1.5,
    shouldRetry = () => true,
    onRetry,
  } = options;

  let currentDelay = delayMs;

  for (let attempt = 1; attempt <= retries + 1; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      const isLastAttempt = attempt > retries;
      if (isLastAttempt || !shouldRetry(error, attempt)) throw error;

      onRetry?.(error, attempt, Math.round(currentDelay));
      await sleep(Math.round(currentDelay));
      currentDelay *= factor;
    }
  }

  throw new Error('Unreachable');
}
