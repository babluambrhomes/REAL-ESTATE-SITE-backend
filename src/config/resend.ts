import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export const sendEmail = async ({ to, subject, html, text }: SendEmailParams) => {
  const data = await resend.emails.send({
    from: process.env.RESEND_FROM || "AmbrHomes <onboarding@resend.dev>",
    to,
    subject,
    html,
    text,
  });

  console.log(`✅ Email sent via Resend: ${data.data?.id}`);
  return data.data!;
};
