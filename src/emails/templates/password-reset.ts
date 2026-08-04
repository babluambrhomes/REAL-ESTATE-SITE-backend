


export const passwordResetLinkTemplate = (data: { link: string; userName?: string }) => ({
  subject: "Reset your password - AmbrHomes",
  html: `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;">
      <div style="background:#1a1a2e;padding:30px;text-align:center;">
        <h1 style="color:#fff;margin:0;">AmbrHomes</h1>
      </div>
      <div style="background:#fff;padding:40px 30px;">
        <h2 style="color:#333;">Password Reset</h2>
        <p style="color:#666;">Hi ${data.userName || "User"},</p>
        <p style="color:#666;">We received a request to reset your password. Click the button below to set a new password:</p>
        <div style="text-align:center;margin:30px 0;">
          <a href="${data.link}" style="display:inline-block;background:#1a1a2e;color:#fff;padding:14px 40px;border-radius:6px;text-decoration:none;font-weight:bold;">Reset Password</a>
        </div>
        <p style="color:#999;font-size:13px;">This link expires in 15 minutes. If you didn't request this, please ignore this email.</p>
      </div>
    </div>
  `,
});
