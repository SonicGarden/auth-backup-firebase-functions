import { KeyManagementServiceClient } from "@google-cloud/kms";
import { Storage } from "@google-cloud/storage";
import { createCipheriv, randomBytes } from "crypto";
import { auth } from "firebase-tools";
import { readFile, unlink, writeFile } from "fs/promises";

export const backupAuth = async ({
  region,
  projectId = process.env.GCLOUD_PROJECT,
  bucketName = `${process.env.GCLOUD_PROJECT}-authentication-backups`,
  encript,
}: {
  region: string;
  projectId?: string;
  bucketName?: string;
  encript?: boolean;
}): Promise<void> => {
  const plaintextFileName = `firebase-authentication-backup.csv`;
  const tmpPlaintextFileName = `/tmp/${plaintextFileName}`;
  const gcsDestination = `${new Date().toISOString()}/${plaintextFileName}.encrypted`;

  // ローカルに取得
  await auth.export(tmpPlaintextFileName, { project: projectId });

  const gcsClient = new Storage();
  const bucket = gcsClient.bucket(bucketName);

  // ファイル読み込み
  const plaintext = await readFile(tmpPlaintextFileName);
  if (encript) {
    const tmpCiphertextFileName = `/tmp/${plaintextFileName}.encrypted`;

    const dek = randomBytes(32);
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", dek, iv);
    cipher.setAAD(Buffer.from("firebase-auth-backup"));

    const encryptedData = Buffer.concat([
      cipher.update(plaintext),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    const kmsClient = new KeyManagementServiceClient();
    const keyName = kmsClient.cryptoKeyPath(
      projectId!,
      region,
      "firebase-authentication-keyring",
      "firebase-authentication-backup-key"
    );
    const [result] = await kmsClient.encrypt({ name: keyName, plaintext: dek });

    // 暗号化されたDEK、IV、認証タグ、暗号化されたデータを結合
    const encryptedDek = result.ciphertext as Buffer;
    const combinedData = Buffer.concat([
      Buffer.from([encryptedDek.length]), // 暗号化されたDEKの長さ（1バイト）
      encryptedDek, // 暗号化されたDEK
      iv, // IV（12バイト）
      authTag, // 認証タグ（16バイト）
      encryptedData, // 暗号化されたデータ
    ]);

    await writeFile(tmpCiphertextFileName, combinedData);

    await bucket.upload(tmpCiphertextFileName, { destination: gcsDestination });

    await Promise.all([
      unlink(tmpPlaintextFileName),
      unlink(tmpCiphertextFileName),
    ]);
  } else {
    await bucket.upload(tmpPlaintextFileName, { destination: gcsDestination });

    await unlink(tmpPlaintextFileName);
  }
};
