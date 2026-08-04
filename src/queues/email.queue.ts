import { Queue } from "bullmq";
import redisConnection from "../config/redis";

export interface EmailJobData {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

const emailQueue = new Queue<EmailJobData>("email", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

export default emailQueue;
