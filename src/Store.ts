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

    request.onerror = (event) => {
      // Don't forget to handle errors!
    }

    request.onsuccess = (event: any) => {
      this.db = event.target.result;

      // EventEmmitter.emit('dbOpened')
      this.eventEmitter.notify()
    }

    request.onupgradeneeded = (event: any) => {
      // Save the IDBDatabase interface
      this.db = event.target.result;

      // Create an objectStore for this database
      this.db.createObjectStore('torrent_chunk_store');
    };
  }

  get (index: number, options, cb) {
    let self = this
    if (typeof options === 'function') {
      return this.get(index, null, options)
    }

    if (!cb) {
      cb = () => {}
    }

    if (!this.db) {
      // Execute listener
      this.eventEmitter.subscribe(_get.bind(this, index))
    } else {
      return _get(index)
    }

    function _get (index) {
      // return new Promise(function (resolve, reject) {
      let transaction = self.db.transaction('torrent_chunk_store', 'readonly');
      let request = transaction.objectStore('torrent_chunk_store').get(index);

      transaction.onerror = (event) => {
        // Don't forget to handle errors!
      }

      request.onsuccess = (event) => {
        // resolve(event.target)
        let target = <IDBRequest> event.target
        if (target.result === undefined) {
          // cb(null, new Buffer(0))
          this.nextTick(cb, new Error('Try to access non existen index'))
        } else {
          const buffer = new Buffer(target.result);
          if (!options) {
            return self.nextTick(cb, null, buffer)
          }
          const offset = options.offset || 0
          const length = options.length || (target.result.length - offset)
          cb(null, buffer.slice(offset, offset + length))
        }
      }
      // })
    }
  }

  put (index: number, chunkBuffer: Buffer, cb: Function) {
    let self = this

    if (!cb) {
      cb = () => {}
    }

    if (chunkBuffer.length !== this.chunkLength) {
      return this.nextTick(cb, new Error('Chunk length must be: ' + this.chunkLength))
    }

    if (!this.db) {
      // Execute listener
      this.eventEmitter.subscribe(_put.bind(this, index, chunkBuffer))
    } else {
      _put()
    }

    function _put () {
      let transaction = self.db.transaction('torrent_chunk_store', 'readwrite')

      transaction.onerror = (event) => {
        // Don't forget to handle errors!
      }

      let request = transaction.objectStore('torrent_chunk_store').put(chunkBuffer, index)

      request.onsuccess = (event) => {
        cb(null, event)
      }

      request.onerror = (err) => {
        cb(err)
      }
    }
  }

  close (cb) {
    if (this.closed) return this.nextTick(cb, new Error('Storage is closed'));
    if (!this.db) return this.nextTick(cb, undefined)
    this.closed = true;
    this.nextTick(cb, null, null);
  }

  destroy (cb) {
    // Currently same implementation as close
    // For indexeddb would be different:
    // -- Close would empty database
    // -- Destroy should delete database
    this.close(cb)
    this.idb.deleteDatabase(this.getDatabaseName())
  }

  nextTick (cb, err, val?) {
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
}
