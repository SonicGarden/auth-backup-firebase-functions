# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

Firebase Authentication のバックアップ・リストア機能を提供する npm パッケージです。
Google Cloud Storage と Cloud KMS を使用して、Firebase Authentication データの安全なバックアップと復元を行います。

## 開発コマンド

### ビルド
```bash
npm run build                  # TypeScript コンパイル（tsconfig.release.json使用）
npm run build:release          # 本番用ビルド（production dependencies のみ）
npm run build:pack             # npm パッケージ作成
```

### テスト・型チェック
```bash
npm test                       # Vitest でテスト実行
npm run test:ui                # Vitest UI でテスト実行
npm run test:coverage          # カバレッジレポート付きテスト
npm run typecheck              # TypeScript 型チェック
```

**重要**: コードを変更した場合は、必ず以下のコマンドを実行してください：
```bash
npm run typecheck && npm test
```

### リリース
```bash
npm version patch              # パッチバージョン更新（major/minor も可）
git push origin tags/vX.X.X    # タグをプッシュ
npm publish --access=public    # npm に公開
```

## アーキテクチャ

### 主要モジュール

- **src/backupAuth.ts**: Firebase Auth データを GCS にバックアップ
  - firebase-tools の auth.export を使用してデータ取得
  - KMS による暗号化オプション
  - 一時ファイル処理とクリーンアップ

- **src/restoreAuth.ts**: GCS から Firebase Auth データを復元
  - 暗号化されたデータの復号化
  - firebase-tools の auth.upload を使用してデータ復元
  - パスワードハッシュパラメータのサポート

- **src/encryption.ts**: KMS を使用した暗号化・復号化処理
  - Google Cloud KMS クライアントラッパー
  - バッファサイズ管理

### 依存関係

- **firebase-tools**: Auth データのエクスポート/インポート
- **@google-cloud/storage**: GCS へのファイル保存・取得
- **@google-cloud/kms**: データ暗号化・復号化
- **firebase-admin**: Firebase プロジェクト管理

### デフォルト設定

- KMS キーリング名: `firebase-authentication-keyring`
- KMS キー名: `firebase-authentication-backup-key`
- GCS バケット名: `${PROJECT_ID}-authentication-backups`
- バックアップファイル名: `firebase-authentication-backup.csv`

## テスト実行

GitHub Actions で PR 時に自動テスト（Node.js 20, 22）