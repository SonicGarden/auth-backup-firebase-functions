import * as kms from '@google-cloud/kms';
import * as gcs from '@google-cloud/storage';
import * as firebaseTools from 'firebase-tools';
import * as fs from 'fs';

export const restoreAuth = async (
  region: string,
  projectId: string,
  encriptedFilePath: string,
  bucketName = `${process.env.GCLOUD_PROJECT}-authentication-backups`
): Promise<void> => {
  const plaintextFileName = `firebase-authentication-backup.csv`;

  const tmpPlaintextFileName = `/tmp/${plaintextFileName}`;
  console.log(`tmpPlaintextFileName = ${tmpPlaintextFileName}`);
  const tmpCiphertextFileName = `/tmp/${plaintextFileName}.encripted`;
  console.log(`tmpCiphertextFileName = ${tmpCiphertextFileName}`);

  // GCS から ローカルに取得
  const gcsClient = new gcs.Storage();
  const bucket = gcsClient.bucket(bucketName);
  await bucket.file(encriptedFilePath).download({ destination: tmpCiphertextFileName });

  // ファイル読み込み
  const ciphertext = fs.readFileSync(tmpCiphertextFileName);

  // 復号化
  const kmsClient = new kms.KeyManagementServiceClient();
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
  fs.writeFileSync(tmpPlaintextFileName, result.plaintext.toString());

  // Authの復元
  await firebaseTools.auth.upload(tmpPlaintextFileName, { project: projectId });

  // ローカルのファイルを削除
  fs.unlinkSync(tmpPlaintextFileName);
  fs.unlinkSync(tmpCiphertextFileName);
};
