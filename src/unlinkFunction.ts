import { unlinkSync } from "node:fs";

let unlinkFunctions: (() => void)[] = [];

const addUnlinkFunction = (fn: () => void) => {
  unlinkFunctions.push(fn);
};

const removeUnlinkFunction = (fn: () => void) => {
  unlinkFunctions = unlinkFunctions.filter((f) => f !== fn);
};

const unlinkFilesOnExit = () => {
  unlinkFunctions.forEach((fn) => fn());
};

let exitHandlerRegistered = false;
function registerExitHandler() {
  if (exitHandlerRegistered) return;

  // NOTE: process は import せずにグローバルなものを使わないとエラーが起こる
  process.on('exit', unlinkFilesOnExit);
  exitHandlerRegistered = true;
}

// エラーやSIGINTで処理が中断される場合でもプロセス終了時にファイルを削除するための関数を準備
export const prepareUnlinkFunction = (filePath: string) => {
  if (filePath === '') throw new Error('filePath must not be empty');

  registerExitHandler();

  let unlinked = false;
  const func = () => {
    if (unlinked) return;

    try {
      unlinkSync(filePath);
      unlinked = true;
      // プロセス終了せずに prepareUnlinkFunction が何度も使われたときにメモリリークしないように
      // 不要になったファイル削除関数を exit handler から取り除く。
      // 普通は短時間でプロセス終了する使い方になると思うが一応。
      removeUnlinkFunction(func);
    } catch (err) {
      if (err instanceof Error && err['code'] === 'ENOENT') {
        unlinked = true;
        removeUnlinkFunction(func);
      } else {
        console.error(`Failed to unlink ${filePath}\n`, err);
      }
    }
  };
  addUnlinkFunction(func);
  return func;
};

// テスト用: unlinkFunctions 配列の長さを取得
export const __getUnlinkFunctionsCountForTest = () => unlinkFunctions.length;
