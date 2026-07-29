export interface ReadableFileHandle {
  kind: "file";
  name: string;
  getFile(): Promise<File>;
}

export interface ReadableDirectoryHandle {
  kind: "directory";
  name: string;
  values(): AsyncIterableIterator<ReadableFileHandle | ReadableDirectoryHandle>;
}

export interface PickedDirectoryFile {
  file: File;
  relativePath: string;
}

export async function collectDirectoryFiles(
  root: ReadableDirectoryHandle,
): Promise<PickedDirectoryFile[]> {
  const files: PickedDirectoryFile[] = [];

  async function walk(directory: ReadableDirectoryHandle, path: string) {
    for await (const handle of directory.values()) {
      const relativePath = `${path}/${handle.name}`;
      if (handle.kind === "directory") {
        await walk(handle, relativePath);
      } else {
        files.push({
          file: await handle.getFile(),
          relativePath,
        });
      }
    }
  }

  await walk(root, root.name);
  return files;
}
