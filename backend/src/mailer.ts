import nodemailer from 'nodemailer';

export interface SendInviteEmailOptions {
  to: string;
  token: string;
}

export function getFrontendBaseUrl(): string {
  const url =
    process.env.FRONTEND_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    'https://smartcomp.vercel.app';
  return url.replace(/\/+$/, '');
}

export async function sendInviteEmail({
  to,
  token,
}: SendInviteEmailOptions): Promise<void> {
  if (
    process.env.SIMULATE_GMAIL_FAILURE === 'true' ||
    process.env.NODE_ENV === 'test'
  ) {
    if (process.env.SIMULATE_GMAIL_FAILURE === 'true') {
      throw new Error('gmail-send-failed');
    }
    return;
  }

  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    return;
  }

  const baseUrl = getFrontendBaseUrl();
  const acceptUrl = `${baseUrl}/admin/invite/accept?token=${encodeURIComponent(token)}`;

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });

  const subject = 'Invitation to join the ABU Smart Class Lab Team';
  const text = `Ahmadu Bello University, Zaria
Department of Computer Engineering · Faculty of Engineering
Smart Classroom Inventory Management System

Hello,

You have been invited by an administrator to join the ABU Smart Class Lab Team.

As a lab team administrator, you will have permission to:
- Record and update equipment inventory, operational condition, and quantity.
- Upload verified equipment photographs to the departmental archive.
- Manage lab team roster access and generate COREN accreditation reports.

Accept your invitation and set your account password by visiting the following link:
${acceptUrl}

Security Notice:
- This invitation link is single-use and will be permanently invalidated once your password is created.
- Password floor: at least 8 characters.
- If you were not expecting this invitation, you can safely ignore this email.

Department of Computer Engineering
Faculty of Engineering, Ahmadu Bello University, Zaria, Nigeria`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>ABU Smart Class Invitation</title>
</head>
<body style="margin: 0; padding: 24px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f6f8f7; color: #1f2937;">
  <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 580px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
    <tr>
      <td style="background-color: #166534; padding: 28px 32px; text-align: left;">
        <p style="margin: 0 0 6px 0; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #86efac;">Ahmadu Bello University, Zaria</p>
        <h1 style="margin: 0 0 4px 0; font-size: 20px; font-weight: 700; color: #ffffff; line-height: 1.3;">Smart Classroom Inventory</h1>
        <p style="margin: 0; font-size: 13px; color: #bbf7d0;">Department of Computer Engineering · Faculty of Engineering</p>
      </td>
    </tr>
    <tr>
      <td style="padding: 32px 32px 24px 32px;">
        <h2 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600; color: #111827;">You've been invited to join the Lab Team</h2>
        <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #374151;">
          Hello,
        </p>
        <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #374151;">
          An administrator has invited you to join the <strong>ABU Smart Class Lab Team</strong> to help manage and maintain the digital equipment register for the Computer Engineering Smart Classroom.
        </p>
        <div style="background-color: #f9fafb; border-radius: 8px; border: 1px solid #f3f4f6; padding: 16px 20px; margin: 24px 0;">
          <p style="margin: 0 0 10px 0; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280;">Administrator Capabilities</p>
          <ul style="margin: 0; padding-left: 20px; font-size: 13px; line-height: 1.6; color: #4b5563;">
            <li style="margin-bottom: 6px;">Record and update equipment condition, quantity, and functionality</li>
            <li style="margin-bottom: 6px;">Upload verified equipment photographs to the departmental archive</li>
            <li>Manage lab team access and generate COREN accreditation reports</li>
          </ul>
        </div>
        <p style="margin: 24px 0; text-align: center;">
          <a href="${acceptUrl}" style="display: inline-block; background-color: #166534; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; padding: 12px 28px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">Accept Invitation & Set Password</a>
        </p>
        <p style="margin: 20px 0 0 0; font-size: 12px; line-height: 1.5; color: #6b7280;">
          Or copy and paste this URL into your browser:<br>
          <a href="${acceptUrl}" style="color: #166534; word-break: break-all;">${acceptUrl}</a>
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding: 20px 32px 24px 32px; background-color: #f9fafb; border-top: 1px solid #f3f4f6;">
        <p style="margin: 0 0 8px 0; font-size: 12px; font-weight: 600; color: #374151;">Security Notice</p>
        <p style="margin: 0 0 12px 0; font-size: 12px; line-height: 1.5; color: #6b7280;">
          This link is <strong>single-use</strong> and will be permanently invalidated once your password has been set. Passwords must be at least 8 characters long.
        </p>
        <p style="margin: 0; font-size: 11px; line-height: 1.4; color: #9ca3af;">
          If you did not expect this invitation, you can ignore this message. Nothing on the inventory register has been changed.
        </p>
      </td>
    </tr>
  </table>
  <p style="margin: 16px 0 0 0; text-align: center; font-size: 11px; color: #9ca3af;">
    Faculty of Engineering · Ahmadu Bello University, Zaria, Nigeria
  </p>
</body>
</html>`;

  await transporter.sendMail({
    from: `"ABU Smart Class" <${user}>`,
    to,
    subject,
    text,
    html,
  });
}
