import ListNode from "./list-node";

/**An instance of this class provides a 
 * double linked list with methods that 
 * support the purposes of the changeset
 * processor class. 
 */
export default class DLList {
	public readonly head: ListNode;
	public readonly tail: ListNode; // the last element in the list

	/**'current' is a special pointer that supports 
	 * the list building in the changeset processor 
	 * class. 
	 * Please avoid using it for any other 
	 * purpose, especially if you just want to perform
	 * read operations in the list, just use a local 
	 * pointer variable instead. 
	*/
	public current: ListNode;

	/**Creates a instance. Automatically 
	 * creates a head element, that carries
	 * no information but supports the
	 * structural integrity. A tail element
	 * is created too. It carries the initial
	 * linebreak. 
	 */
	public constructor() {
		this.head = new ListNode("", "");
		this.current = this.head;
		this.tail = new ListNode("\n", "");
		this.head.next = this.tail;
		this.head.prev = undefined;
		this.tail.prev = this.head;
		this.tail.next = undefined;
	}

	/**Move the 'current' pointer the given number of 'steps' 
	 * forward, counting from the current element. Make sure
	 * you are aware where the current-pointer is set to 
	 * before calling. 
	 * @param steps a non negative integer
	 * @throws an error if you try to iterate beyond the tail of the list
	 */
	public moveFwd(steps: number) {
		for (let i = 0; i < steps; i++) {
			if (this.current.next)
				this.current = this.current.next;
			else {
				throw new Error("cannot move further forward");
			}
		}
	}

	/** Set the current pointer to the head of the list. 
	 */
	public setToHead() {
		this.current = this.head;
	}

	/**Removes the element, that comes next after element the 'current' pointer 
	 * points at. 
	 * @throws an error if you try to remove the head element. 
	 */
	public removeAfterCurrent(): void {
		if (this.current.next) {
			if (!this.current.next.next) {
				// i.e --> this.current.next must be this.tail
				throw new Error("cannot remove the tail element");
			} else {
				// current.next can neither be head nor tail
				const elementToBeRemoved = this.current.next;
				this.current.next = elementToBeRemoved.next;
				if (elementToBeRemoved.next)
					elementToBeRemoved.next.prev = this.current;
				elementToBeRemoved.next = undefined;
				elementToBeRemoved.prev = undefined;
				// reset the 'current' pointer in case that another deletion is required
				// if(this.current.prev)
				// 	this.current = this.current.prev;
			}
		}
	}

	/**Inserts a string after the element with the 'current' 
	 * pointer and moves the current pointer to the newly 
	 * inserted element. 
	 * 
	 * @param val a string of length 1 
	 * @param author the id of the author
	 */
	public insertAfterCurrentAndMoveCurrent(val: string, author: string, ignoreColor: boolean, headingType:string): void {
		this.insertAfterCurrent(val, author, ignoreColor, headingType);
		if (this.current.next)
			this.current = this.current.next;
	}

	/**Inserts a string after the element with the 'current' 
	 * pointer. The current pointer does not change!
	 * 
	 * @param val a string of length 1 
	 * @param author the id of the author
	 */
	public insertAfterCurrent(val: string, author: string, ignoreColor: boolean, headingType:string): void {
		if (val.length != 1) {
			throw new Error("only one char allowed");
		}
		if (author.length < 1) {

			throw new Error("must specify author name");
		}
		if (this.current == this.tail) {
			throw new Error("cannot insert after tail element");
		}
		const newNode = new ListNode(val, author);
		if(ignoreColor)
			newNode.value.meta.ignoreColor=true;
		if(headingType)
			newNode.value.meta.headingStart=headingType;
		
		
		const formerNext = this.current.next;
		if (formerNext) {
			// we are not at the tail of the list
			this.current.next = newNode;
			newNode.prev = this.current;
			newNode.next = formerNext;
			formerNext.prev = newNode;
		}
	}

	/**Deletes all nodes except head and tail. 
	 * 
	 */
	public eraseAllNodes(): void {
		this.setToHead();
		while (this.head.next && this.head.next != this.tail) {
			this.removeAfterCurrent();
		}
	}

	/**
	 * Sets a number of nodes after 'current'
	 * to ignoreColor=true
	 * 
	 * @param steps - the number of affected nodes
	 */
	public setIgnoreColor(steps: number) {
		for (let i = 0; i < steps; i++) {
			this.moveFwd(1);
			this.current.value.meta.ignoreColor = true;
		}
	}

	public changeAttributesOfNextChar(ignoreColor: boolean, headingType:string) {
		this.moveFwd(1);
		if(ignoreColor)
			this.current.value.meta.ignoreColor = ignoreColor;
		if(headingType)
			this.current.value.meta.headingStart = headingType;
	}


	/**Position after head, head is 0.
	 * May be useful for debugging. 
	 */
	public getNodePos(): number {
		let runner = this.head.next;
		let count = 0;
		while (runner != this.tail) {
			count++;
			runner = runner?.next;
		}
		return count;
	}

	/**Mainly for testing. Should be identical to the text of the etherpad. 
	 * @returns the string content of the list put together.
	 */
	public toString(): string {
		let output = "";
		let runner = this.head;
		while (runner.next) {
			output += runner.value.content;
			runner = runner.next;
		}
		output += this.tail.value.content;
		return output;
	}

	/**
	 * Helps testing the ignoreColor feature
	 * All characters that are set to ignore color
	 * are replaced by '@'
	 * @returns the text as described
	 */
	public getIgnoreColorText(): string {
		let output = "";
		let runner = this.head;
		while (runner.next) {
			output += runner.value.meta.ignoreColor ? "@" : runner.value.content;
			runner = runner.next;
		}
		output += this.tail.value.content;
		return output;
	}

	public getHeadingTestText():string {
		let output = "";
		let runner = this.head;
		while (runner.next) {
			output += runner.value.meta.headingStart ? "#"+runner.value.meta.headingStart+"#" : runner.value.content;
			runner = runner.next;
		}
		output += this.tail.value.content;
		return output;
	}

}