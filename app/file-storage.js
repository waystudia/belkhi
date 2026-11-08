// Store bytes directly so IndexedDB does not have to stage a Blob on disk.
export async function packFile(file) {
  return {bytes: await file.arrayBuffer(), type: file.type, name: file.name, lastModified: file.lastModified};
}

export function isStoredFile(file) {
  return file instanceof Blob || file?.bytes instanceof ArrayBuffer;
}

export function unpackFile(file) {
  if (file instanceof Blob) return file;
  if (file.name) return new File([file.bytes], file.name, {type: file.type, lastModified: file.lastModified});
  return new Blob([file.bytes], {type: file.type});
}
