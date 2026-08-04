import { Worker, Job } from "bullmq";
import redisConnection from "../config/redis";
import { sendSms } from "../config/sms";
import { SmsJobData } from "../queues/sms.queue";

const smsWorker = new Worker(
  "sms",
  async (job: Job<SmsJobData>) => {
    const { to, message } = job.data;

    console.log(`📱 Processing SMS job ${job.id}: ${to}`);

    const result = await sendSms({ to, message });

    console.log(`✅ SMS sent: ${result.id}`);

    return { messageId: result.id };
  },
  {
    connection: redisConnection,
    concurrency: 5,
  }
);

smsWorker.on("completed", (job) => {
  console.log(`✅ SMS job ${job.id} completed`);
});

smsWorker.on("failed", (job, err) => {
  console.error(`❌ SMS job ${job?.id} failed:`, err.message);
});

export default smsWorker;
