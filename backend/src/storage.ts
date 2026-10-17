export interface StorageItem {
  data: Buffer;
  contentType: string;
}

export class StorageClient {
  private inMemory = new Map<string, StorageItem>();

  async putObject(
    key: string,
    data: Buffer,
    contentType: string,
  ): Promise<void> {
    if (process.env.SIMULATE_R2_FAILURE === 'true') {
      throw new Error('r2-write-failed');
    }
    this.inMemory.set(key, { data: Buffer.from(data), contentType });
  }

  async deleteObject(key: string): Promise<void> {
    if (process.env.SIMULATE_R2_FAILURE === 'true') {
      throw new Error('r2-delete-failed');
    }
    this.inMemory.delete(key);
  }

  async getObject(key: string): Promise<StorageItem | null> {
    const item = this.inMemory.get(key);
    if (!item) {
      return null;
    }
    return { data: Buffer.from(item.data), contentType: item.contentType };
  }

  async hasObject(key: string): Promise<boolean> {
    return this.inMemory.has(key);
  }

  clear(): void {
    this.inMemory.clear();
  }
}

export const storage = new StorageClient();
