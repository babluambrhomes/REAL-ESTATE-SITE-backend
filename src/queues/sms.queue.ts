import { Queue } from "bullmq";
import redisConnection from "../config/redis";

export interface SmsJobData {
  to: string;
  message: string;
}

const smsQueue = new Queue<SmsJobData>("sms", {
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

export default smsQueue;
