import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  __getUnlinkFunctionsCountForTest,
  __resetUnlinkFunctionsForTest,
  prepareUnlinkFunction,
} from "../src/utils/unlinkFunction";

describe("prepareUnlinkFunction (integration)", () => {
  afterEach(() => {
    // unlinkFunctions 配列をリセット
    __resetUnlinkFunctionsForTest();
  });
  it("should delete an actual file", () => {
    // 実際の一時ファイルを作成
    const tempDir = mkdtempSync(path.join(tmpdir(), "unlink-test-"));
    const filePath = path.join(tempDir, "test-file.txt");
    writeFileSync(filePath, "test content");

    // ファイルが存在することを確認
    expect(existsSync(filePath)).toBe(true);

    const initialCount = __getUnlinkFunctionsCountForTest();

    // prepareUnlinkFunctionで削除関数を取得
    const unlinkFn = prepareUnlinkFunction(filePath);

    // 配列に追加されたことを確認
    expect(__getUnlinkFunctionsCountForTest()).toBe(initialCount + 1);

    // 削除実行
    unlinkFn();

    // ファイルが削除されたことを確認
    expect(existsSync(filePath)).toBe(false);

    // 配列から削除されたことを確認
    expect(__getUnlinkFunctionsCountForTest()).toBe(initialCount);
  });

  it("should not throw error on second call", () => {
    // 実際の一時ファイルを作成
    const tempDir = mkdtempSync(path.join(tmpdir(), "unlink-test-"));
    const filePath = path.join(tempDir, "test-file-2.txt");
    writeFileSync(filePath, "test content");

    const initialCount = __getUnlinkFunctionsCountForTest();

    const unlinkFn = prepareUnlinkFunction(filePath);

    // 配列に追加されたことを確認
    expect(__getUnlinkFunctionsCountForTest()).toBe(initialCount + 1);

    // 1回目の削除
    unlinkFn();
    expect(existsSync(filePath)).toBe(false);

    // 配列から削除されたことを確認
    expect(__getUnlinkFunctionsCountForTest()).toBe(initialCount);

    // 2回目の呼び出しでもエラーにならない
    expect(() => unlinkFn()).not.toThrow();

    // 配列のカウントは変わらない
    expect(__getUnlinkFunctionsCountForTest()).toBe(initialCount);
  });

  it("should not throw error for non-existent file", () => {
    // 存在しないファイルパス
    const tempDir = mkdtempSync(path.join(tmpdir(), "unlink-test-"));
    const filePath = path.join(tempDir, "non-existent-file.txt");

    // ファイルが存在しないことを確認
    expect(existsSync(filePath)).toBe(false);

    const initialCount = __getUnlinkFunctionsCountForTest();

    const unlinkFn = prepareUnlinkFunction(filePath);

    // 配列に追加されたことを確認
    expect(__getUnlinkFunctionsCountForTest()).toBe(initialCount + 1);

    // 存在しないファイルでもエラーにならない（ENOENTは正常終了扱い）
    expect(() => unlinkFn()).not.toThrow();

    // ENOENTでも配列から削除されたことを確認
    expect(__getUnlinkFunctionsCountForTest()).toBe(initialCount);
  });

  it("should delete files on process exit", async () => {
    const scriptPath = path.resolve(__dirname, "scripts", "unlinkOnExit.ts");

    return new Promise<void>((resolve, reject) => {
      let tempFilePath = "";
      let stdout = "";

      const child = spawn("npx", ["tsx", scriptPath], {
        stdio: "pipe",
      });

      child.stdout.on("data", (data) => {
        stdout += data.toString();
        const match = stdout.match(/TEMP_FILE_PATH:(.+)/);
        if (match) {
          tempFilePath = match[1].trim();

          // ファイルが存在することを確認
          expect(existsSync(tempFilePath)).toBe(true);
        }
      });

      child.stderr.on("data", (data) => {
        // vscode のターミナルから実行すると debugger 関連のメッセージが stderr に出力されるので無視する
        if (/debugger/i.test(data.toString())) return;

        reject(new Error(`Script stderr: ${data.toString()}`));
      });

      child.on("exit", (code) => {
        try {
          // プロセスが正常終了したことを確認
          expect(code).toBe(0);

          // 一時ファイルのパスが取得できていることを確認
          expect(tempFilePath).toBeTruthy();

          // プロセス終了後、ファイルが削除されていることを確認
          expect(existsSync(tempFilePath)).toBe(false);

          resolve();
        } catch (error) {
          reject(error);
        }
      });

      child.on("error", (error) => {
        reject(new Error(`Failed to spawn process: ${error.message}`));
      });
    });
  }, 10000); // 10秒のタイムアウトを設定
});
