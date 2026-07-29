import { describe, expect, it } from "vitest";
import {
  collectDirectoryFiles,
  type ReadableDirectoryHandle,
  type ReadableFileHandle,
} from "../app/lib/directory-picker";

function fileHandle(name: string): ReadableFileHandle {
  return {
    kind: "file",
    name,
    async getFile() {
      return { name, size: 1024, lastModified: 0 } as File;
    },
  };
}

function directoryHandle(
  name: string,
  children: Array<ReadableDirectoryHandle | ReadableFileHandle>,
): ReadableDirectoryHandle {
  return {
    kind: "directory",
    name,
    async *values() {
      yield* children;
    },
  };
}

describe("collectDirectoryFiles", () => {
  it("recursively keeps paths for files from the native directory picker", async () => {
    const root = directoryHandle("MP3", [
      fileHandle("01-开场.mp3"),
      directoryHandle("Album", [
        fileHandle("02-第二首.flac"),
        directoryHandle("Disc 2", [fileHandle("03-第三首.wav")]),
      ]),
    ]);

    const selected = await collectDirectoryFiles(root);

    expect(selected.map((item) => item.relativePath)).toEqual([
      "MP3/01-开场.mp3",
      "MP3/Album/02-第二首.flac",
      "MP3/Album/Disc 2/03-第三首.wav",
    ]);
    expect(selected.map((item) => item.file.name)).toEqual([
      "01-开场.mp3",
      "02-第二首.flac",
      "03-第三首.wav",
    ]);
  });
});
