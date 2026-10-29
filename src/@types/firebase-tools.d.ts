// firebase-tools は型定義を同梱していない。any のままだと、13 系にあった別名 auth.upload を
// 15 系で呼んでもビルドが通り、復元の実行時に初めて失敗するため、使う 2 つだけ型を書く。
// SEE: https://github.com/firebase/firebase-tools/blob/v15.0.0/src/commands/index.ts
declare module "firebase-tools" {
  type CommandOptions = { project: string } & Record<string, unknown>;

  export const auth: {
    export(dataFile: string, options: CommandOptions): Promise<unknown>;
    import(dataFile: string, options: CommandOptions): Promise<unknown>;
  };
}
