import { existsSync, readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const backupCsv = Buffer.from("uid1,user1@example.com\n");

const { importMock } = vi.hoisted(() => ({ importMock: vi.fn() }));

vi.mock("firebase-tools", () => ({
  auth: { export: vi.fn(), import: importMock },
}));

// restoreAuth は new Storage() で呼ぶ。vitest 4 以降はアロー関数の mockImplementation を
// new で呼べないため、class で書く
vi.mock("@google-cloud/storage", () => ({
  Storage: class {
    bucket() {
      return { file: () => ({ download: async () => [backupCsv] }) };
    }
  },
}));

import { restoreAuth } from "../src/restoreAuth";

describe("restoreAuth", () => {
  let importedFile: { path: string; content: Buffer } | undefined;

  beforeEach(() => {
    importedFile = undefined;
    importMock.mockReset();
    // 一時ファイルは呼び出し後に消えるので、呼ばれた時点の中身を控えておく
    importMock.mockImplementation(async (path: string) => {
      importedFile = { path, content: readFileSync(path) };
    });
  });

  it("バックアップの中身を auth.import に渡し、復元先プロジェクトとハッシュ設定を指定する", async () => {
    await restoreAuth({
      region: "asia-northeast1",
      backupFilePath: "2026-10-27T00:00:00.000Z/firebase-authentication-backup.csv",
      projectId: "source-project",
      bucketName: "source-project-authentication-backups",
      encrypted: false,
      destinationProjectId: "destination-project",
      hashParams: {
        hashAlgo: "SCRYPT",
        hashKey: "hash-key",
        saltSeparator: "Bw==",
        rounds: 8,
        memCost: 14,
      },
    });

    expect(importMock).toHaveBeenCalledOnce();
    expect(importMock).toHaveBeenCalledWith(expect.any(String), {
      project: "destination-project",
      hashAlgo: "SCRYPT",
      hashKey: "hash-key",
      saltSeparator: "Bw==",
      rounds: 8,
      memCost: 14,
    });
    expect(importedFile?.content).toEqual(backupCsv);
  });

  it("ハッシュ設定を省略したときは復元先プロジェクトだけを指定する", async () => {
    await restoreAuth({
      region: "asia-northeast1",
      backupFilePath: "backup.csv",
      projectId: "source-project",
      encrypted: false,
      destinationProjectId: "destination-project",
    });

    expect(importMock).toHaveBeenCalledWith(expect.any(String), { project: "destination-project" });
  });

  it("復元に成功したら一時ファイルを消す", async () => {
    await restoreAuth({
      region: "asia-northeast1",
      backupFilePath: "backup.csv",
      projectId: "source-project",
      encrypted: false,
      destinationProjectId: "destination-project",
    });

    expect(importedFile).toBeDefined();
    expect(existsSync(importedFile?.path ?? "")).toBe(false);
  });

  it("auth.import が失敗しても一時ファイルを消す", async () => {
    importMock.mockImplementation(async (path: string) => {
      importedFile = { path, content: readFileSync(path) };
      throw new Error("import failed");
    });

    await expect(
      restoreAuth({
        region: "asia-northeast1",
        backupFilePath: "backup.csv",
        projectId: "source-project",
        encrypted: false,
        destinationProjectId: "destination-project",
      }),
    ).rejects.toThrow("import failed");

    expect(importedFile).toBeDefined();
    expect(existsSync(importedFile?.path ?? "")).toBe(false);
  });
});
