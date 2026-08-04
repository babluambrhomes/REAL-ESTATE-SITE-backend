interface SendSmsParams {
  to: string;
  message: string;
}

// Placeholder — actual SMS provider (Twilio/MSG91) integrate later
const sendSms = async ({ to, message }: SendSmsParams) => {
  console.log(`📱 SMS to ${to}: ${message}`);
  // TODO: integrate actual SMS provider
  return { id: `sms_${Date.now()}` };
};

export { sendSms };
