import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { KeyManagementServiceClient } from "@google-cloud/kms";

export interface EncryptDataOptions {
  plaintext: Buffer;
  projectId: string;
  region: string;
  keyringName: string;
  keyName: string;
}

export interface DecryptDataOptions {
  encryptedData: Buffer;
  projectId: string;
  region: string;
  keyringName: string;
  keyName: string;
}

export async function encryptDEK(
  dek: Buffer,
  projectId: string,
  region: string,
  keyringName: string,
  keyName: string,
): Promise<Buffer> {
  const kmsClient = new KeyManagementServiceClient();
  const keyPath = kmsClient.cryptoKeyPath(
    projectId,
    region,
    keyringName,
    keyName,
  );
  const [result] = await kmsClient.encrypt({ name: keyPath, plaintext: dek });

  if (!result.ciphertext) {
    throw new Error("KMS encryption failed: No ciphertext returned");
  }

  return result.ciphertext as Buffer;
}

export async function decryptDEK(
  encryptedDek: Buffer,
  projectId: string,
  region: string,
  keyringName: string,
  keyName: string,
): Promise<Buffer> {
  const kmsClient = new KeyManagementServiceClient();
  const keyPath = kmsClient.cryptoKeyPath(
    projectId,
    region,
    keyringName,
    keyName,
  );
  const [result] = await kmsClient.decrypt({
    name: keyPath,
    ciphertext: encryptedDek,
  });

  if (!result.plaintext) {
    throw new Error("KMS decryption failed: No plaintext returned");
  }

  return result.plaintext as Buffer;
}

export async function encryptData({
  plaintext,
  projectId,
  region,
  keyringName,
  keyName,
}: EncryptDataOptions): Promise<Buffer> {
  const dek = randomBytes(32);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", dek, iv);
  cipher.setAAD(Buffer.from("firebase-auth-backup"));

  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const encryptedDek = await encryptDEK(
    dek,
    projectId,
    region,
    keyringName,
    keyName,
  );

  const lengthBytes = Buffer.allocUnsafe(2);
  lengthBytes.writeUInt16BE(encryptedDek.length, 0);
  const encryptedData = Buffer.concat([
    lengthBytes,
    encryptedDek,
    iv,
    authTag,
    ciphertext,
  ]);

  return encryptedData;
}

export async function decryptData({
  encryptedData,
  projectId,
  region,
  keyringName,
  keyName,
}: DecryptDataOptions): Promise<Buffer> {
  const dekLength = encryptedData.readUInt16BE(0);

  const encryptedDek = encryptedData.subarray(2, 2 + dekLength);
  const iv = encryptedData.subarray(2 + dekLength, 2 + dekLength + 12);
  const authTag = encryptedData.subarray(
    2 + dekLength + 12,
    2 + dekLength + 12 + 16,
  );
  const ciphertext = encryptedData.subarray(2 + dekLength + 12 + 16);

  const dek = await decryptDEK(
    encryptedDek,
    projectId,
    region,
    keyringName,
    keyName,
  );

  const decipher = createDecipheriv("aes-256-gcm", dek, iv);
  decipher.setAAD(Buffer.from("firebase-auth-backup"));
  decipher.setAuthTag(authTag);

  const decryptedData = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decryptedData;
}
