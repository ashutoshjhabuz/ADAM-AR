// =============================================================
// ADAM-AR v18.0.0 — Real Production Email Dispatch Engine
// =============================================================

import nodemailer from 'nodemailer';
import type { ScorecardRecord } from '../src/types';
import { DEFAULT_SENDER_EMAIL, FATAL_CC_EMAIL } from './fundsindia-directory';

export interface SmtpConfig {
  host?: string;
  port?: number;
  user?: string;
  pass?: string;
  from?: string;
  fromName?: string;
  secure?: boolean;
}

export interface EmailDispatchOptions {
  to: string;
  cc?: string;
  bcc?: string;
  from?: string;
  fromName?: string;
  subject: string;
  scorecards: ScorecardRecord[];
  advisorName?: string;
  smtpConfig?: SmtpConfig;
}

export interface EmailDispatchResult {
  success: boolean;
  messageId?: string;
  status: 'sent' | 'failed';
  errorMessage?: string;
  recipient: string;
  cc?: string;
  smtpResponse?: string;
}

/**
 * Creates a real authenticated Nodemailer SMTP transporter.
 * If credentials are missing, throws a descriptive error so the user knows to configure them.
 */
export function createMailTransporter(config?: SmtpConfig) {
  const host = config?.host || process.env.SMTP_HOST;
  const port = config?.port || (process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587);
  const user = config?.user || process.env.SMTP_USER;
  const pass = config?.pass || process.env.SMTP_PASS;
  const secure = config?.secure !== undefined ? config.secure : port === 465;

  if (!host || !user || !pass) {
    throw new Error(
      'SMTP Server not configured. Please configure your SMTP Host, Port, Username, and Password in the Mail Settings tab to send real emails to inboxes.'
    );
  }

  // Gmail special optimization
  if (host.includes('gmail.com')) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user,
        pass, // Gmail 16-character App Password
      },
      tls: {
        rejectUnauthorized: false,
      },
    });
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });
}

/**
 * Tests live connection to the configured SMTP mail server
 */
export async function testSmtpConnection(config?: SmtpConfig): Promise<{ ok: boolean; message: string }> {
  try {
    const transporter = createMailTransporter(config);
    await transporter.verify();
    return { ok: true, message: 'SMTP handshake verified successfully! Mail server is ready to dispatch real emails.' };
  } catch (err: unknown) {
    return { ok: false, message: (err as Error).message || 'Failed to connect to SMTP server.' };
  }
}

/**
 * Renders HTML email template for compliance scorecards in exact FundsIndia / SEBI layout
 */
export function renderScorecardEmailHtml(scorecards: ScorecardRecord[], advisorName?: string): string {
  const isBulk = scorecards.length > 1;
  const title = isBulk
    ? `SEBI Regulatory Compliance Audit Batch — ${advisorName || 'Advisor'} (${scorecards.length} Calls)`
    : `Offline Pre Order Confirmation Call Audit Score Card — ${scorecards[0]?.client || 'Client'}`;

  const scorecardsHtml = scorecards
    .map((s) => {
      const isFatal = s.is_fatal || s.q1_status === 'FAIL' || s.q2_status === 'FAIL' || s.q5_status === 'FAIL' || s.score === 0;
      const stars = isFatal ? '*' : '*'.repeat(s.score || 0);

      return `
    <div style="margin-bottom: 32px; border: 1px solid #94a3b8; border-radius: 8px; overflow: hidden; background-color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <!-- Card Blue Header Title -->
      <div style="background-color: #1e3a8a; color: #ffffff; font-weight: bold; text-align: center; padding: 10px 16px; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">
        Offline Pre Order Confirmation Call Audit Score Card
      </div>

      <div style="padding: 16px;">
        <!-- Metadata 2x4 Grid -->
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #94a3b8; font-size: 12px; margin-bottom: 16px;">
          <tr>
            <th style="border: 1px solid #94a3b8; background-color: #e2e8f0; padding: 6px 10px; text-align: left; width: 25%; color: #1e293b;">Caller Name</th>
            <td style="border: 1px solid #94a3b8; background-color: #f8fafc; padding: 6px 10px; width: 25%; color: #0f172a; font-weight: 500;">${s.caller_name || '—'}</td>
            <th style="border: 1px solid #94a3b8; background-color: #e2e8f0; padding: 6px 10px; text-align: left; width: 25%; color: #1e293b;">Team</th>
            <td style="border: 1px solid #94a3b8; background-color: #f8fafc; padding: 6px 10px; width: 25%; color: #0f172a; font-weight: 500;">${s.team || '—'}</td>
          </tr>
          <tr>
            <th style="border: 1px solid #94a3b8; background-color: #e2e8f0; padding: 6px 10px; text-align: left; color: #1e293b;">Client ID</th>
            <td style="border: 1px solid #94a3b8; background-color: #f8fafc; padding: 6px 10px; color: #0f172a; font-weight: bold; font-family: monospace;">${s.client || '—'}</td>
            <th style="border: 1px solid #94a3b8; background-color: #e2e8f0; padding: 6px 10px; text-align: left; color: #1e293b;">Phone Number</th>
            <td style="border: 1px solid #94a3b8; background-color: #f8fafc; padding: 6px 10px; color: #0f172a; font-family: monospace;">${s.trade_phone || s.calling_number || '—'}</td>
          </tr>
          <tr>
            <th style="border: 1px solid #94a3b8; background-color: #e2e8f0; padding: 6px 10px; text-align: left; color: #1e293b;">Trade Date</th>
            <td style="border: 1px solid #94a3b8; background-color: #f8fafc; padding: 6px 10px; color: #0f172a;">${s.trade_date || s.call_date || '—'}</td>
            <th style="border: 1px solid #94a3b8; background-color: #e2e8f0; padding: 6px 10px; text-align: left; color: #1e293b;">Audit Date</th>
            <td style="border: 1px solid #94a3b8; background-color: #f8fafc; padding: 6px 10px; color: #0f172a;">${s.created_at ? s.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10)}</td>
          </tr>
        </table>

        <!-- 5-Parameter Evaluation Table -->
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #94a3b8; font-size: 12px; margin-bottom: 16px;">
          <thead>
            <tr style="background-color: #1e3a8a; color: #ffffff; text-align: center;">
              <th style="border: 1px solid #94a3b8; padding: 8px 10px; text-align: left; width: 60%;">PARAMETERS</th>
              <th style="border: 1px solid #94a3b8; padding: 8px 10px; width: 12%;">Mark</th>
              <th style="border: 1px solid #94a3b8; padding: 8px 10px; width: 14%;">Flag</th>
              <th style="border: 1px solid #94a3b8; padding: 8px 10px; width: 14%;">Score</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="border: 1px solid #94a3b8; padding: 8px 10px; color: #b91c1c; font-weight: 500;">
                Confirmation given in the Customer's Registered / authorised Number ?
                ${s.q1_evidence ? `<div style="font-size: 11px; color: #64748b; font-style: italic; margin-top: 4px;">Quote: "${s.q1_evidence}"</div>` : ''}
              </td>
              <td style="border: 1px solid #94a3b8; padding: 8px 10px; text-align: center; font-weight: bold;">${s.q1_status === 'PASS' ? '1' : '0'}</td>
              <td style="border: 1px solid #94a3b8; padding: 8px 10px; text-align: center; color: #dc2626; font-weight: bold;">FATAL</td>
              <td style="border: 1px solid #94a3b8; padding: 8px 10px; text-align: center; font-weight: bold; color: ${s.q1_status === 'PASS' ? '#15803d' : '#b91c1c'};">${s.q1_status === 'PASS' ? 'Yes' : 'No'}</td>
            </tr>
            <tr>
              <td style="border: 1px solid #94a3b8; padding: 8px 10px; color: #b91c1c; font-weight: 500;">
                Was the client code explicitly confirmed before the order?
                ${s.q2_evidence ? `<div style="font-size: 11px; color: #64748b; font-style: italic; margin-top: 4px;">Quote: "${s.q2_evidence}"</div>` : ''}
              </td>
              <td style="border: 1px solid #94a3b8; padding: 8px 10px; text-align: center; font-weight: bold;">${s.q2_status === 'PASS' ? '1' : '0'}</td>
              <td style="border: 1px solid #94a3b8; padding: 8px 10px; text-align: center; color: #dc2626; font-weight: bold;">FATAL</td>
              <td style="border: 1px solid #94a3b8; padding: 8px 10px; text-align: center; font-weight: bold; color: ${s.q2_status === 'PASS' ? '#15803d' : '#b91c1c'};">${s.q2_status === 'PASS' ? 'Yes' : 'No'}</td>
            </tr>
            <tr>
              <td style="border: 1px solid #94a3b8; padding: 8px 10px; color: #1e293b;">
                Were stock name, price and quantity explicitly confirmed before the order?
                ${s.q3_evidence ? `<div style="font-size: 11px; color: #64748b; font-style: italic; margin-top: 4px;">Quote: "${s.q3_evidence}"</div>` : ''}
              </td>
              <td style="border: 1px solid #94a3b8; padding: 8px 10px; text-align: center; font-weight: bold;">${s.q3_status === 'PASS' ? '1' : '0'}</td>
              <td style="border: 1px solid #94a3b8; padding: 8px 10px; text-align: center;"></td>
              <td style="border: 1px solid #94a3b8; padding: 8px 10px; text-align: center; font-weight: bold; color: ${s.q3_status === 'PASS' ? '#15803d' : '#b91c1c'};">${s.q3_status === 'PASS' ? 'Yes' : 'No'}</td>
            </tr>
            <tr>
              <td style="border: 1px solid #94a3b8; padding: 8px 10px; color: #1e293b;">
                Customer Acknowledge the same?
                ${s.q4_evidence ? `<div style="font-size: 11px; color: #64748b; font-style: italic; margin-top: 4px;">Quote: "${s.q4_evidence}"</div>` : ''}
              </td>
              <td style="border: 1px solid #94a3b8; padding: 8px 10px; text-align: center; font-weight: bold;">${s.q4_status === 'PASS' ? '1' : '0'}</td>
              <td style="border: 1px solid #94a3b8; padding: 8px 10px; text-align: center;"></td>
              <td style="border: 1px solid #94a3b8; padding: 8px 10px; text-align: center; font-weight: bold; color: ${s.q4_status === 'PASS' ? '#15803d' : '#b91c1c'};">${s.q4_status === 'PASS' ? 'Yes' : 'No'}</td>
            </tr>
            <tr>
              <td style="border: 1px solid #94a3b8; padding: 8px 10px; color: #b91c1c; font-weight: 500;">
                Wasn't there any Return Commitment ?
                ${s.q5_evidence ? `<div style="font-size: 11px; color: #64748b; font-style: italic; margin-top: 4px;">Quote: "${s.q5_evidence}"</div>` : ''}
              </td>
              <td style="border: 1px solid #94a3b8; padding: 8px 10px; text-align: center; font-weight: bold;">${s.q5_status === 'PASS' ? '1' : '0'}</td>
              <td style="border: 1px solid #94a3b8; padding: 8px 10px; text-align: center; color: #dc2626; font-weight: bold;">FATAL</td>
              <td style="border: 1px solid #94a3b8; padding: 8px 10px; text-align: center; font-weight: bold; color: ${s.q5_status === 'PASS' ? '#15803d' : '#b91c1c'};">${s.q5_status === 'PASS' ? 'Yes' : 'No'}</td>
            </tr>
            <!-- Total Row -->
            <tr style="background-color: #ecfccb; font-weight: bold; color: #0f172a;">
              <td style="border: 1px solid #94a3b8; padding: 8px 10px; text-align: right;">TOTAL</td>
              <td style="border: 1px solid #94a3b8; padding: 8px 10px; text-align: center; font-size: 14px;">5</td>
              <td style="border: 1px solid #94a3b8; padding: 8px 10px; text-align: center; font-size: 16px; color: #854d0e;">${stars}</td>
              <td style="border: 1px solid #94a3b8; padding: 8px 10px; text-align: center; font-size: 16px; color: #1e3a8a;">${s.score !== null ? s.score : 'Pending'}</td>
            </tr>
          </tbody>
        </table>

        <!-- Comment Box -->
        <div style="border: 1px solid #94a3b8; background-color: #f8fafc; padding: 12px; font-size: 12px; color: #1e293b; line-height: 1.5;">
          <strong>Comment about the call:</strong> ${s.audit_comment || 'Pre Order Confirmation is as per the Regulatory Norm.'}
        </div>
      </div>
    </div>`;
    })
    .join('');

  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <title>${title}</title>
  </head>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; padding: 24px; margin: 0;">
    <div style="max-width: 800px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; padding: 24px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
      <div style="border-bottom: 2px solid #1e3a8a; padding-bottom: 16px; margin-bottom: 24px;">
        <h1 style="margin: 0 0 6px 0; color: #0f172a; font-size: 20px;">FundsIndia Compliance & Quality Assurance • AuditEQ Quality & Compliance Intelligence</h1>
        <p style="margin: 0; color: #64748b; font-size: 13px;">SEBI Regulatory Offline Pre-Order Call Audit Scorecard Summary</p>
      </div>

      ${scorecardsHtml}

      <div style="margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 16px; font-size: 11px; color: #94a3b8; text-align: center;">
        ADAM-AR FundsIndia Quality & Compliance Assurance Engine • Developed and designed by TAJ
      </div>
    </div>
  </body>
  </html>
  `;
}

/**
 * Dispatches an email containing one or multiple compliance scorecards using Nodemailer.
 * Dispatches REAL email across the internet to real inboxes.
 */
export async function sendScorecardEmail(options: EmailDispatchOptions): Promise<EmailDispatchResult> {
  const { to, cc, bcc, from, fromName, subject, scorecards, advisorName, smtpConfig } = options;

  if (!to || !to.includes('@')) {
    return {
      success: false,
      status: 'failed',
      errorMessage: `Invalid recipient email address: "${to}"`,
      recipient: to || 'undefined',
    };
  }

  // Detect whether any scorecard in this batch is marked FATAL
  const isAnyFatal = scorecards.some(
    (s) =>
      Boolean(s.is_fatal) ||
      s.score === 0 ||
      s.q1_status === 'FAIL' ||
      s.q2_status === 'FAIL' ||
      s.q5_status === 'FAIL'
  );

  const ccSet = new Set<string>();
  if (cc && cc.trim()) {
    cc.split(/[,;]/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
      .forEach((e) => ccSet.add(e));
  }

  if (isAnyFatal) {
    ccSet.add(FATAL_CC_EMAIL.toLowerCase());
  } else {
    ccSet.delete(FATAL_CC_EMAIL.toLowerCase());
  }

  const finalCcString = Array.from(ccSet).join(', ');

  let transporter;
  try {
    transporter = createMailTransporter(smtpConfig);
  } catch (err: unknown) {
    return {
      success: false,
      status: 'failed',
      errorMessage: (err as Error).message,
      recipient: to,
      cc: finalCcString,
    };
  }

  const senderAddress = from || smtpConfig?.from || smtpConfig?.user || DEFAULT_SENDER_EMAIL;
  const senderDisplayName = fromName || smtpConfig?.fromName || 'ADAM-AR Compliance';
  const htmlContent = renderScorecardEmailHtml(scorecards, advisorName);

  try {
    const info = await transporter.sendMail({
      from: `"${senderDisplayName}" <${senderAddress}>`,
      to,
      cc: finalCcString || undefined,
      bcc: bcc || undefined,
      subject,
      html: htmlContent,
    });

    return {
      success: true,
      status: 'sent',
      messageId: info.messageId,
      recipient: to,
      cc: finalCcString,
      smtpResponse: info.response,
    };
  } catch (error: unknown) {
    const err = error as Error;
    return {
      success: false,
      status: 'failed',
      errorMessage: err.message || 'Unknown email dispatch error',
      recipient: to,
      cc: finalCcString,
    };
  }
}
