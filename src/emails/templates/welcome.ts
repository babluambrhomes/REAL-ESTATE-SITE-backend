export const welcomeTemplate = (data: { userName: string }) => ({
  subject: "Welcome to AmbrHomes!",
  html: `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;">
      <div style="background:#1a1a2e;padding:30px;text-align:center;">
        <h1 style="color:#fff;margin:0;">AmbrHomes</h1>
      </div>
      <div style="background:#fff;padding:40px 30px;text-align:center;">
        <h2 style="color:#333;">Welcome to AmbrHomes!</h2>
        <p style="color:#666;">Hi ${data.userName},</p>
        <p style="color:#666;">Your email has been verified. Your account is now active!</p>
        <a href="${process.env.CLIENT_URL || "http://localhost:3000"}/login" style="display:inline-block;background:#1a1a2e;color:#fff;padding:12px 30px;border-radius:6px;text-decoration:none;font-weight:bold;margin-top:20px;">Login Now</a>
      </div>
    </div>
  `,
});
