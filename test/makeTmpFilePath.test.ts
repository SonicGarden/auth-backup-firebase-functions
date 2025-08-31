import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi, type MockedFunction } from 'vitest';
import { makeTmpFilePath } from '../src/makeTmpFilePath';

const mockRandomBytes = vi.hoisted(() => vi.fn()) as MockedFunction<(size: number) => Buffer>;

vi.mock('node:fs');
vi.mock('node:crypto', () => ({
  randomBytes: mockRandomBytes
}));

describe('makeTmpFilePath', () => {
  const mockExistsSync = vi.mocked(existsSync);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should generate a unique temporary file path', () => {
    mockExistsSync.mockReturnValue(false);
    mockRandomBytes.mockReturnValue(Buffer.from('1234567890abcdef', 'hex'));

    const result = makeTmpFilePath('test-prefix-', '.txt');

    expect(result).toBe(path.join(tmpdir(), 'test-prefix-1234567890abcdef.txt'));
    expect(mockExistsSync).toHaveBeenCalledTimes(1);
    expect(mockRandomBytes).toHaveBeenCalledWith(8);
  });

  it('should handle different prefix and suffix combinations', () => {
    mockExistsSync.mockReturnValue(false);
    mockRandomBytes.mockReturnValue(Buffer.from('abcdef1234567890', 'hex'));

    const result = makeTmpFilePath('my-file-', '.json');

    expect(result).toBe(path.join(tmpdir(), 'my-file-abcdef1234567890.json'));
  });

  it('should retry if file already exists', () => {
    mockExistsSync
      .mockReturnValueOnce(true)  // 1回目: ファイル存在
      .mockReturnValueOnce(true)  // 2回目: ファイル存在
      .mockReturnValueOnce(false); // 3回目: ファイル存在しない

    mockRandomBytes
      .mockReturnValueOnce(Buffer.from('1111111111111111', 'hex'))
      .mockReturnValueOnce(Buffer.from('2222222222222222', 'hex'))
      .mockReturnValueOnce(Buffer.from('3333333333333333', 'hex'));

    const result = makeTmpFilePath('retry-test-', '.tmp');

    expect(result).toBe(path.join(tmpdir(), 'retry-test-3333333333333333.tmp'));
    expect(mockExistsSync).toHaveBeenCalledTimes(3);
    expect(mockRandomBytes).toHaveBeenCalledTimes(3);
  });

  it('should throw error after max attempts', () => {
    mockExistsSync.mockReturnValue(true); // 常にファイルが存在
    mockRandomBytes.mockReturnValue(Buffer.from('0000000000000000', 'hex'));

    expect(() => makeTmpFilePath('fail-test-', '.txt')).toThrow(
      'Failed to generate unique temporary file path after 100 attempts'
    );

    expect(mockExistsSync).toHaveBeenCalledTimes(100);
    expect(mockRandomBytes).toHaveBeenCalledTimes(100);
  });

  it('should generate different paths on each call due to randomBytes', () => {
    mockExistsSync.mockReturnValue(false);

    mockRandomBytes
      .mockReturnValueOnce(Buffer.from('aaaaaaaaaaaaaaaa', 'hex'))
      .mockReturnValueOnce(Buffer.from('bbbbbbbbbbbbbbbb', 'hex'));

    const path1 = makeTmpFilePath('unique-', '.dat');
    const path2 = makeTmpFilePath('unique-', '.dat');

    expect(path1).toBe(path.join(tmpdir(), 'unique-aaaaaaaaaaaaaaaa.dat'));
    expect(path2).toBe(path.join(tmpdir(), 'unique-bbbbbbbbbbbbbbbb.dat'));
    expect(path1).not.toBe(path2);
  });

  it('should handle empty prefix and suffix', () => {
    mockExistsSync.mockReturnValue(false);
    mockRandomBytes.mockReturnValue(Buffer.from('fedcba9876543210', 'hex'));

    const result = makeTmpFilePath('', '');

    expect(result).toBe(path.join(tmpdir(), 'fedcba9876543210'));
  });

  it('should handle prefix with special characters', () => {
    mockExistsSync.mockReturnValue(false);
    mockRandomBytes.mockReturnValue(Buffer.from('0123456789abcdef', 'hex'));

    const result = makeTmpFilePath('test-@#$%-', '.backup');

    expect(result).toBe(path.join(tmpdir(), 'test-@#$%-0123456789abcdef.backup'));
  });

  it('should work with multiple retries finding unique name', () => {
    let callCount = 0;
    mockExistsSync.mockImplementation(() => {
      callCount++;
      return callCount < 50; // 最初の49回は true、50回目以降は false
    });

    mockRandomBytes.mockImplementation(() => {
      return Buffer.from(Math.random().toString(16).substring(2, 18), 'hex');
    });

    const result = makeTmpFilePath('many-retries-', '.log');

    expect(result).toMatch(/many-retries-[0-9a-f]+\.log$/);
    expect(mockExistsSync).toHaveBeenCalledTimes(50);
    expect(mockRandomBytes).toHaveBeenCalledTimes(50);
  });
});
