import { parentPort } from "worker_threads";
import path from "path";
import fs from "fs/promises";
import sharp from "sharp";
import { ImageJobRequest, ImageJobResult, ImageOutputSpec } from "./image.types";

const sanitizeName = (name: string): string =>
  name.replace(/[^a-zA-Z0-9._-]/g, "-") || "image";

const processOutput = async (
  inputPath: string,
  baseOutputDir: string,
  spec: ImageOutputSpec,
  originalName?: string
): Promise<string> => {
  const parsed = path.parse(inputPath);
  const format = spec.format ?? "webp";
  const quality = spec.quality ?? 80;

  const folderName = sanitizeName(spec.suffix);
  const outputDir = path.join(baseOutputDir, folderName);
  await fs.mkdir(outputDir, { recursive: true });

  const nameBase = originalName
    ? `${sanitizeName(originalName)}-${parsed.name}`
    : parsed.name;
  const outputFilename = `${nameBase}.${format}`;
  const outputPath = path.join(outputDir, outputFilename);

  let pipeline = sharp(inputPath).rotate();

  if (spec.width || spec.height) {
    pipeline = pipeline.resize({
      width: spec.width,
      height: spec.height,
      fit: spec.fit ?? "cover",
      withoutEnlargement: true,
    });
  }

  switch (format) {
    case "jpeg":
      pipeline = pipeline.jpeg({ quality });
      break;
    case "png":
      pipeline = pipeline.png({ quality });
      break;
    default:
      pipeline = pipeline.webp({ quality });
  }

  await pipeline.toFile(outputPath);
  return outputPath;
};

const port = parentPort;

if (port) {
  port.on("message", async (request: ImageJobRequest) => {
    const result: ImageJobResult = {
      jobId: request.jobId,
      ok: false,
      outputs: [],
    };

    try {
      for (const spec of request.outputs) {
        const outputPath = await processOutput(
          request.inputPath,
          request.outputDir,
          spec,
          request.originalName
        );
        result.outputs.push(outputPath);
      }

      if (request.deleteOriginal) {
        await fs.unlink(request.inputPath);
      }

      result.ok = true;
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);

      for (const outputPath of result.outputs) {
        try {
          await fs.unlink(outputPath);
        } catch {
          /* ignore */
        }
      }
      result.outputs = [];

      if (request.deleteOriginal) {
        try {
          await fs.unlink(request.inputPath);
        } catch {
          /* ignore */
        }
      }
    }

    port.postMessage(result);
  });
}
