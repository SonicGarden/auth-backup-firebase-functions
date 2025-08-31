import { Storage } from "@google-cloud/storage";
import { auth } from "firebase-tools";
import { writeFileSync } from "node:fs";
import { DEFAULT_KEY_NAME, DEFAULT_KEYRING_NAME } from "./constants";
import { decryptData } from "./encryption";
import { prepareUnlinkFunction } from "./unlinkFunction";
import { makeTmpFilePath } from "./makeTmpFilePath";

// SEE: https://github.com/firebase/firebase-tools/blob/v14.15.1/src/accountImporter.ts
export type HashAlgo =
  | 'HMAC_SHA512'
  | 'HMAC_SHA256'
  | 'HMAC_SHA1'
  | 'HMAC_MD5'
  | 'MD5'
  | 'SHA1'
  | 'SHA256'
  | 'SHA512'
  | 'PBKDF_SHA1'
  | 'PBKDF2_SHA256'
  | 'SCRYPT'
  | 'BCRYPT'
  | 'STANDARD_SCRYPT';

export type HashParams = {
  hashAlgo: HashAlgo;
  hashKey: string;
  saltSeparator: string;
  rounds: number;
  memCost: number;
};

export const restoreAuth = async ({
  region,
  backupFilePath,
  projectId = process.env.GCLOUD_PROJECT,
  bucketName = `${process.env.GCLOUD_PROJECT}-authentication-backups`,
  encrypted,
  keyringName = DEFAULT_KEYRING_NAME,
  keyName = DEFAULT_KEY_NAME,
  destinationProjectId = process.env.GCLOUD_PROJECT,
  hashParams,
}: {
  region: string;
  backupFilePath: string;
  projectId?: string;
  bucketName?: string;
  encrypted?: boolean;
  keyringName?: string;
  keyName?: string;
  destinationProjectId?: string;
  hashParams?: HashParams;
}): Promise<void> => {
  // GCS から ローカルに取得
  const gcsClient = new Storage();
  const bucket = gcsClient.bucket(bucketName);

  if (encrypted) {
    const [encryptedData] = await bucket
      .file(backupFilePath)
      .download();

    const decryptedData = await decryptData({
      encryptedData,
      projectId,
      region,
      keyringName,
      keyName,
    });

    const tmpFilePath = makeTmpFilePath('auth-backup-', '.csv');
    writeFileSync(tmpFilePath, decryptedData);
    const unlinkFunction = prepareUnlinkFunction(tmpFilePath);

    // Authの復元
    await auth.upload(tmpFilePath, { project: destinationProjectId, ...hashParams });
    unlinkFunction();
  } else {
    const tmpFilePath = makeTmpFilePath('auth-backup-', '.csv');
    await bucket
      .file(backupFilePath)
      .download({ destination: tmpFilePath });
    const unlinkFunction = prepareUnlinkFunction(tmpFilePath);

    // Authの復元
    await auth.upload(tmpFilePath, { project: destinationProjectId, ...hashParams });
    unlinkFunction();
  }
};
