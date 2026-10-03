import { Resend } from "resend";
import { ENV } from "../config/env";

export class EmailService {
  private static resendClient: Resend | null = ENV.RESEND_API_KEY
    ? new Resend(ENV.RESEND_API_KEY)
    : null;

  /**
   * Send student registration OTP to their university/registered email using Resend
   */
  static async sendOtpEmail(
    toEmail: string,
    otp: string,
    studentName: string,
    enrollmentNo: string
  ): Promise<{ success: boolean; messageId?: string }> {
    if (!this.resendClient) {
      console.log(
        `\n[Resend Email Mock] 📧 Email to: ${toEmail} (${studentName} - ${enrollmentNo})`
      );
      console.log(`[Resend Email Mock] 🔑 OTP: ${otp} (Valid for 15 minutes)`);
      console.log(
        `[Resend Email Mock] 💡 Note: Set RESEND_API_KEY in .env to dispatch live emails.\n`
      );
      return { success: true, messageId: "mock-email-id" };
    }

    try {
      const response = await this.resendClient.emails.send({
        from: ENV.EMAIL_FROM,
        to: toEmail,
        subject: `Your GBU Smart Campus Verification Code: ${otp}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 550px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
            <div style="text-align: center; margin-bottom: 24px;">
              <h2 style="color: #1e293b; margin: 0; font-size: 22px;">Gautam Buddha University</h2>
              <p style="color: #64748b; font-size: 14px; margin: 4px 0 0 0;">Smart Campus Issue Management & Resolution System</p>
            </div>
            
            <div style="background-color: #f8fafc; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
              <p style="margin: 0; color: #334155; font-size: 15px;">Hello <strong>${studentName}</strong> (${enrollmentNo}),</p>
              <p style="margin: 8px 0 0 0; color: #475569; font-size: 14px;">
                Use the following One-Time Password (OTP) to verify your university enrollment and activate your Smart Campus account:
              </p>
            </div>

            <div style="text-align: center; margin: 28px 0;">
              <span style="display: inline-block; font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #0284c7; background-color: #f0f9ff; padding: 12px 28px; border-radius: 8px; border: 1px dashed #38bdf8;">
                ${otp}
              </span>
              <p style="color: #94a3b8; font-size: 12px; margin-top: 8px;">Valid for 15 minutes. Never share this code with anyone.</p>
            </div>

            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
            <p style="color: #94a3b8; font-size: 12px; text-align: center; margin: 0;">
              If you did not request this verification, please report it immediately to GBU ICT / System Administration.
            </p>
          </div>
        `,
      });

      if (response.error) {
        console.error("[Resend] Error sending email:", response.error);
        return { success: false };
      }

      console.log(`[Resend] OTP email successfully sent to ${toEmail} (ID: ${response.data?.id})`);
      return { success: true, messageId: response.data?.id };
    } catch (error) {
      console.error("[Resend] Exception dispatching email:", error);
      return { success: false };
    }
  }
}
