export type ImageFormat = "webp" | "jpeg" | "png";

export type ResizeFit = "cover" | "contain" | "fill" | "inside" | "outside";

export interface ImageOutputSpec {
  suffix: string;
  width?: number;
  height?: number;
  fit?: ResizeFit;
  format?: ImageFormat;
  quality?: number;
}

export interface ImageJobRequest {
  jobId: string;
  inputPath: string;
  outputDir: string;
  originalName?: string;
  outputs: ImageOutputSpec[];
  deleteOriginal?: boolean;
}

export interface ImageJobResult {
  jobId: string;
  ok: boolean;
  outputs: string[];
  error?: string;
}
