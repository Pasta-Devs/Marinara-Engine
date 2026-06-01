import { invokeTauri } from "./tauri-client";

export interface LorebookVectorizeInput {
  connectionId?: string;
  model?: string;
  onlyMissing: boolean;
  entryIds?: string[];
}

export const lorebookCommandApi = {
  uploadImage: <T = unknown>(id: string, image: string, filename?: string) =>
    invokeTauri<T>("lorebook_image_upload", { id, body: { image, filename } }),
  vectorize: <T = unknown>(id: string, body: LorebookVectorizeInput) =>
    invokeTauri<T>("lorebook_vectorize", { id, body }),
};
