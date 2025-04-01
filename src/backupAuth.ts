import { KeyManagementServiceClient } from '@google-cloud/kms';
import { Storage } from '@google-cloud/storage';
import { auth } from 'firebase-tools';
import { readFileSync, unlinkSync, writeFileSync } from 'fs';

export const backupAuth = async ({
  region,
  projectId = process.env.GCLOUD_PROJECT,
  bucketName = `${process.env.GCLOUD_PROJECT}-authentication-backups`,
}: {
  region: string;
  projectId?: string;
  bucketName?: string;
}): Promise<void> => {
  const plaintextFileName = `firebase-authentication-backup.csv`;

  const tmpPlaintextFileName = `/tmp/${plaintextFileName}`;
  console.log(`tmpPlaintextFileName = ${tmpPlaintextFileName}`);
  const tmpCiphertextFileName = `/tmp/${plaintextFileName}.encripted`;
  console.log(`tmpCiphertextFileName = ${tmpCiphertextFileName}`);

  const gcsDestination = `${new Date().toISOString()}/${plaintextFileName}.encripted`;
  console.log(`gcsDestination = ${gcsDestination}`);

  // ローカルに取得
  await auth.export(tmpPlaintextFileName, { project: projectId });

  // ファイル読み込み
  const plaintext = readFileSync(tmpPlaintextFileName);

  // 暗号化
  const kmsClient = new KeyManagementServiceClient();
  const keyName = kmsClient.cryptoKeyPath(
    projectId,
    region,
    'firebase-authentication-keyring',
    'firebase-authentication-backup-key'
  );
  const [result] = await kmsClient.encrypt({ name: keyName, plaintext });
  writeFileSync(tmpCiphertextFileName, result.ciphertext as string);

  // GCS に保存
  const gcsClient = new Storage();
  const bucket = gcsClient.bucket(bucketName);
  await bucket.upload(tmpCiphertextFileName, { destination: gcsDestination });

  // ローカルのファイルを削除
  unlinkSync(tmpPlaintextFileName);
  unlinkSync(tmpCiphertextFileName);
};
