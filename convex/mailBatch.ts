export const EMAIL_BATCH_SIZE = 100;

// Gmail requires a metadata request per message; bounded concurrency avoids
// firing a hundred requests at once and hitting per-user rate limits.
export async function mapMailBatch<T, R>(
  items: T[],
  read: (item: T) => Promise<R>,
): Promise<R[]> {
  const result: R[] = [];
  for (let start = 0; start < items.length; start += 10) {
    result.push(...await Promise.all(items.slice(start, start + 10).map(read)));
  }
  return result;
}
