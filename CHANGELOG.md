# Changelog

このパッケージの利用者に影響する変更を記録します。

## 2.0.0

### 互換性のない変更

- Node.js 22 以上が必要になりました。
  firebase-tools 15 系が実行時に入れる依存（`googleapis-common`、`google-auth-library` など）が Node.js 22 以上を要求するためです。
- `firebase-admin` を依存から外しました。
  このパッケージの中では使っていませんでした。これまでこのパッケージ経由で入る `firebase-admin` に頼っていた場合は、利用側の `package.json` に `firebase-admin` を書いてください。
- バックアップの CSV の列が 29 列から 53 列に増えます。
  使う firebase-tools を 13 系から 15 系に上げたためです。増えた列には apple.com / microsoft.com / gc.apple.com / playgames.google.com / linkedin.com / yahoo.com のログイン連携の情報が入ります。
  - 1.x で取ったバックアップは、2.0.0 で復元できます（先頭 28 列の位置は変わっていません）。
  - 2.0.0 で取ったバックアップを 1.x で復元すると、増えた列のログイン連携の情報は戻りません。

### 変更

- セットアップスクリプト `auth-backup-firebase-setup` が作るバケットの既定の場所を、`ASIA`（アジアのマルチリージョン）から `asia-northeast1`（東京）に変えました。README の手順も同じです。
  `ASIA` だと、バックアップが日本の外のデータセンターに保存されることがあるためです。
  バケットの場所は作った後で変えられないので、既存のバケットはそのままです。日本に移したい場合は、新しいバケットを作って `bucketName` で指定してください。
- セットアップスクリプトが macOS でも動くようにしました。これまでは KMS の鍵の次のローテーション日を GNU 版の `date` で計算していたため、macOS では失敗していました。
- firebase-tools を 13 系から 15 系（`^15.34.1`）に上げました。古い firebase-tools と firebase-admin 経由で入っていた依存の脆弱性を解消するためです。

## 1.0.6 以前

[タグ](https://github.com/SonicGarden/auth-backup-firebase-functions/tags) とコミット履歴を参照してください。
