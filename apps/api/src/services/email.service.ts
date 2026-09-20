import nodemailer, { type Transporter } from 'nodemailer';

export interface IssueNotificationPayload {
  issueId: string;
  title: string;
  description: string;
  category?: string | null;
  priority: string;
  reporterName: string;
  reporterEmail: string;
  reporterRole: string;
  organizationName: string;
  organizationSubdomain: string;
  screenshotUrl?: string | null;
  clientVersion?: string | null;
  deviceInfo?: string | null;
  systemDiagnostics?: any;
  diagnosticsFileUrl?: string | null;
  diagnosticsText?: string | null;
  createdAt: Date;
}

export class EmailService {
  private static transporter: Transporter | null = null;
  private static isConfigured: boolean = false;

  public static initialize(): void {
    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (host && user && pass) {
      try {
        this.transporter = nodemailer.createTransport({
          host,
          port,
          secure: port === 465,
          auth: { user, pass },
        });
        this.isConfigured = true;
        console.log(`📧 [EmailService] Configured SMTP client for ${host}:${port}`);
      } catch (err) {
        console.warn('⚠️ [EmailService] Failed to initialize SMTP transporter. Falling back to console notification.', err);
        this.isConfigured = false;
      }
    } else {
      this.isConfigured = false;
      console.log('ℹ️ [EmailService] No SMTP credentials provided. Running in simulated console-alert notification mode.');
    }
  }

  public static async sendIssueNotification(payload: IssueNotificationPayload): Promise<{ success: boolean; mode: 'sent' | 'simulated'; error?: string }> {
    const recipient = process.env.SUPERADMIN_EMAIL || 'admin@deskbooking.com';
    const sender = process.env.SMTP_FROM || '"DeskBooking Platform Alerts" <alerts@deskbooking.com>';
    const subject = `[ISSUE REPORT - ${payload.priority}] ${payload.title} (${payload.organizationSubdomain})`;

    // Check if SMTP is ready
    if (!this.transporter) {
      this.initialize();
    }

    if (this.isConfigured && this.transporter) {
      try {
        const html = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 640px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
            <div style="background: linear-gradient(135deg, #1e1b4b 0%, #4338ca 100%); padding: 24px; color: #ffffff;">
              <h2 style="margin: 0 0 8px 0; font-size: 20px;">🚨 Platform Issue Report</h2>
              <p style="margin: 0; font-size: 14px; opacity: 0.85;">A platform user has submitted an operational issue requiring superadmin attention.</p>
            </div>
            <div style="padding: 24px;">
              <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                <tr>
                  <td style="padding: 6px 0; color: #64748b; font-size: 13px; width: 140px;"><strong>Issue Title:</strong></td>
                  <td style="padding: 6px 0; color: #0f172a; font-size: 14px; font-weight: 600;">${payload.title}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #64748b; font-size: 13px;"><strong>Category:</strong></td>
                  <td style="padding: 6px 0; color: #0f172a; font-size: 14px;">${payload.category || 'GENERAL'}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #64748b; font-size: 13px;"><strong>Priority:</strong></td>
                  <td style="padding: 6px 0; color: #dc2626; font-size: 14px; font-weight: 700;">${payload.priority}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #64748b; font-size: 13px;"><strong>Reporter:</strong></td>
                  <td style="padding: 6px 0; color: #0f172a; font-size: 14px;">${payload.reporterName} (${payload.reporterRole}) &lt;${payload.reporterEmail}&gt;</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #64748b; font-size: 13px;"><strong>Organization:</strong></td>
                  <td style="padding: 6px 0; color: #0f172a; font-size: 14px;">${payload.organizationName} (<code>${payload.organizationSubdomain}</code>)</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #64748b; font-size: 13px;"><strong>Reported At:</strong></td>
                  <td style="padding: 6px 0; color: #0f172a; font-size: 14px;">${new Date(payload.createdAt).toLocaleString()}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #64748b; font-size: 13px;"><strong>Client Version:</strong></td>
                  <td style="padding: 6px 0; color: #0f172a; font-size: 14px;"><code style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: 12px;">${payload.clientVersion || 'v1.0.0'}</code></td>
                </tr>
                ${payload.deviceInfo ? `
                <tr>
                  <td style="padding: 6px 0; color: #64748b; font-size: 13px;"><strong>Client Environment:</strong></td>
                  <td style="padding: 6px 0; color: #475569; font-size: 13px;">${payload.deviceInfo}</td>
                </tr>` : ''}
                ${payload.systemDiagnostics ? `
                <tr>
                  <td style="padding: 6px 0; color: #64748b; font-size: 13px;"><strong>Host OS:</strong></td>
                  <td style="padding: 6px 0; color: #0f172a; font-size: 13px;">${payload.systemDiagnostics.os?.humanName || 'N/A'}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #64748b; font-size: 13px;"><strong>Docker Engine:</strong></td>
                  <td style="padding: 6px 0; color: #0f172a; font-size: 13px;">${payload.systemDiagnostics.runtimes?.docker || 'Not detected'} (Daemon: ${payload.systemDiagnostics.runtimes?.dockerDaemonActive ? 'Active' : 'Offline'})</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #64748b; font-size: 13px;"><strong>Database:</strong></td>
                  <td style="padding: 6px 0; color: #0f172a; font-size: 13px;">${payload.systemDiagnostics.database?.version || 'PostgreSQL 16'} (${payload.systemDiagnostics.database?.status || 'HEALTHY'})</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #64748b; font-size: 13px;"><strong>Node & Runtimes:</strong></td>
                  <td style="padding: 6px 0; color: #0f172a; font-size: 13px;">Node ${payload.systemDiagnostics.runtimes?.node || process.version}, pnpm ${payload.systemDiagnostics.runtimes?.pnpm || '10.x'}</td>
                </tr>` : ''}
              </table>

              <div style="background: #f8fafc; border-left: 4px solid #6366f1; padding: 16px; border-radius: 6px; margin-bottom: 20px;">
                <h4 style="margin: 0 0 8px 0; font-size: 13px; color: #475569; text-transform: uppercase;">Issue Description</h4>
                <p style="margin: 0; color: #1e293b; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${payload.description}</p>
              </div>

              ${payload.screenshotUrl ? `
                <div style="margin-bottom: 20px;">
                  <h4 style="margin: 0 0 8px 0; font-size: 13px; color: #475569; text-transform: uppercase;">Screenshot Attachment</h4>
                  <a href="${payload.screenshotUrl}" style="color: #4f46e5; text-decoration: underline; font-size: 13px;" target="_blank">View Uploaded Screenshot</a>
                </div>
              ` : ''}

              ${payload.diagnosticsFileUrl ? `
                <div style="margin-bottom: 20px;">
                  <h4 style="margin: 0 0 8px 0; font-size: 13px; color: #475569; text-transform: uppercase;">Diagnostics Log File</h4>
                  <a href="${payload.diagnosticsFileUrl}" style="color: #4f46e5; text-decoration: underline; font-size: 13px;" target="_blank">Download system-diagnostics.txt</a>
                </div>
              ` : ''}

              <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; text-align: center;">
                <p style="color: #64748b; font-size: 12px; margin: 0;">Log into the <strong>system</strong> subdomain control plane to investigate and mark as resolved.</p>
              </div>
            </div>
          </div>
        `;

        const attachments: any[] = [];
        if (payload.diagnosticsText) {
          attachments.push({
            filename: `system-diagnostics-${payload.issueId.substring(0, 8)}.txt`,
            content: payload.diagnosticsText,
            contentType: 'text/plain',
          });
        }

        await this.transporter.sendMail({
          from: sender,
          to: recipient,
          subject,
          html,
          text: `[ISSUE REPORT - ${payload.priority}]\nTitle: ${payload.title}\nCategory: ${payload.category || 'GENERAL'}\nReporter: ${payload.reporterName} (${payload.reporterEmail})\nOrganization: ${payload.organizationName} (${payload.organizationSubdomain})\nClient Version: ${payload.clientVersion || 'v1.0.0'}\nClient Environment: ${payload.deviceInfo || 'Unknown'}\nDocker: ${payload.systemDiagnostics?.runtimes?.docker || 'N/A'}\nDatabase: ${payload.systemDiagnostics?.database?.version || 'PostgreSQL 16'}\nDiagnostics File: ${payload.diagnosticsFileUrl || 'Attached'}\n\nDescription:\n${payload.description}\n\nScreenshot: ${payload.screenshotUrl || 'None'}\n`,
          attachments: attachments.length > 0 ? attachments : undefined,
        });

        console.log(`✅ [EmailService] Issue notification sent to ${recipient}`);
        return { success: true, mode: 'sent' };
      } catch (err: any) {
        console.error('❌ [EmailService] Error sending email notification:', err);
        return { success: false, mode: 'sent', error: err.message };
      }
    }

    // Simulated Console Notification (Offline-First / Development Mode)
    console.log('\n================================================================================');
    console.log('📧 [NOTIFY SUPERADMIN] New Platform Issue Report Received');
    console.log('--------------------------------------------------------------------------------');
    console.log(`To:             ${recipient}`);
    console.log(`Subject:        ${subject}`);
    console.log(`Organization:   ${payload.organizationName} (${payload.organizationSubdomain}.deskbooking.com)`);
    console.log(`Reporter:       ${payload.reporterName} [${payload.reporterRole}] <${payload.reporterEmail}>`);
    console.log(`Client Version: ${payload.clientVersion || 'v1.0.0'}`);
    if (payload.deviceInfo) {
      console.log(`Client Device:  ${payload.deviceInfo}`);
    }
    if (payload.systemDiagnostics) {
      console.log('--- System Diagnostics Manifest ---');
      console.log(`Host OS:        ${payload.systemDiagnostics.os?.humanName || 'N/A'}`);
      console.log(`Docker:         ${payload.systemDiagnostics.runtimes?.docker || 'N/A'}`);
      console.log(`Docker Compose: ${payload.systemDiagnostics.runtimes?.dockerCompose || 'N/A'}`);
      console.log(`Docker Daemon:  ${payload.systemDiagnostics.runtimes?.dockerDaemonActive ? 'ACTIVE / RUNNING' : 'STOPPED'}`);
      console.log(`Database:       ${payload.systemDiagnostics.database?.version || 'PostgreSQL 16'} (${payload.systemDiagnostics.database?.status || 'HEALTHY'}, ${payload.systemDiagnostics.database?.latencyMs || 0}ms)`);
      console.log(`Node / pnpm:    Node ${payload.systemDiagnostics.runtimes?.node || process.version} / pnpm ${payload.systemDiagnostics.runtimes?.pnpm || '10.x'}`);
      console.log('-----------------------------------');
    }
    if (payload.diagnosticsFileUrl) {
      console.log(`Diagnostics Log: ${payload.diagnosticsFileUrl} (system-diagnostics.txt generated)`);
    }
    console.log(`Category:       ${payload.category || 'GENERAL'}`);
    console.log(`Priority:       ${payload.priority}`);
    console.log(`Title:          ${payload.title}`);
    console.log(`Description:    ${payload.description}`);
    if (payload.screenshotUrl) {
      console.log(`Screenshot:     ${payload.screenshotUrl}`);
    }
    console.log(`Timestamp:      ${new Date(payload.createdAt).toISOString()}`);
    console.log('================================================================================\n');

    return { success: true, mode: 'simulated' };
  }
}
