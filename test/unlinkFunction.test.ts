import { spawn } from 'node:child_process';
import { existsSync, unlinkSync } from 'node:fs';
import * as path from 'node:path';
import { beforeEach, describe, expect, it, vi, type MockedFunction } from 'vitest';

const mockUnlinkSync = vi.hoisted(() => vi.fn()) as MockedFunction<typeof unlinkSync>;
const mockProcessOn = vi.hoisted(() => vi.fn());

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    unlinkSync: mockUnlinkSync
  };
});

vi.mock('node:process', () => ({
  on: mockProcessOn
}));

// テスト実行前にモジュールをインポート
import { prepareUnlinkFunction } from '../src/unlinkFunction';

describe('prepareUnlinkFunction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return a function that deletes the specified file', () => {
    const filePath = '/tmp/test-file.txt';

    const unlinkFn = prepareUnlinkFunction(filePath);

    expect(typeof unlinkFn).toBe('function');

    // 関数を実行してファイル削除をテスト
    unlinkFn();

    expect(mockUnlinkSync).toHaveBeenCalledWith(filePath);
    expect(mockUnlinkSync).toHaveBeenCalledTimes(1);
  });

  it('should not delete the same file twice', () => {
    const filePath = '/tmp/duplicate-test.txt';

    const unlinkFn = prepareUnlinkFunction(filePath);

    // 2回実行
    unlinkFn();
    unlinkFn();

    // unlinkSyncは1回だけ呼ばれるはず
    expect(mockUnlinkSync).toHaveBeenCalledWith(filePath);
    expect(mockUnlinkSync).toHaveBeenCalledTimes(1);
  });

  it('should handle unlinkSync errors gracefully', () => {
    const filePath = '/tmp/error-test.txt';
    mockUnlinkSync.mockImplementation(() => {
      throw new Error('File not found');
    });

    const unlinkFn = prepareUnlinkFunction(filePath);

    // エラーが発生してもthrowされないことを確認
    expect(() => unlinkFn()).not.toThrow();

    expect(mockUnlinkSync).toHaveBeenCalledWith(filePath);
    expect(mockUnlinkSync).toHaveBeenCalledTimes(1);
  });

  it('should handle multiple file paths independently', () => {
    const filePath1 = '/tmp/file1.txt';
    const filePath2 = '/tmp/file2.txt';

    const unlinkFn1 = prepareUnlinkFunction(filePath1);
    const unlinkFn2 = prepareUnlinkFunction(filePath2);

    unlinkFn1();
    unlinkFn2();

    expect(mockUnlinkSync).toHaveBeenCalledWith(filePath1);
    expect(mockUnlinkSync).toHaveBeenCalledWith(filePath2);
    expect(mockUnlinkSync).toHaveBeenCalledTimes(2);
  });

  it('should retry unlinkSync after previous error', () => {
    const filePath = '/tmp/recovery-test.txt';

    // 最初の呼び出しでエラー、2回目は成功
    mockUnlinkSync
      .mockImplementationOnce(() => {
        throw new Error('First call error');
      })
      .mockImplementationOnce(() => {
        // 正常終了
      });

    const unlinkFn = prepareUnlinkFunction(filePath);

    // 1回目: エラーが発生するが、例外はthrowされない
    expect(() => unlinkFn()).not.toThrow();

    // 2回目: 前回エラーだったので再試行される
    expect(() => unlinkFn()).not.toThrow();

    // unlinkSyncは2回呼ばれる（1回目エラー、2回目成功）
    expect(mockUnlinkSync).toHaveBeenCalledTimes(2);
  });

  it('should throw error for empty file path', () => {
    const filePath = '';

    expect(() => prepareUnlinkFunction(filePath)).toThrow('filePath must not be empty');
  });

  it('should delete files on process exit (integration test)', async () => {
    const scriptPath = path.resolve(__dirname, 'scripts', 'unlinkOnExit.ts');

    return new Promise<void>((resolve, reject) => {
      let tempFilePath = '';
      let stdout = '';

      const child = spawn('npx', ['tsx', scriptPath], {
        stdio: 'pipe'
      });

      child.stdout.on('data', (data) => {
        stdout += data.toString();
        const match = stdout.match(/TEMP_FILE_PATH:(.+)/);
        if (match) {
          tempFilePath = match[1].trim();

          // ファイルが存在することを確認
          expect(existsSync(tempFilePath)).toBe(true);
        }
      });

      child.stderr.on('data', (data) => {
        // vscode のターミナルから実行すると debugger 関連のメッセージが stderr に出力されるので無視する
        if (/debugger/i.test(data.toString())) return;

        reject(new Error(`Script stderr: ${data.toString()}`));
      });

      child.on('exit', (code) => {
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

      child.on('error', (error) => {
        reject(new Error(`Failed to spawn process: ${error.message}`));
      });
    });
  }, 10000); // 10秒のタイムアウトを設定
});
