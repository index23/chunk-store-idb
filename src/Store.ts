import EventEmitter from './EventEmitter'

export default class Store {
  public chunkLength: number;

  private idb: any;
  private db: IDBDatabase;

  // Closed flag
  private closed:boolean = false;

  private eventEmitter: EventEmitter;

  // Use to count number of store objects created. Determine database nome
  private static storeCount: number = 0
  private readonly currentStoreCount: number = 0

  constructor (chunkLength: number) {
    this.currentStoreCount = Store.storeCount
    this.chunkLength = chunkLength;

    this.eventEmitter = new EventEmitter();

    // Open indexedDB (torrent_chunks) and
    // create objectStore (torrent_chunk_store)
    this.idb = window.indexedDB || {}; // || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;

    let request = this.idb.open(this.getDatabaseName(), 1);

    Store.storeCount++

    request.onerror = (ev) => {
      // Don't forget to handle errors!
    }

    request.onsuccess = (ev: any) => {
      this.db = ev.target.result;

      // EventEmmitter.emit('dbOpened')
      this.eventEmitter.notify()
    }

    request.onupgradeneeded = (ev: any) => {
      // Save the IDBDatabase interface
      this.db = ev.target.result;

      // Create an objectStore for this database
      this.db.createObjectStore('torrent_chunk_store');
    };
  }

  // TODO define cb parameters
  public get (index: number, options, cb: Function) {
    let self = this
    if (typeof options === 'function') {
      return this.get(index, null, options)
    }

    if (typeof cb !== 'function') {
      cb = (err: Error, ev?: Event): void => {}
    }

    this.executeFn(() => {
      let transaction = self.db.transaction('torrent_chunk_store', 'readonly');
      let request = transaction.objectStore('torrent_chunk_store').get(index);

      transaction.onerror = (ev) => {
        // Don't forget to handle errors!
      }

      this.resolveRequest(request, (err, ev) => {
        let target = <IDBRequest> ev.target
        if (target.result === undefined) {
          // cb(null, new Buffer(0))
          this.nextTick(cb, new Error('Try to access non-existent index'))
        } else {
          const buffer = new Buffer(target.result);
          if (!options) {
            return self.nextTick(cb, null, buffer)
          }
          const offset = options.offset || 0
          const length = options.length || (target.result.length - offset)
          cb(null, buffer.slice(offset, offset + length))
        }
      })
    })
  }

  // TODO define cb parameters
  public put (index: number, chunkBuffer: Buffer, cb: (err: Error, ev?: Event) => void) {
    let self = this

    if (typeof cb !== 'function') {
      cb = (err: Error, ev?: Event): void => {}
    }

    if (chunkBuffer.length !== this.chunkLength) {
      return this.nextTick(cb, new Error('Chunk length must be: ' + this.chunkLength))
    }

    this.executeFn(() => {
      let transaction = self.db.transaction('torrent_chunk_store', 'readwrite')

      transaction.onerror = (ev) => {
        // Don't forget to handle errors!
      }

      let request = transaction.objectStore('torrent_chunk_store').put(chunkBuffer, index)

      this.resolveRequest(request, (err, ev) => {
        cb(err, ev)
      })
    })
  }

  public close (cb) {
    if (this.closed) return this.nextTick(cb, new Error('Storage is closed'));
    if (!this.db) return this.nextTick(cb, undefined)
    this.closed = true;
    this.nextTick(cb, null, null);
  }

  public destroy (cb) {
    // Currently same implementation as close
    // For indexeddb would be different:
    // -- Close would empty database
    // -- Destroy should delete database
    this.close(cb)
    this.idb.deleteDatabase(this.getDatabaseName())
  }

  private nextTick (cb, err, val?) {
    setTimeout(function () {
      if (cb) cb(err, val)
    }, 0)
  }

  /**
   * Get database name based on storeCount
   */
  private getDatabaseName () {
    const databaseName = 'torrent_chunks'

    if (this.currentStoreCount === 0) {
      return databaseName
    }

    return databaseName + '_' + this.currentStoreCount
  }

  private resolveRequest (request: IDBRequest, cb?: (err: Error, ev?: Event) => void) {
    request.onsuccess = (ev) => {
      cb(null, ev)
    }

    request.onerror = () => {
      cb(request.error)
    }
  }

  private executeFn (cb) {
    if (!this.db) {
      this.eventEmitter.subscribe(cb)
    } else {
      cb()
    }
  }
}
