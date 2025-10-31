import { writeFileSync } from "node:fs";
import { Storage } from "@google-cloud/storage";
import { auth } from "firebase-tools";
import { DEFAULT_KEY_NAME, DEFAULT_KEYRING_NAME } from "./utils/constants";
import { decryptData } from "./utils/encryption";
import { makeTmpFilePath } from "./utils/makeTmpFilePath";
import { prepareUnlinkFunction } from "./utils/unlinkFunction";

// SEE: https://github.com/firebase/firebase-tools/blob/v14.15.1/src/accountImporter.ts
export type HashAlgo =
  | "HMAC_SHA512"
  | "HMAC_SHA256"
  | "HMAC_SHA1"
  | "HMAC_MD5"
  | "MD5"
  | "SHA1"
  | "SHA256"
  | "SHA512"
  | "PBKDF_SHA1"
  | "PBKDF2_SHA256"
  | "SCRYPT"
  | "BCRYPT"
  | "STANDARD_SCRYPT";

export type HashParams = {
  hashAlgo: HashAlgo;
  hashKey: string;
  saltSeparator: string;
  rounds: number;
  memCost: number;
};

const uploadAuth = async ({
  authData,
  destinationProjectId,
  hashParams,
}: {
  authData: Buffer;
  destinationProjectId: string;
  hashParams?: HashParams;
}) => {
  const tmpFilePath = makeTmpFilePath("auth-backup-", ".csv");
  const unlinkFunction = prepareUnlinkFunction(tmpFilePath);

  try {
    writeFileSync(tmpFilePath, authData);

    // Authの復元
    console.log("Uploading auth backup to Firebase Authentication ...");
    await auth.upload(tmpFilePath, {
      project: destinationProjectId,
      ...hashParams,
    });
  } finally {
    unlinkFunction();
  }
};

export const restoreAuth = async ({
  region,
  backupFilePath,
  projectId = process.env.GCLOUD_PROJECT,
  bucketName = `${process.env.GCLOUD_PROJECT}-authentication-backups`,
  encrypted = true,
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
  if (projectId == null) throw new Error("projectId must be present.");
  if (destinationProjectId == null) throw new Error("destinationProjectId must be present.");

  // GCS から ローカルに取得
  const gcsClient = new Storage();
  const bucket = gcsClient.bucket(bucketName);

  console.log(`Start to restore auth backup ${backupFilePath} in bucket ${bucketName}.`);
  console.log("Downloading auth backup ...");
  const [backupData] = await bucket.file(backupFilePath).download();

  if (encrypted) {
    console.log("Decrypting auth backup ...");
    const decryptedData = await decryptData({
      encryptedData: backupData,
      projectId,
      region,
      keyringName,
      keyName,
    });
    await uploadAuth({
      authData: decryptedData,
      destinationProjectId,
      hashParams,
    });
  } else {
    await uploadAuth({
      authData: backupData,
      destinationProjectId,
      hashParams,
    });
  }
  console.log("Done.");
};
