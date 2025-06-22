import { KeyManagementServiceClient } from "@google-cloud/kms";
import { Storage } from "@google-cloud/storage";
import { createDecipheriv } from "crypto";
import { auth } from "firebase-tools";
import { readFile, unlink, writeFile } from "fs/promises";

export const restoreAuth = async ({
  region,
  backupFilePath,
  projectId = process.env.GCLOUD_PROJECT,
  bucketName = `${process.env.GCLOUD_PROJECT}-authentication-backups`,
  encripted,
}: {
  region: string;
  backupFilePath: string;
  projectId?: string;
  bucketName?: string;
  encripted?: boolean;
}): Promise<void> => {
  const plaintextFileName = `firebase-authentication-backup.csv`;
  const tmpPlaintextFileName = `/tmp/${plaintextFileName}`;
  const tmpCiphertextFileName = `/tmp/${plaintextFileName}.encripted`;

  // GCS から ローカルに取得
  const gcsClient = new Storage();
  const bucket = gcsClient.bucket(bucketName);

  if (encripted) {
    await bucket
      .file(backupFilePath)
      .download({ destination: tmpCiphertextFileName });

    // 暗号化されたファイルを読み込み
    const combinedData = await readFile(tmpCiphertextFileName);

    // データを分解
    const dekLength = combinedData[0];
    const encryptedDek = combinedData.subarray(1, 1 + dekLength);
    const iv = combinedData.subarray(1 + dekLength, 1 + dekLength + 12);
    const authTag = combinedData.subarray(
      1 + dekLength + 12,
      1 + dekLength + 12 + 16
    );
    const encryptedData = combinedData.subarray(1 + dekLength + 12 + 16);

    // KMSでDEKを復号化
    const kmsClient = new KeyManagementServiceClient();
    const keyName = kmsClient.cryptoKeyPath(
      projectId!,
      region,
      "firebase-authentication-keyring",
      "firebase-authentication-backup-key"
    );
    const [result] = await kmsClient.decrypt({
      name: keyName,
      ciphertext: encryptedDek,
    });
    const dek = result.plaintext as Buffer;

    // AES-256-GCMでデータを復号化
    const decipher = createDecipheriv("aes-256-gcm", dek, iv);
    decipher.setAAD(Buffer.from("firebase-auth-backup"));
    decipher.setAuthTag(authTag);

    const decryptedData = Buffer.concat([
      decipher.update(encryptedData),
      decipher.final(),
    ]);

    await writeFile(tmpPlaintextFileName, decryptedData);
    // Authの復元
    await auth.upload(tmpPlaintextFileName, { project: projectId });
    // ローカルのファイルを削除
    await Promise.all([
      unlink(tmpPlaintextFileName),
      unlink(tmpCiphertextFileName),
    ]);
  } else {
    await bucket
      .file(backupFilePath)
      .download({ destination: tmpPlaintextFileName });
    // Authの復元
    await auth.upload(tmpPlaintextFileName, { project: projectId });
    // ローカルのファイルを削除
    await unlink(tmpPlaintextFileName);
  }
};
