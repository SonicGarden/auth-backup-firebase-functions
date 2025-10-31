import { readFile } from "node:fs/promises";
import { Storage } from "@google-cloud/storage";
import { auth } from "firebase-tools";
import { DEFAULT_KEY_NAME, DEFAULT_KEYRING_NAME } from "./utils/constants";
import { encryptData } from "./utils/encryption";
import { makeTmpFilePath } from "./utils/makeTmpFilePath";
import { prepareUnlinkFunction } from "./utils/unlinkFunction";

export type BackupResult = {
  bucketName: string;
  objectPath: string;
  objectUrl: string;
};

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
}): Promise<BackupResult> => {
  if (projectId == null) throw new Error("projectId must be present.");

  const plaintextFileName = `firebase-authentication-backup.csv`;
  const gcsDirectoryName = new Date().toISOString();
  const gcsDestination = encrypt
    ? `${gcsDirectoryName}/${plaintextFileName}.encrypted`
    : `${gcsDirectoryName}/${plaintextFileName}`;

  const tmpPlaintextFileName = makeTmpFilePath("auth-backup-", ".csv");
  const unlinkFunction = prepareUnlinkFunction(tmpPlaintextFileName);

  console.log(
    `Start to backup Firebase Authentication to bucket ${bucketName}.`,
  );
  try {
    // ローカルに取得
    console.log("Exporting Firebase Authentication users ...");
    await auth.export(tmpPlaintextFileName, { project: projectId });

    const gcsClient = new Storage();
    const bucket = gcsClient.bucket(bucketName);

    // ファイル読み込み
    const plaintext = await readFile(tmpPlaintextFileName);
    if (encrypt) {
      console.log("Encrypting the backup ...");
      const encryptedData = await encryptData({
        plaintext,
        projectId,
        region,
        keyringName,
        keyName,
      });

      console.log(`Uploading the backup to ${gcsDestination} ...`);
      await bucket.file(gcsDestination).save(encryptedData);
    } else {
      console.log(`Uploading the backup to ${gcsDestination} ...`);
      await bucket.upload(tmpPlaintextFileName, {
        destination: gcsDestination,
      });
    }
    console.log("Done.");

    return {
      bucketName,
      objectPath: gcsDestination,
      objectUrl: `gs://${bucketName}/${gcsDestination}`,
    };
  } finally {
    unlinkFunction();
  }
};
