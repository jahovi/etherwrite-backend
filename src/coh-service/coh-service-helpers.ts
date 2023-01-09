import { LoginData } from "../core/tracking-service/coh-interfaces";
/**
 * Provides a key generating function to its subclasses. 
 */
abstract class CohesionServiceHelper {


	/**This is some kind of a hash function that maps 
	 * each pair of author IDs to a string that is
	 * unique for the two IDs. 
	 * 
	 * @param authorA one of the authors involved
	 * @param authorB the other author
	 * @returns a key string consisting of the lexicographically
	 *  smaller authorID followed by '#' and the ID of the other author
	 */
	protected generateKey(authorA: string, authorB: string) {
		const first = authorA < authorB ? authorA : authorB;
		const second = authorA > authorB ? authorA : authorB;
		return first + "#" + second;
	}
}

/**A helper class that consumes interaction events and
 * will return the number of interactions of each pair 
 * of authors. 
 */
export class InteractionCounter extends CohesionServiceHelper {
	private authors: string[] = [];
	private counters: Record<string, number> = {};

	/**
	 * @returns The counters stored in this instance. 
	 */
	public getCounters():Record<string,number> {
		return this.counters;
	}

	/**Will add an interaction event with the associated
	 * value 1 to the shared record object of the two
	 * given authors or create such a record object if
	 * there wasn´t one before.  
	 * 
	 * @param authorA one of the authors involved
	 * @param authorB the other author
	 * @param value (optional) specify a value other than 1
	 */
	public notifyInteraction(authorA: string, authorB: string, value = 1):void {
		this.register(authorA);
		this.register(authorB);
		this.counters[this.generateKey(authorA, authorB)] += value;
	}

	/**
	 * Checks if this authors was already known. If not,
	 * then record objects for this author with any other 
	 * author will be created. 
	 * @param author 
	 */
	private register(author: string):void {
		if (!this.authors.includes(author)) {
			if (this.authors.length > 0) {
				// Create a Record
				this.authors.forEach(otherAuthor => {
					this.counters[this.generateKey(author, otherAuthor)] = 0;
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
export class LoginDataHandler extends CohesionServiceHelper {

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
							const key = this.generateKey(newData.user, oldData.user);
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