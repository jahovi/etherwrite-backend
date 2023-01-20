import { LoginData, ScrollEvent } from "../core/tracking-service/coh-interfaces";

/**This is some kind of a hash function that
 * places both input ID´s in lexicographical 
 * order and puts a "#" symbol between them.
 * 
 * @param authorA An author ID
 * @param authorB An author ID
 * @returns A string of the form smallerID#biggerID
 */
export function generateKey(authorA: string, authorB: string) {
	const first = authorA < authorB ? authorA : authorB;
	const second = authorA > authorB ? authorA : authorB;
	return first + "#" + second;
}

/**A helper class that consumes interaction events and
 * will return the number of interactions of each pair 
 * of authors. 
 * This counter distinguishes between the active and the inactive
 * counterparts of an interaction. 
 */
export class IndividualInteractionCounter {
	private authors: string[] = [];
	private counters: Record<string, number> = {};

	/**Will add an interaction event with the associated
	 * value (or default value 1) to the record object of the two
	 * given authors or create such a record object if
	 * there wasn´t one before. 
	 * @param activeAuthor An author ID 
	 * @param passiveAuthor An author ID
	 * @param value (optional) specify a value other than 1
	 */
	public notifyInteraction(activeAuthor: string, passiveAuthor: string, value = 1): void {
		this.register(activeAuthor);
		this.register(passiveAuthor);
		this.counters[activeAuthor + "#" + passiveAuthor] += value;
	}

	/**
	 * Checks if this author was already known. If not,
	 * then record objects for this author with any other 
	 * author will be created. 
	 * @param author 
	 */
	private register(author: string): void {
		if (!this.authors.includes(author)) {
			if (this.authors.length > 0) {
				// Create two Records
				this.authors.forEach(otherAuthor => {
					this.counters[author + "#" + otherAuthor] = 0;
					this.counters[otherAuthor + "#" + author] = 0;
				});
			}
			this.authors.push(author);
		}
	}

	/**
	 * @returns The counters stored in this instance. 
	 */
	public getCounters(): Record<string, number> {
		return this.counters;
	}
}

/**A helper class that consumes interaction events and
 * will return the number of interactions of each pair 
 * of authors. 
 * The counter works strictly cumulative. 
 */
export class CumulatedInteractionCounter {
	private authors: string[] = [];
	private counters: Record<string, number> = {};

	/**
	 * @returns The counters stored in this instance. 
	 */
	public getCounters(): Record<string, number> {
		return this.counters;
	}

	/**Will add an interaction event with the associated
	 * value (or default value 1) to the shared record object of the two
	 * given authors or create such a record object if
	 * there wasn´t one before. Please note that due to
	 * the cumulative nature of this classes´ counter , calling
	 * notifyInteraction("X","Y") has the same effect as
	 * notifyInteraction("Y","X")
	 * 
	 * @param authorA one of the authors involved
	 * @param authorB the other author
	 * @param value (optional) specify a value other than 1
	 */
	public notifyInteraction(authorA: string, authorB: string, value = 1): void {
		this.register(authorA);
		this.register(authorB);
		this.counters[generateKey(authorA, authorB)] += value;
	}

	/**
	 * Checks if this author was already known. If not,
	 * then record objects for this author with any other 
	 * author will be created. 
	 * @param author 
	 */
	private register(author: string): void {
		if (!this.authors.includes(author)) {
			if (this.authors.length > 0) {
				// Create a Record
				this.authors.forEach(otherAuthor => {
					this.counters[generateKey(author, otherAuthor)] = 0;
				});
			}
			this.authors.push(author);
		}
	}
}

/**A helper object that consumes objects that represent the online
 * timespan of users. It will return the amount of milliseconds that 
 * each pair of authors has spent simultaneously in the text editor. 
 */
export class LoginDataHandler {

	private dataSets: LoginData[] = [];
	private scoreCount: Record<string, number> = {};

	public receiveData(data: LoginData[]) {
		data.forEach(newData => {
			if (this.dataSets.length === 0) {
				this.dataSets.push(newData);
			} else {
				this.dataSets.forEach(oldData => {
					if (newData.user !== oldData.user) {
						const maxStart = newData.login > oldData.login ? newData.login : oldData.login;
						const minEnd = newData.logout < oldData.logout ? newData.logout : oldData.logout;
						const sharedTime = minEnd - maxStart;
						if (sharedTime > 0) {
							const key = generateKey(newData.user, oldData.user);
							if (!(key in this.scoreCount)) {
								this.scoreCount[key] = 0;
							}
							this.scoreCount[key] += sharedTime;
						}
					}
				});
				this.dataSets.push(newData);
			}
		});
	}

	public getScores() {
		return this.scoreCount;
	}

}

/**
 * A helper class that stores and processes ScrollEvents. 
 * It will return these ScrollEvents after it has made
 * sure that these ScrollEvents fulfill the condition
 * that no other ScrollEvent from the same user was emitted
 * within the timespan defined in the scrollEventCoolDownPeriod
 * attribute. 
 */
export class ScrollEventHandler {

	private readonly scrollEventCoolDownPeriod;

	private readonly queue: ScrollEvent[] = [];
	private readonly nextDelivery: ScrollEvent [] = [];

	constructor(coolDown: number){
		this.scrollEventCoolDownPeriod = coolDown;
	}

	/**
	 * Use this method to hand over new scroll events
	 * to the ScrollEventHandler. 
	 * @param scrollEvents 
	 */
	public receiveData(scrollEvents: ScrollEvent[]) {
		scrollEvents.forEach(event => {
			this.queue.push(event);
		});
		this.queue.sort((x1, x2) => x1.timestamp - x2.timestamp);
	}

	/**
	 * This method will return the oldest unprocessed ScrollEvent 
	 * if it fulfills the condition that no other ScrollEvent from
	 * the same user happened less than the given cooldown timespan
	 * after it. 
	 * This method should only be called after a previous call of the
	 * getNextTimestamp() method returned a non-negative result.  
	 * @returns a ScrollEvent or undefined.  
	 */
	public getNext(): ScrollEvent | undefined {
		this.updateDeliveryCandidate();
		return this.nextDelivery.shift();
	}

	/**
	 * This method returns the timestamp of the oldest unprocessed
	 * ScrollEvent or -1 if there is currently no such ScrollEvent
	 * available. 
	 * @returns a timestamp number or -1
	 */
	public getNextTimestamp(): number {
		this.updateDeliveryCandidate();
		if (this.nextDelivery[0]) {
			return this.nextDelivery[0].timestamp;
		} else
			return -1;
	}

	/**
	 * This method makes sure that the nextDelivery list
	 * is filled with a ScrollEvent that fulfills the given
	 * condition, if such a ScrollEvent is currently available. 
	 */
	private updateDeliveryCandidate(): void {
		const candidate = this.queue[0];
		if(!candidate || this.nextDelivery.length > 0){
			return;
		}

		for(let i = 1; i < this.queue.length;i++){
			const nextEvent = this.queue[i];
			// The queue is sorted by ascending timestamps
			// Therefore the later elements in the queue are
			// being compared to the first element
			if (nextEvent.user == candidate.user && candidate.timestamp + this.scrollEventCoolDownPeriod > nextEvent.timestamp){
				// There is another event from this user that came
				// less than the required timespan after the current
				// event. Therefore the current candidate event will be dropped.
				this.queue.shift();
				// Testing the next candidate
				this.updateDeliveryCandidate();
				return;
			}
		}

		// If the candidate is older than the given cooldown period
		// then we can be sure that there are no other scroll events
		// that could invalidate this scroll event. 
		if(candidate.timestamp + this.scrollEventCoolDownPeriod < Date.now()){
			this.nextDelivery.push(this.queue.shift() as ScrollEvent);
		}

	}
}