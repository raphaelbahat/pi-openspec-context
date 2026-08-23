export type OpenSpecTarget =
  | { type: "root"; path: string }
  | { type: "store"; id: string; cwd: string };

export interface OpenSpecStoreEntry {
  id?: string;
  root?: string;
  path?: string;
  dir?: string;
}

export interface OpenSpecStoreListOutput {
  stores?: OpenSpecStoreEntry[];
}

export interface OpenSpecExecutionResult {
  stdout: string;
  stderr: string;
  code: number;
}

export interface PiExecContext {
  exec(
    cmd: string,
    args: string[],
    opts?: { timeout?: number; cwd?: string }
  ): Promise<OpenSpecExecutionResult>;
}
