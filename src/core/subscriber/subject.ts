/**
 * A Subject is the source of a subscription pattern. It contains data that will be broadcast to all subscribers if changed.
 */
export abstract class Subject<T> {

	protected subscriberCallbacks: Function[] = [];

	/**
	 * This has to be overridden with a method returning the actual data. This is how the Subject knows what to communicate to subscribers.
	 */
	public abstract getSubjectData(): T;

	/**
	 * Call this once on the corresponding subscriber.
	 * @param callback The callback function to execute when new data is found.
	 * @return The initial data, i.e. the current status of the Subject's data.
	 */
	public subscribe(callback: (data?: T) => void): T {
		this.subscriberCallbacks.push(callback);
		return this.getSubjectData();
	}

	/**
	 * Removes the callback function from the subject´s callback list. 
	 * @param callback The callback function to be removed
	 */
	public unsubscribe(callback: Function) {
		for (let i = 0; i < this.subscriberCallbacks.length;i++) {
			if (this.subscriberCallbacks[i] === callback) {
				this.subscriberCallbacks.splice(i,1);
				return;
			}
		}
	}

	/**
	 * Use this when the data of the Subject has changed to notify all subscribers.
	 */
	protected notifySubscribers(): void {
		this.subscriberCallbacks.forEach(call => call(this.getSubjectData()));
	}
}