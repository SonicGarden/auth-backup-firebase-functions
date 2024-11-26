# auth-backup-firebase-functions

Firebase Authentication Backup for Firebase Cloud Functions

## Installation

```sh
npm install --save @sonicgarden/auth-backup-firebase-functions
// or
yarn add @sonicgarden/auth-backup-firebase-functions
```

$ gcloud services enable cloudkms.googleapis.com --project [PROJECT_ID]
$ gcloud kms keyrings create --location=asia-northeast1 firebase-authentication-keyring --project [PROJECT_ID]
$ gcloud kms keys create --location=asia-northeast1 \
  --keyring=firebase-authentication-keyring \
  --purpose=encryption \
  --rotation-period=90d \
  --next-rotation-time="2022-07-31T00:00:00Z" \
  firebase-authentication-backup-key \
  --project [PROJECT_ID]

$ gcloud kms keys \
  add-iam-policy-binding \
  --location=asia-northeast1 \
  --keyring=firebase-authentication-keyring \
  firebase-authentication-backup-key \
  --member=serviceAccount:[PROJECT_ID]@appspot.gserviceaccount.com \
  --role=roles/cloudkms.cryptoKeyEncrypter \
  --project [PROJECT_ID]

## Usage

```js
import * as authBackup from '@sonicgarden/auth-backup-firebase-functions';
export backupAuth = authBackup.backupAuth({
  region: 'asia-northeast1',
  schedule: '0 0 * * *',
  timeZone: 'Asia/Tokyo',
});

//or

const authBackup = require('@sonicgarden/auth-backup-firebase-functions');
exports.backupAuth = authBackup.backupAuth({
  region: 'asia-northeast1',
  schedule: '0 0 * * *',
  timeZone: 'Asia/Tokyo',
});
```

### Parameters

| parameter  | required | default value                       |
| ---------- | -------- | ------------------------------      |
| region     | optional | asia-northeast1                     |
| schedule   | optional | 0 0 \* \* \*                        |
| timeZone   | optional | Asia/Tokyo                          |
| projectId  | optional | process.env.GCLOUD_PROJECT          |
| bucketName | optional | ${projectId}-authentication-backups |

## npm publish

```sh
git tag -a v1.0.0 -m "My first version v1.0.0"
git push origin tags/v1.0.0
npm publish --access=public
```

### update

```sh
npm version patch # or minor or magor
git push origin tags/v1.0.1
npm publish --access=public
```
