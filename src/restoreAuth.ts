import { KeyManagementServiceClient } from '@google-cloud/kms';
import { Storage } from '@google-cloud/storage';
import { auth } from 'firebase-tools';
import { readFile, unlink, writeFile } from 'fs/promises';

export const restoreAuth = async ({
  region,
  encriptedFilePath,
  projectId = process.env.GCLOUD_PROJECT,
  bucketName = `${process.env.GCLOUD_PROJECT}-authentication-backups`,
}: {
  region: string;
  encriptedFilePath: string;
  projectId?: string;
  bucketName?: string;
}): Promise<void> => {
  const plaintextFileName = `firebase-authentication-backup.csv`;
  const tmpPlaintextFileName = `/tmp/${plaintextFileName}`;
  const tmpCiphertextFileName = `/tmp/${plaintextFileName}.encripted`;

  // GCS から ローカルに取得
  const gcsClient = new Storage();
  const bucket = gcsClient.bucket(bucketName);
  await bucket.file(encriptedFilePath).download({ destination: tmpCiphertextFileName });

  // ファイル読み込み
  const ciphertext = await readFile(tmpCiphertextFileName);

  // 復号化
  const kmsClient = new KeyManagementServiceClient();
  const keyName = kmsClient.cryptoKeyPath(
    projectId,
    region,
    'firebase-authentication-keyring',
    'firebase-authentication-backup-key'
  );
  const [result] = await kmsClient.decrypt({
    name: keyName,
    ciphertext: ciphertext,
  });

  if (!result.plaintext) {
    throw new Error('Decrypt Failed.');
  }
  await writeFile(tmpPlaintextFileName, result.plaintext.toString());

  // Authの復元
  await auth.upload(tmpPlaintextFileName, { project: projectId });

  // ローカルのファイルを削除
  await Promise.all([unlink(tmpPlaintextFileName), unlink(tmpCiphertextFileName)]);
};
