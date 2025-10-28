import { unlinkSync } from "node:fs";

const unlinkFunctions: (() => void)[] = [];

const addUnlinkFunction = (fn: () => void) => {
  unlinkFunctions.push(fn);
};

let exitHandlerRegistered = false;
function registerExitHandler() {
  if (exitHandlerRegistered) return;

  // NOTE: process は import せずにグローバルなものを使わないとエラーが起こる
  process.on('exit', () => {
    unlinkFunctions.forEach((fn) => fn());
  });
  exitHandlerRegistered = true;
}

// エラーやSIGINTで処理が中断される場合でもプロセス終了時にファイルを削除するための関数を準備
export const prepareUnlinkFunction = (filePath: string) => {
  if (filePath === '') throw new Error('filePath must not be empty');

  registerExitHandler();

  let unlinked = false;
  const func = () => {
    try {
      if (unlinked) return;
      unlinkSync(filePath);
      unlinked = true;
    } catch (err) {
      // ignore
    }
  };
  addUnlinkFunction(func);
  return func;
};
