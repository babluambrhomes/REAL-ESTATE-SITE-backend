import { Worker, Job } from "bullmq";
import redisConnection from "../config/redis";
import { sendEmail } from "../config/resend";
import { EmailJobData } from "../queues/email.queue";

const emailWorker = new Worker(
  "email",
  async (job: Job<EmailJobData>) => {
    const { to, subject, html, text } = job.data;

    console.log(`📧 Processing email job ${job.id}: ${subject} → ${to}`);

    const result = await sendEmail({
      to,
      subject,
      html,
      text,
    });

    console.log(`✅ Email sent via Resend: ${result.id}`);

    return { messageId: result.id! };
  },
  {
    connection: redisConnection,
    concurrency: 5,
  }
);

emailWorker.on("completed", (job) => {
  console.log(`✅ Email job ${job.id} completed`);
});

emailWorker.on("failed", (job, err) => {
  console.error(`❌ Email job ${job?.id} failed:`, err.message);
});

export default emailWorker;
