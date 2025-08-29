import { Storage } from "@google-cloud/storage";
import { auth } from "firebase-tools";
import { readFile, unlink, writeFile } from "fs/promises";
import { DEFAULT_KEY_NAME, DEFAULT_KEYRING_NAME } from "./constants";
import { decryptData } from "./encryption";

export const restoreAuth = async ({
  region,
  backupFilePath,
  projectId = process.env.GCLOUD_PROJECT,
  bucketName = `${process.env.GCLOUD_PROJECT}-authentication-backups`,
  encrypted,
  keyringName = DEFAULT_KEYRING_NAME,
  keyName = DEFAULT_KEY_NAME,
}: {
  region: string;
  backupFilePath: string;
  projectId?: string;
  bucketName?: string;
  encrypted?: boolean;
  keyringName?: string;
  keyName?: string;
}): Promise<void> => {
  const plaintextFileName = `firebase-authentication-backup.csv`;
  const tmpPlaintextFileName = `/tmp/${plaintextFileName}`;
  const tmpCiphertextFileName = `/tmp/${plaintextFileName}.encrypted`;

  // GCS から ローカルに取得
  const gcsClient = new Storage();
  const bucket = gcsClient.bucket(bucketName);

  if (encrypted) {
    await bucket
      .file(backupFilePath)
      .download({ destination: tmpCiphertextFileName });

    // 暗号化されたファイルを読み込み
    const combinedData = await readFile(tmpCiphertextFileName);

    const decryptedData = await decryptData({
      combinedData,
      projectId: projectId!,
      region,
      keyringName,
      keyName,
    });

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
