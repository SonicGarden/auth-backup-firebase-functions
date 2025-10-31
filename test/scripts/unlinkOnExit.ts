import { writeFileSync, existsSync } from "node:fs";
import { setTimeout } from "node:timers/promises";
import { exit } from "node:process";
import { makeTmpFilePath } from "../../src/utils/makeTmpFilePath";
import { prepareUnlinkFunction } from "../../src/utils/unlinkFunction";

// プロセス終了時のファイル削除をテストするためのスクリプト
// テストから実行され、一時ファイルを作成してprepareUnlinkFunctionを呼び出し、
// プロセス終了時にファイルが削除されることを確認する
async function main() {
  const path = makeTmpFilePath("exit-test-", ".txt");
  writeFileSync(path, "Test content for exit handler");

  // ファイルパスを標準出力に出力（テストが読み取る）
  console.log(`TEMP_FILE_PATH:${path}`);

  // プロセス終了時にファイルを削除するよう設定
  prepareUnlinkFunction(path);

  // ファイルが存在することを確認
  if (!existsSync(path)) {
    console.error("File was not created");
    exit(1);
  }

  // 短時間待機してからプロセス終了
  await setTimeout(100);

  // 正常終了（exit handlerでファイルが削除されるはず）
  exit(0);
}

main().catch((error) => {
  console.error("Script error:", error);
  exit(1);
});
