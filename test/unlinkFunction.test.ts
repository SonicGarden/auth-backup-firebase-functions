import type { unlinkSync } from "node:fs";
import {
  afterEach,
  describe,
  expect,
  it,
  type MockedFunction,
  vi,
} from "vitest";

const mockUnlinkSync = vi.hoisted(() => vi.fn()) as MockedFunction<
  typeof unlinkSync
>;
const mockProcessOn = vi.hoisted(() => vi.fn());
const mockConsoleError = vi
  .spyOn(console, "error")
  .mockImplementation(() => {});

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    unlinkSync: mockUnlinkSync,
  };
});

vi.mock("node:process", () => ({
  on: mockProcessOn,
}));

// テスト実行前にモジュールをインポート
import {
  __resetUnlinkFunctionsForTest,
  prepareUnlinkFunction,
} from "../src/utils/unlinkFunction";

describe("prepareUnlinkFunction", () => {
  afterEach(() => {
    vi.clearAllMocks();
    __resetUnlinkFunctionsForTest();
  });

  it("should return a function that deletes the specified file", () => {
    const filePath = "/tmp/test-file.txt";

    const unlinkFn = prepareUnlinkFunction(filePath);

    expect(typeof unlinkFn).toBe("function");

    // 関数を実行してファイル削除をテスト
    unlinkFn();

    expect(mockUnlinkSync).toHaveBeenCalledWith(filePath);
    expect(mockUnlinkSync).toHaveBeenCalledTimes(1);
  });

  it("should not delete the same file twice", () => {
    const filePath = "/tmp/duplicate-test.txt";

    const unlinkFn = prepareUnlinkFunction(filePath);

    // 2回実行
    unlinkFn();
    unlinkFn();

    // unlinkSyncは1回だけ呼ばれるはず
    expect(mockUnlinkSync).toHaveBeenCalledWith(filePath);
    expect(mockUnlinkSync).toHaveBeenCalledTimes(1);
  });

  it("should treat ENOENT error as success", () => {
    const filePath = "/tmp/enoent-test.txt";
    const enoentError = new Error("ENOENT: no such file or directory");
    // biome-ignore lint/suspicious/noExplicitAny: unlinkSync が throw するエラーを模すため code が必要
    (enoentError as any).code = "ENOENT";

    mockUnlinkSync.mockImplementation(() => {
      throw enoentError;
    });

    const unlinkFn = prepareUnlinkFunction(filePath);

    // ENOENTエラーでもthrowされない
    expect(() => unlinkFn()).not.toThrow();

    // 1回目の呼び出しでunlinkSyncが呼ばれる
    expect(mockUnlinkSync).toHaveBeenCalledWith(filePath);
    expect(mockUnlinkSync).toHaveBeenCalledTimes(1);

    // console.errorは呼ばれない（正常終了扱い）
    expect(mockConsoleError).not.toHaveBeenCalled();

    // 2回目の呼び出しではunlinkSyncが呼ばれない（すでにunlinked=true）
    unlinkFn();
    expect(mockUnlinkSync).toHaveBeenCalledTimes(1);
  });

  it("should log error for non-ENOENT errors", () => {
    const filePath = "/tmp/permission-error-test.txt";
    const eaccessError = new Error("EACCES: permission denied");
    // biome-ignore lint/suspicious/noExplicitAny: unlinkSync が throw するエラーを模すため code が必要
    (eaccessError as any).code = "EACCES";

    mockUnlinkSync.mockImplementation(() => {
      throw eaccessError;
    });

    const unlinkFn = prepareUnlinkFunction(filePath);

    // ENOENT以外のエラーでもthrowされない
    expect(() => unlinkFn()).not.toThrow();

    // unlinkSyncが呼ばれる
    expect(mockUnlinkSync).toHaveBeenCalledWith(filePath);
    expect(mockUnlinkSync).toHaveBeenCalledTimes(1);

    // console.errorが呼ばれる
    expect(mockConsoleError).toHaveBeenCalledTimes(1);
    expect(mockConsoleError).toHaveBeenCalledWith(
      `Failed to unlink ${filePath}\n`,
      eaccessError,
    );

    // 2回目の呼び出しでもunlinkSyncが呼ばれる（リトライ可能）
    unlinkFn();
    expect(mockUnlinkSync).toHaveBeenCalledTimes(2);
  });

  it("should handle multiple file paths independently", () => {
    const filePath1 = "/tmp/file1.txt";
    const filePath2 = "/tmp/file2.txt";

    const unlinkFn1 = prepareUnlinkFunction(filePath1);
    const unlinkFn2 = prepareUnlinkFunction(filePath2);

    unlinkFn1();
    unlinkFn2();

    expect(mockUnlinkSync).toHaveBeenCalledWith(filePath1);
    expect(mockUnlinkSync).toHaveBeenCalledWith(filePath2);
    expect(mockUnlinkSync).toHaveBeenCalledTimes(2);
  });

  it("should retry unlinkSync after previous error", () => {
    const filePath = "/tmp/recovery-test.txt";

    // 最初の呼び出しでエラー、2回目は成功
    mockUnlinkSync
      .mockImplementationOnce(() => {
        throw new Error("First call error");
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

  it("should throw error for empty file path", () => {
    const filePath = "";

    expect(() => prepareUnlinkFunction(filePath)).toThrow(
      "filePath must not be empty",
    );
  });
});
