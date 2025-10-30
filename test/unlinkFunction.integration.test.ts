import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { __getUnlinkFunctionsCountForTest, prepareUnlinkFunction } from '../src/unlinkFunction';

describe('prepareUnlinkFunction (integration)', () => {
  it('should delete an actual file', () => {
    // 実際の一時ファイルを作成
    const tempDir = mkdtempSync(path.join(tmpdir(), 'unlink-test-'));
    const filePath = path.join(tempDir, 'test-file.txt');
    writeFileSync(filePath, 'test content');

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

  it('should not throw error on second call', () => {
    // 実際の一時ファイルを作成
    const tempDir = mkdtempSync(path.join(tmpdir(), 'unlink-test-'));
    const filePath = path.join(tempDir, 'test-file-2.txt');
    writeFileSync(filePath, 'test content');

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

  it('should not throw error for non-existent file', () => {
    // 存在しないファイルパス
    const tempDir = mkdtempSync(path.join(tmpdir(), 'unlink-test-'));
    const filePath = path.join(tempDir, 'non-existent-file.txt');

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
});
