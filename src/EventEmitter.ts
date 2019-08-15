export default class EventEmitter {
  private subscribers: Array<Function> = [];

  subscribe (subscriber) {
    this.subscribers.push(subscriber);
  }

  notify () {
    this.subscribers.forEach((subscriber) => {
      subscriber();
    })
  }
}
