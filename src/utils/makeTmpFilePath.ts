import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";

export const makeTmpFilePath = (prefix: string, suffix: string) => {
  const maxAttempts = 100;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const tmpFileName = `${prefix}${randomBytes(8).toString("hex")}${suffix}`;
    const tmpFilePath = path.join(tmpdir(), tmpFileName);
    if (!existsSync(tmpFilePath)) {
      return tmpFilePath;
    }
  }

  throw new Error(
    `Failed to generate unique temporary file path after ${maxAttempts} attempts`,
  );
};
