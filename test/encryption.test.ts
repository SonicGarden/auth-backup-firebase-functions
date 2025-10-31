import { describe, expect, it, vi } from 'vitest';

// @google-cloud/kms をモック化
vi.mock('@google-cloud/kms', () => {
  return {
    KeyManagementServiceClient: vi.fn().mockImplementation(() => {
      return {
        cryptoKeyPath: vi.fn((projectId, region, keyringName, keyName) => {
          return `projects/${projectId}/locations/${region}/keyRings/${keyringName}/cryptoKeys/${keyName}`;
        }),
        encrypt: vi.fn(async ({ name, plaintext }) => {
          // モック実装: 平文をそのまま返す（実際の暗号化はしない）
          return [{ ciphertext: plaintext }];
        }),
        decrypt: vi.fn(async ({ name, ciphertext }) => {
          // モック実装: 暗号文をそのまま返す（実際の復号化はしない）
          return [{ plaintext: ciphertext }];
        }),
      };
    }),
  };
});

import { encryptData, decryptData } from '../src/utils/encryption';

describe('encryption', () => {
  const testOptions = {
    projectId: 'test-project',
    region: 'test-region',
    keyringName: 'test-keyring',
    keyName: 'test-key',
  };

  describe('encryptData and decryptData', () => {
    it('should encrypt and decrypt data successfully (round-trip test)', async () => {
      const originalData = Buffer.from('Hello, World! This is a test message.');

      // データを暗号化
      const encryptedData = await encryptData({
        plaintext: originalData,
        ...testOptions,
      });

      // 暗号化されたデータは元のデータと異なるはず
      expect(encryptedData).not.toEqual(originalData);
      expect(encryptedData).toBeInstanceOf(Buffer);

      // データを復号
      const decryptedData = await decryptData({
        encryptedData,
        ...testOptions,
      });

      // 復号されたデータは元のデータと一致するはず
      expect(decryptedData).toEqual(originalData);
      expect(decryptedData.toString()).toBe(originalData.toString());
    });

    it('should handle empty buffer', async () => {
      const emptyBuffer = Buffer.from('');

      const encryptedData = await encryptData({
        plaintext: emptyBuffer,
        ...testOptions,
      });

      const decryptedData = await decryptData({
        encryptedData,
        ...testOptions,
      });

      expect(decryptedData).toEqual(emptyBuffer);
      expect(decryptedData.length).toBe(0);
    });

    it('should handle large data', async () => {
      // 1MB のランダムデータを生成
      const largeData = Buffer.alloc(1024 * 1024);
      for (let i = 0; i < largeData.length; i++) {
        largeData[i] = Math.floor(Math.random() * 256);
      }

      const encryptedData = await encryptData({
        plaintext: largeData,
        ...testOptions,
      });

      const decryptedData = await decryptData({
        encryptedData,
        ...testOptions,
      });

      expect(decryptedData).toEqual(largeData);
    });

    it('should handle UTF-8 text with special characters', async () => {
      const textWithSpecialChars = Buffer.from('こんにちは 🌍 Ñoño café ☕', 'utf-8');

      const encryptedData = await encryptData({
        plaintext: textWithSpecialChars,
        ...testOptions,
      });

      const decryptedData = await decryptData({
        encryptedData,
        ...testOptions,
      });

      expect(decryptedData.toString('utf-8')).toBe(textWithSpecialChars.toString('utf-8'));
    });

    it('should produce different encrypted output for the same input (due to random IV)', async () => {
      const data = Buffer.from('Same data');

      const encrypted1 = await encryptData({
        plaintext: data,
        ...testOptions,
      });

      const encrypted2 = await encryptData({
        plaintext: data,
        ...testOptions,
      });

      // 同じデータでも、ランダムな IV により異なる暗号化結果になるはず
      expect(encrypted1).not.toEqual(encrypted2);

      // ただし、どちらも正しく復号できるはず
      const decrypted1 = await decryptData({
        encryptedData: encrypted1,
        ...testOptions,
      });

      const decrypted2 = await decryptData({
        encryptedData: encrypted2,
        ...testOptions,
      });

      expect(decrypted1).toEqual(data);
      expect(decrypted2).toEqual(data);
    });

    it('should correctly format the combined data structure', async () => {
      const data = Buffer.from('Test data for structure verification');

      const encryptedData = await encryptData({
        plaintext: data,
        ...testOptions,
      });

      // 構造の検証
      // 最初の2バイトは DEK の長さ
      const dekLength = encryptedData.readUInt16BE(0);
      expect(dekLength).toBe(32); // モックされた DEK は32バイト（AES-256用）

      // 次の dekLength バイトは暗号化された DEK
      const encryptedDek = encryptedData.subarray(2, 2 + dekLength);
      expect(encryptedDek.length).toBe(32);

      // 次の12バイトは IV
      const iv = encryptedData.subarray(2 + dekLength, 2 + dekLength + 12);
      expect(iv.length).toBe(12);

      // 次の16バイトは認証タグ
      const authTag = encryptedData.subarray(2 + dekLength + 12, 2 + dekLength + 12 + 16);
      expect(authTag.length).toBe(16);

      // 残りは暗号化されたデータ
      const encryptedPayload = encryptedData.subarray(2 + dekLength + 12 + 16);
      expect(encryptedPayload.length).toBeGreaterThan(0);
    });

    it('should fail decryption if data is tampered', async () => {
      const originalData = Buffer.from('Sensitive data');

      const encryptedData = await encryptData({
        plaintext: originalData,
        ...testOptions,
      });

      // 暗号化されたデータを改ざん
      const tamperedData = Buffer.from(encryptedData);
      tamperedData[tamperedData.length - 1] ^= 0xFF; // 最後のバイトを反転

      // 改ざんされたデータの復号はエラーになるはず
      await expect(decryptData({
        encryptedData: tamperedData,
        ...testOptions,
      })).rejects.toThrow();
    });

    it('should fail decryption if auth tag is modified', async () => {
      const originalData = Buffer.from('Sensitive data');

      const encryptedData = await encryptData({
        plaintext: originalData,
        ...testOptions,
      });

      // 認証タグを改ざん
      const tamperedData = Buffer.from(encryptedData);
      const dekLength = tamperedData.readUInt16BE(0);
      const authTagStart = 2 + dekLength + 12;
      tamperedData[authTagStart] ^= 0xFF; // 認証タグの最初のバイトを反転

      // 認証タグが改ざんされたデータの復号はエラーになるはず
      await expect(decryptData({
        encryptedData: tamperedData,
        ...testOptions,
      })).rejects.toThrow();
    });
  });
});
