import * as functions from 'firebase-functions';
import * as kms from '@google-cloud/kms';
import * as gcs from '@google-cloud/storage';
import * as firebaseTools from 'firebase-tools';
import * as fs from 'fs';

export const backupAuth = ({
  region = 'asia-northeast1',
  schedule = '0 0 * * *',
  timeZone = 'Asia/Tokyo',
  projectId = process.env.GCLOUD_PROJECT,
  bucketName,
}: {
  region?: string;
  schedule?: string;
  timeZone?: string;
  projectId?: string;
  bucketName?: string;
}): functions.CloudFunction<unknown> => {
  const bucket = bucketName || `${projectId}-authentication-backup`;
  return functions
    .region(region)
    .pubsub.schedule(schedule)
    .timeZone(timeZone)
    .onRun(async () => {
      try {
        await backupAuthToStorage(region, projectId, bucket);
        console.info('backup authentication, success');
      } catch (err) {
        console.error(err);
      }
    });
};

const backupAuthToStorage = async (region: string, projectId: string, bucketName: string) => {
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
