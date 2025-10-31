// lib/email/transporter.ts
import nodemailer from "nodemailer";
import { DISCLAIMER_TEXT, DISCLAIMER_TITLE } from "@/assets/disclaimers/20251030"; //  Import shared disclaimer

export const transporter = nodemailer.createTransport({
  service: process.env.TRANSPORT_SERVICE, // e.g., 'Gmail'
  auth: {
    user: process.env.TRANSPORT_SENDER,
    pass: process.env.TRANSPORT_PSWD, // Prefer an App Password if using Gmail
  },
});

export async function sendOtpEmail(to: string, code: string) {
  const from = process.env.TRANSPORT_LABEL ?? `"Strategic Machines" <${process.env.TRANSPORT_SENDER}>`;
  const html = `
    <div style="font-family:Inter,system-ui,Segoe UI,Helvetica,Arial,sans-serif">
      <h2>Your verification code</h2>
      <p>Use the following 6-digit code to activate your agent:</p>
      <div style="font-size:28px;font-weight:700;letter-spacing:8px">${code}</div>
      <p style="color:#666">This code expires in 10 minutes.</p>
      <p>By entering this OTP, you acknowledge and agree to the following disclaimer:</p>
      <div style="font-size:small; color:#666; white-space:pre-line;">
        <strong>${DISCLAIMER_TITLE}</strong>
        ${DISCLAIMER_TEXT}
      </div>
    </div>
  `;
  const attachments = [
    {
      filename: 'logo.png',
      path: 'https://res.cloudinary.com/stratmachine/image/upload/v1592332363/machine/icon-512x512_zaffp5.png',
      cid: 'logo@strategicmachines' // Unique CID
    }
  ]


  await transporter.sendMail({
    from,
    to,
    subject: "Your verification code",
    html,
    attachments
  });
}