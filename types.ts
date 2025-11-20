export enum MessageRole {
  USER = 'user',
  MODEL = 'model',
  SYSTEM = 'system'
}

export enum ContentType {
  TEXT = 'text',
  IMAGE = 'image',
  CODE = 'code', // Explicitly tracking code blocks if needed, though Markdown handles this
  ERROR = 'error'
}

export interface Message {
  id: string;
  role: MessageRole;
  type: ContentType;
  content: string; // Markdown text or Base64 image data
  timestamp: number;
  isThinking?: boolean; // For loading states
}

export interface ImageGenerationResult {
  success: boolean;
  data?: string; // Base64
  mimeType?: string;
  error?: string;
}