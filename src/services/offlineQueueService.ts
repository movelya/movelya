export interface OfflineWaterAdd { id: string; userId: string; amountMl: number; occurredAt: string; createdAt: string }
const DB = 'movelya-offline-v1', STORE = 'water-additions'

export const offlineQueueService = {
  async addWater(userId: string, amountMl: number, occurredAt: string) {
    const item: OfflineWaterAdd = { id: crypto.randomUUID(), userId, amountMl, occurredAt, createdAt: new Date().toISOString() }
    await withStore('readwrite', (store) => store.put(item))
    return item
  },
  async waterFor(userId: string) { return ((await withStore('readonly', (store) => store.getAll())) as OfflineWaterAdd[]).filter((item) => item.userId === userId) },
  async remove(id: string) { await withStore('readwrite', (store) => store.delete(id)) },
}

function withStore(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest) {
  return new Promise<unknown>((resolve, reject) => {
    if (!('indexedDB' in window)) return reject(new Error('Armazenamento offline indisponível.'))
    const request = indexedDB.open(DB, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' })
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const transaction = request.result.transaction(STORE, mode), result = operation(transaction.objectStore(STORE))
      result.onsuccess = () => resolve(result.result)
      result.onerror = () => reject(result.error)
    }
  })
}
