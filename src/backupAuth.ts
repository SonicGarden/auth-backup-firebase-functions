import * as kms from '@google-cloud/kms';
import * as gcs from '@google-cloud/storage';
import * as firebaseTools from 'firebase-tools';
import * as fs from 'fs';

export const backupAuth = async (
  region: string,
  projectId: string,
  bucketName = `${process.env.GCLOUD_PROJECT}-authentication-backup`
): Promise<void> => {
  const plaintextFileName = `firebase-authentication-backup.csv`;

  const tmpPlaintextFileName = `/tmp/${plaintextFileName}`;
  console.log(`tmpPlaintextFileName = ${tmpPlaintextFileName}`);
  const tmpCiphertextFileName = `/tmp/${plaintextFileName}.encripted`;
  console.log(`tmpCiphertextFileName = ${tmpCiphertextFileName}`);

  const gcsDestination = `${new Date().toISOString()}/${plaintextFileName}.encripted`;
  console.log(`gcsDestination = ${gcsDestination}`);

  // ローカルに取得
  await firebaseTools.auth.export(tmpPlaintextFileName, { project: projectId });

  // ファイル読み込み
  const plaintext = fs.readFileSync(tmpPlaintextFileName);

  // 暗号化
  const kmsClient = new kms.KeyManagementServiceClient();
  const keyName = kmsClient.cryptoKeyPath(
    projectId,
    region,
    'firebase-authentication-keyring',
    'firebase-authentication-backup-key'
  );
  const [result] = await kmsClient.encrypt({ name: keyName, plaintext });
  fs.writeFileSync(tmpCiphertextFileName, result.ciphertext as string);

  // GCS に保存
  const gcsClient = new gcs.Storage();
  const bucket = gcsClient.bucket(bucketName);
  await bucket.upload(tmpCiphertextFileName, { destination: gcsDestination });

  // ローカルのファイルを削除
  fs.unlinkSync(tmpPlaintextFileName);
  fs.unlinkSync(tmpCiphertextFileName);
};
