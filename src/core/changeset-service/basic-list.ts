import logService from "../log/log.service";

/**
 * This class may be used directly or by
 * subclassing. Its methods are meant to be used
 * for constructing a linked list that reflects
 * the current text of an etherpad from that
 * pad´s changesets.
 *
 * An example for the general usage can be seen
 * in the MinimapService and MinimapList classes.
 */
export default class BasicList<M> {
	public readonly head: BasicListNode<M>;
	public readonly tail: BasicListNode<M>;
	/**
	 * A special pointer that is used as starting
	 * point for insertion and removal operations.
	 *
	 */
	public current: BasicListNode<M>;

	constructor() {
		// head and tail are created with dummy data
		// tail carries the obligatory linebreak at
		// the end of every pad
		this.head = new BasicListNode("@", "@", {} as M);
		this.tail = new BasicListNode("\n", "@", {} as M);

		this.current = this.head;
		this.head.next = this.tail;
		this.tail.prev = this.head;
	}

	/**Move the 'current' pointer the given number of 'steps'
	 * forward, counting from the current element. Make sure
	 * you are aware where the current-pointer is set to
	 * before calling.
	 * @param steps a non-negative integer
	 * @throws an error if you try to iterate beyond the tail of the list
	 */
	public moveFwd(steps: number): void {
		for (let i = 0; i < steps; i++) {
			if (this.current.next)
				this.current = this.current.next;
			else {
				console.log(this.current, this.head, this.tail);
				throw new Error("cannot move further forward");
			}
		}
	}

	/** Set the current pointer to the head of the list.
	 */
	public setToHead(): void {
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
			}
		}
	}


	/**Inserts a new node to the list on the spot after
	 * the node with the 'current' pointer and advances
	 * the current pointer to the new node.
	 *
	 * @param content - exactly one character
	 * @param author - length >=1
	 * @param meta - the parametrized metadata object
	 */
	public insertAfterCurrentAndMoveCurrent(content: string, author: string, meta: M): void {
		if (this.current == this.tail) {
			throw new Error("cannot insert after tail element");
		}
		const newNode = new BasicListNode(content, author, meta);
		const formerNext = this.current.next;
		if (formerNext) {
			// we are not at the tail of the list
			this.current.next = newNode;
			newNode.prev = this.current;
			newNode.next = formerNext;
			formerNext.prev = newNode;
		}
		// if (this.current.next)
		this.current = newNode;
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

	/**Mainly for testing. Should be identical to the text of the etherpad.
	 * @returns the string content of the list put together.
	 */
	public toString(): string {
		let output = "";
		let runner = this.head;
		while (runner.next) {
			output += runner.content;
			runner = runner.next;
		}
		output += this.tail.content;
		return output;
	}
}

/**
 * Represents the single nodes that the
 * BasicList is made of.
 * The constructors protect these class invariants
 *
 * - Each node has an author
 * - Each node carries exactly one character of the text
 *
 */
export class BasicListNode<M> {
	next?: BasicListNode<M>;
	prev?: BasicListNode<M>;
	readonly meta: M;
	readonly author: string;
	readonly content: string;

	constructor(content: string, author: string, meta: M) {

		if (content.length != 1)
			throw new Error("node content must have length 1");
		if (author.length < 1)
			logService.error(BasicListNode.name, "must specify author");
		this.content = content;
		this.author = author;
		this.meta = meta;
	}
}