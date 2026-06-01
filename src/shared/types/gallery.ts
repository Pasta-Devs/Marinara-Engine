export interface ChatImage {
  id: string;
  chatId: string;
  url: string;
  filePath?: string | null;
  filename?: string | null;
  prompt?: string | null;
  model?: string | null;
  provider?: string | null;
  width?: number | null;
  height?: number | null;
  createdAt?: string;
}
