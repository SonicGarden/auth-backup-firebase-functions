# auth-backup-firebase-functions

Firebase Authentication Backup for Firebase Cloud Functions

## Installation

```sh
npm install --save @sonicgarden/auth-backup-firebase-functions
// or
yarn add @sonicgarden/auth-backup-firebase-functions
```

### Cloud Key Management Service setup

バックアップを KMS で暗号化するための初期設定を行う。

```shell
$ gcloud services enable cloudkms.googleapis.com --project [PROJECT_ID]
$ gcloud kms keyrings create --location=asia-northeast1 firebase-authentication-keyring --project [PROJECT_ID]
$ gcloud kms keys create --location=asia-northeast1 \
  --keyring=firebase-authentication-keyring \
  --purpose=encryption \
  --rotation-period=90d \
  --next-rotation-time="yyyy-MM-ddT00:00:00Z" \
  firebase-authentication-backup-key \
  --project [PROJECT_ID]
```

### Cloud Storage setup

バックアップの保存先である Storage のバケットを作成する。

```shell
$ gcloud storage buckets create gs://[PROJECT_ID]-authentication-backups \
  --project=[PROJECT_ID] \
  --default-storage-class=COLDLINE \
  --location=ASIA \
  --uniform-bucket-level-access
```

バケットのライフサイクルの設定を行う。
「オブジェクトが作成されてから 30 日以降」の条件で、「オブジェクトの削除」をするよう設定する。

```shell
$ echo "{ \"lifecycle\": { \"rule\": [{ \"action\": { \"type\": \"Delete\" }, \"condition\": { \"age\": 30 } }] } }" > lifecycle.json
$ gcloud storage buckets update gs://[PROJECT_ID]-authentication-backups --lifecycle-file=lifecycle.json
```

### Service Account setup

Functions を実行するサービスアカウントを作成します。
（もしくは Functions を実行する既存のサービスアカウントに以下ロールを付与する）

```shell
# サービスアカウント作成
$ gcloud iam service-accounts create backup-auth --display-name="backup-auth" --project [PROJECT_ID]

# 作成したサービスアカウントに「Identity Platform 閲覧者」を付与
$ gcloud projects add-iam-policy-binding [PROJECT_ID] \
  --member serviceAccount:backup-auth@[PROJECT_ID].iam.gserviceaccount.com \
  --role roles/identityplatform.viewer

# 作成したサービスアカウントに「Storage オブジェクト作成者」を付与
$ gcloud projects add-iam-policy-binding [PROJECT_ID] \
  --member serviceAccount:backup-auth@[PROJECT_ID].iam.gserviceaccount.com \
  --role roles/storage.objectCreator

# 作成したサービスアカウントに「クラウド KMS 暗号鍵の暗号化ロール」を付与
$ gcloud kms keys \
  add-iam-policy-binding \
  --location=asia-northeast1 \
  --keyring=firebase-authentication-keyring \
  firebase-authentication-backup-key \
  --member=serviceAccount:backup-auth@[PROJECT_ID].iam.gserviceaccount.com \
  --role=roles/cloudkms.cryptoKeyEncrypter \
  --project [PROJECT_ID]
```

Restore を実行するためのサービスアカウントを作成。
Restoreが必要になった時に、このサービスアカウントを作成し、そのサービスアカウントを利用してscript等でRestore関数を実行する。

```shell
# サービスアカウント作成
$ gcloud iam service-accounts create restore-auth --display-name="restore-auth" --project [PROJECT_ID]

# 作成したサービスアカウントに「Identity Platform 管理者」を付与
$ gcloud projects add-iam-policy-binding [PROJECT_ID] \
  --member serviceAccount:restore-auth@[PROJECT_ID].iam.gserviceaccount.com \
  --role roles/identityplatform.admin

# 作成したサービスアカウントに「Storage オブジェクト閲覧者」を付与
$ gcloud projects add-iam-policy-binding [PROJECT_ID] \
  --member serviceAccount:restore-auth@[PROJECT_ID].iam.gserviceaccount.com \
  --role roles/storage.objectViewer

# 作成したサービスアカウントに「クラウド KMS 暗号鍵の暗号化ロール」を付与
$ gcloud kms keys \
  add-iam-policy-binding \
  --location=asia-northeast1 \
  --keyring=firebase-authentication-keyring \
  firebase-authentication-backup-key \
  --member=serviceAccount:restore-auth@[PROJECT_ID].iam.gserviceaccount.com \
  --role=roles/cloudkms.cryptoKeyEncrypterDecrypter \
  --project [PROJECT_ID]
```

## Usage

```ts
import { backupAuth as _backupAuth } from '@sonicgarden/auth-backup-firebase-functions';
import { onSchedule } from 'firebase-functions/v2/scheduler';

export const backupAuth = onSchedule(
  {
    schedule: '0 1 * * *',
    region: 'asia-northeast1',
    timeZone: 'Asia/Tokyo',
    serviceAccount: 'backup-auth@[PROJECT_ID].iam.gserviceaccount.com',
  },
  async (event) => {
    await _backupAuth({ region: 'asia-northeast1' });
  }
);
```

### Parameters

| parameter  | required | default value                       |
| ---------- | -------- | ----------------------------------- |
| region     | required | asia-northeast1                     |
| projectId  | optional | process.env.GCLOUD_PROJECT          |
| bucketName | optional | ${projectId}-authentication-backups |
| encrypt    | optional | false                               |

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
