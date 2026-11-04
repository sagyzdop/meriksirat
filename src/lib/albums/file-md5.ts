import SparkMD5 from 'spark-md5'

const CHUNK_BYTES = 4 * 1024 * 1024

export async function md5OfFile(file: File): Promise<string> {
  const hash = new SparkMD5.ArrayBuffer()
  for (let start = 0; start < file.size; start += CHUNK_BYTES) {
    hash.append(await file.slice(start, start + CHUNK_BYTES).arrayBuffer())
  }
  return hash.end()
}
