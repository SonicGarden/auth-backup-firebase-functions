import { Storage } from "@google-cloud/storage";
import { auth } from "firebase-tools";
import { readFile, unlink, writeFile } from "fs/promises";
import { DEFAULT_KEY_NAME, DEFAULT_KEYRING_NAME } from "./constants";
import { encryptData } from "./encryption";

export const backupAuth = async ({
  region,
  projectId = process.env.GCLOUD_PROJECT,
  bucketName = `${process.env.GCLOUD_PROJECT}-authentication-backups`,
  encrypt = true,
  keyringName = DEFAULT_KEYRING_NAME,
  keyName = DEFAULT_KEY_NAME,
}: {
  region: string;
  projectId?: string;
  bucketName?: string;
  encrypt?: boolean;
  keyringName?: string;
  keyName?: string;
}): Promise<void> => {
  const plaintextFileName = `firebase-authentication-backup.csv`;
  const tmpPlaintextFileName = `/tmp/${plaintextFileName}`;
  const gcsDirectoryName = new Date().toISOString();
  const gcsDestination = encrypt ? `${gcsDirectoryName}/${plaintextFileName}.encrypted` : `${gcsDirectoryName}/${plaintextFileName}`;

  // ローカルに取得
  await auth.export(tmpPlaintextFileName, { project: projectId });

  const gcsClient = new Storage();
  const bucket = gcsClient.bucket(bucketName);

  // ファイル読み込み
  const plaintext = await readFile(tmpPlaintextFileName);
  if (encrypt) {
    const tmpCiphertextFileName = `/tmp/${plaintextFileName}.encrypted`;

    const combinedData = await encryptData({
      plaintext,
      projectId: projectId!,
      region,
      keyringName,
      keyName,
    });

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
