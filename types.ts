export enum Role {
  USER = 'user',
  MODEL = 'model'
}

export type ThemeType = 'light' | 'dark' | 'ocean' | 'sunset' | 'forest';

export interface Attachment {
  name: string;
  mimeType: string;
  data: string; // base64 string
  previewUrl: string;
}

export interface Message {
  id: string;
  role: Role;
  text: string;
  attachments?: Attachment[];
  timestamp: number;
}