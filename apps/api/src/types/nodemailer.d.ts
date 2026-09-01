declare module 'nodemailer' {
  export type TransportOptions = string | Record<string, unknown>;

  export interface SentMessageInfo {
    messageId?: string;
    [key: string]: unknown;
  }

  export interface Transporter {
    sendMail(mail: {
      from?: string;
      to: string;
      subject: string;
      text?: string;
      html?: string;
    }): Promise<SentMessageInfo>;
  }

  export function createTransport(options: TransportOptions): Transporter;

  const nodemailer: {
    createTransport: typeof createTransport;
  };
  export default nodemailer;
}
