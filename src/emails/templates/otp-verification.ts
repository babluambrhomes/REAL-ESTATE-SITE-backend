export const otpVerificationTemplate = (data: { code: string; userName?: string }) => ({
  subject: "Verify your email - AmbrHomes",
  html: `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;">
      <div style="background:#1a1a2e;padding:30px;text-align:center;">
        <h1 style="color:#fff;margin:0;">AmbrHomes</h1>
      </div>
      <div style="background:#fff;padding:40px 30px;">
        <h2 style="color:#333;">Email Verification</h2>
        <p style="color:#666;">Hi ${data.userName || "User"},</p>
        <p style="color:#666;">Use this OTP to verify your email:</p>
        <div style="background:#f4f4f4;border:2px dashed #1a1a2e;border-radius:8px;padding:20px;text-align:center;margin:20px 0;">
          <span style="font-size:32px;font-weight:bold;letter-spacing:12px;color:#1a1a2e;">${data.code}</span>
        </div>
        <p style="color:#999;font-size:13px;">Valid for 10 minutes. Ignore if you didn't request this.</p>
      </div>
    </div>
  `,
});


