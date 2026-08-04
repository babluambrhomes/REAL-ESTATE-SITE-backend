// ⚠️ COMMENTED OUT - Now using Resend (src/config/resend.ts)
// import nodemailer from "nodemailer";

// const transporter = nodemailer.createTransport({
//   host: process.env.SMTP_HOST,
//   port: Number(process.env.SMTP_PORT),
//   secure: true,
//   auth: {
//     user: process.env.SMTP_USER,
//     pass: process.env.SMTP_PASS,
//   },
// });

// export const verifyConnection = async () => {
//   try {
//     await transporter.verify();
//     console.log("✅ SMTP connection verified");
//   } catch (error) {
//     console.warn("⚠️ SMTP not configured. Emails will log to console.");
//   }
// };

// export default transporter;
