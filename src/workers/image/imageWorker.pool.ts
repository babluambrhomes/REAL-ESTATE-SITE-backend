import { Worker } from "worker_threads";
import path from "path";
import fs from "fs";
import os from "os";
import crypto from "crypto";
import { ImageJobRequest, ImageJobResult } from "./image.types";

const JOB_TIMEOUT_MS = 30_000;
const MAX_POOL_SIZE = Math.min(4, os.availableParallelism?.() ?? os.cpus().length);

interface PendingJob {
  resolve: (result: ImageJobResult) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
}

interface PoolWorker {
  worker: Worker;
  pending: Map<string, PendingJob>;
  dead: boolean;
}

let pool: PoolWorker[] | null = null;

const getWorkerPath = (): string => {
  const tsPath = path.join(__dirname, "image.worker.ts");
  if (fs.existsSync(tsPath)) {
    return tsPath;
  }
  return path.join(__dirname, "image.worker.js");
};

const failAll = (entry: PoolWorker, err: Error) => {
  for (const [, pending] of entry.pending) {
    clearTimeout(pending.timer);
    pending.reject(err);
  }
  entry.pending.clear();
};

const spawnWorker = (): PoolWorker => {
  const entry: PoolWorker = {
    worker: new Worker(getWorkerPath()),
    pending: new Map(),
    dead: false,
  };

  entry.worker.on("message", (result: ImageJobResult) => {
    const pending = entry.pending.get(result.jobId);
    if (pending) {
      entry.pending.delete(result.jobId);
      clearTimeout(pending.timer);
      pending.resolve(result);
    }
  });

  const handleFailure = (err: Error) => {
    if (entry.dead) return;
    entry.dead = true;
    failAll(entry, err);
    replaceWorker(entry);
  };

  entry.worker.on("error", (err) =>
    handleFailure(err instanceof Error ? err : new Error(String(err)))
  );

  entry.worker.on("exit", (code) => {
    if (code !== 0 || entry.pending.size > 0) {
      handleFailure(new Error(`Image worker exited unexpectedly (code ${code})`));
    }
  });

  return entry;
};

const replaceWorker = (entry: PoolWorker) => {
  if (!pool) return;
  const index = pool.indexOf(entry);
  if (index > -1) {
    pool[index] = spawnWorker();
  }
};

const getPool = (): PoolWorker[] => {
  if (!pool) {
    pool = Array.from({ length: MAX_POOL_SIZE }, () => spawnWorker());
  }
  return pool;
};

const getLeastBusy = (workers: PoolWorker[]): PoolWorker =>
  workers.reduce((least, current) =>
    current.pending.size < least.pending.size ? current : least
  );

export const processImage = (
  request: Omit<ImageJobRequest, "jobId">
): Promise<ImageJobResult> => {
  const workers = getPool();
  const entry = getLeastBusy(workers);
  const jobId = crypto.randomUUID();
  const job: ImageJobRequest = { ...request, jobId };

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const pending = entry.pending.get(jobId);
      if (pending) {
        entry.pending.delete(jobId);
        pending.reject(new Error("Image processing timed out"));
      }
    }, JOB_TIMEOUT_MS);

    entry.pending.set(jobId, { resolve, reject, timer });
    entry.worker.postMessage(job);
  });
};

export const terminateImageWorkers = async (): Promise<void> => {
  if (!pool) return;
  const workers = pool;
  pool = null;
  await Promise.allSettled(workers.map((entry) => entry.worker.terminate()));
};
