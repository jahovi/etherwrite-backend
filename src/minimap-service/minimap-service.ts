import CSRaw from "../core/changeset-service/csraw.interface";
import {MiniMapDataUnit} from "./mini-map-data-unit.type";
import MinimapList from "./minimap-list";
import Changeset, {Op} from "../changeset/Changeset";
import AbstractChangesetSubscriber from "../core/changeset-service/abstract-changeset-subscriber";

export default class MinimapService extends AbstractChangesetSubscriber<MiniMapDataUnit[]> {
	/**
	 * Allows access to instances of this class, for example
	 * when a router wants to pass the generated data to the frontend.
	 */
	public static instances: Record<string, MinimapService> = {};
	/**
	 * Contains the data  meant to be sent to the minimap.
	 */
	public minimapBlocklist: MiniMapDataUnit[] = [];
	private list: MinimapList;
	private listRevStatus = -1;
	private authorCount = 0;

	/**
	 * counter for _possible_ abuse cases per author
	 * NOTE: It cannot be determined here whether an
	 * author has actually gained an advantage at the
	 * expense of other users. It´s just as possible that
	 * the number of characters counted here where already
	 * previously his own
	 */
	public authorUNDOAnomalyCounter: Record<string, number> = {};


	constructor(padName: string) {
		super(padName);
		this.list = new MinimapList();
		MinimapService.instances[padName] = this;
	}

	/**
	 * Returns the data that subscribers should receive.
	 */
	public getSubjectData(): MiniMapDataUnit[] {
		return this.minimapBlocklist;
	}

	dataSourceCallback(): void {
		this.buildList();
		this.minimapBlocklist = this.createBlocks();
		if (this.dataSource.authorKeys.length > this.authorCount) {
			this.dataSource.authorKeys.forEach(key => {
				const authorId = this.dataSource.attrToAuthorMapping[key];
				if (!this.authorUNDOAnomalyCounter[authorId]) {
					this.authorUNDOAnomalyCounter[authorId] = 0;
				}
			})
		}
		this.notifySubscribers();
	}


	/**Generates and updates the linked list.
	 * Must be called every time when new data
	 * has arrived from the database.
	 */
	private buildList(): void {
		// init must have completed

		// this type matches the output of the Changeset package below

		// we want to build the list from the newest rev that we haven't processed yet.
		let nextRev = this.listRevStatus + 1;
		while (this.dataSource.revData[nextRev]) {
			this.list.setToHead();
			// we are going through all new revs that we previously pulled from the database
			const currentRevData = this.dataSource.revData[nextRev];
			// bring the data in a more comfortable shape.
			// ops may contain zero or more operations
			const ops: Generator<Op> = Changeset.deserializeOps(currentRevData.cset.ops);

			// pick up the first operation in ops
			let op = ops.next();

			// each op that inserts or removes something usually
			// is preceded by an op to move to a certain position
			// in the list.

			// charBank contains the characters to be inserted (if any)
			let newChars = currentRevData.cset.charBank.split("");

			while (op.value) {
				// op.value contains something, therefore we are evaluating it
				const currentOp = op.value;
				switch (currentOp.opcode) {

				// we need to insert one or more characters
				case "+":
					newChars = this.handleAdd(currentOp, nextRev, newChars);
					break;

					// this op instructs us to move to a certain position
				case "=":
					this.handleMove(currentOp);
					break;

					// we have to remove a number of chars
				case "-":
					this.handleRemove(currentOp, nextRev);
					break;
				}
				// let´s look at the next op in this set
				op = ops.next();
			}
			// this revs-dataset is finished. Move to the next one...
			nextRev++;
		}
		/* 	'this.revData[nextRev]' didn't exist and
				caused the loop to end,
				therefore the last one before it must be
				placed in the attribute */
		this.listRevStatus = nextRev - 1;
	}

	private handleAdd(currentOp: Op, currentRev: number, remainingCharbank: string[]) {
		let applyIgnoreColor = false;
		let author: string; // the etherpad id
		try {
			// trying to find author in attribs
			const authorKey = this.dataSource.extractAuthorKeyFromAttribs(currentOp.attribs);
			author = this.dataSource.getFromNumToAttrib(authorKey, 1);
		} catch (e) {
			// else use author data from revdata
			author = this.dataSource.revData[currentRev].author;

			//We assume that this happened because of an
			//UNDO after the deletion of a section, that contained
			//characters where the etherpad-lite button "Autorenfarben zurücksetzen"
			//was used

			this.authorUNDOAnomalyCounter[author] += currentOp.chars;
			applyIgnoreColor = true;
		}

		// is equal to "" unless a heading start symbol is set.
		// otherwise will contain the size, i.e "h1", "h2", "h3" or "h4"
		const headingType = this.dataSource.extractHeadingKeyFromAttribs(currentOp.attribs);

		for (let i = 0; i < currentOp.chars; i++) {
			const char = remainingCharbank.shift();
			this.list.insertAfterCurrentAndMoveCurrent(char as string, author, {ignoreColor: applyIgnoreColor, headingStart: headingType});
			// remainingCharbank = remainingCharbank.substring(1, remainingCharbank.length);
		}
		return remainingCharbank;
	}

	private handleMove(currentOp: Op) {
		if (currentOp.attribs) {
			const attrList = this.dataSource.attribsToList(currentOp.attribs);
			const ignoreColors = this.dataSource.blankKey != "" && attrList.includes(this.dataSource.blankKey);
			const headingType = this.dataSource.extractHeadingKeyFromAttribs(currentOp.attribs);
			// the 'blank author' is used by etherpad-lite to
			// indicate that the "Autorenfarben zurücksetzen"
			// function was applied
			for (let i = 0; i < currentOp.chars; i++) {
				this.list.changeAttributesOfNextChar({ignoreColor: ignoreColors, headingStart: headingType});
			}
		} else {
			// normal movement
			this.list.moveFwd(currentOp.chars);
		}
	}

	private handleRemove(currentOp: Op, currentRev: number) {
		const currentRevData = this.dataSource.revData[currentRev];
		const rawRevData = currentRevData.cset as unknown as CSRaw;
		if (rawRevData.newLen == 1) {
			this.list.eraseAllNodes();
		} else {
			for (let i = 0; i < currentOp.chars; i++) {
				this.list.removeAfterCurrent();
			}
		}
	}


	/**
	 * @returns the newest block list currently available
	 *
	 * Each call of this method potentially triggers the creation
	 * of a newer version of the block list, if a given minimum
	 * amount of time has passed since the current block list has
	 * been created.
	 *
	 * Clients are encouraged to continuously call for a new list
	 * every 3 to 5 seconds.
	 */

	/**Call this to generate an update
	 * of the 'this.blocks' attribute.
	 *
	 * @returns a block list
	 */
	private createBlocks(): MiniMapDataUnit[] {

		if (!this.list.head.next || this.list.head.next == this.list.tail) {
			return [];
		}
		let currentAuthor = this.list.head.next.author;
		let blockIgnoreColors = this.list.head.next.meta.ignoreColor;

		const outList: MiniMapDataUnit[] = [];
		let counter = 0; // the amount of characters in the current block
		let lineBreaks: number[] = []; // the relative indices of eventually found linebreaks
		let headingStart: number[] = [];
		let headingTypes: Record<number, string> = {};
		let runner = this.list.head.next;
		while (runner.next) {
			// stops after the last node before tail

			if (runner.author == currentAuthor && runner.meta.ignoreColor == blockIgnoreColors) {
				// the author and/or ignoreColor hasn't changed therefore the
				// current block is not to be closed yet....

				if (runner.meta.headingStart) {
					headingStart.push(counter);
					headingTypes[counter] = runner.meta.headingStart;
				}

				if (runner.content === "\n") {
					// we found a linebreak, put the index in the list
					lineBreaks.push(counter);
				}
				counter++;
			} else {
				/* We are encountering a different author and/or a change
				in the colorIgnore setting.
				So we have to save the data we gathered regarding
				the previous block to the list and reinitialise
				our variables.
				*/
				const completedBlock: MiniMapDataUnit = {author: currentAuthor, blockLength: counter};
				this.setBlockParameters(completedBlock, blockIgnoreColors, lineBreaks, headingStart, headingTypes);
				outList.push(completedBlock);
				currentAuthor = runner.author;
				blockIgnoreColors = runner.meta.ignoreColor;
				counter = 1;
				lineBreaks = [];

				headingStart = [];
				headingTypes = {};
				if (runner.content == "\n") {
					// case: the first character of this
					// new block is a linebreak
					lineBreaks.push(0);
				}
				if (runner.meta.headingStart) {
					// first character is a heading start
					headingStart.push(0);
					headingTypes[0] = runner.meta.headingStart;
				}
			}
			runner = runner.next;
		}

		// need to close the final block. The tail is never part of any block.
		const completedBlock: MiniMapDataUnit = {author: currentAuthor, blockLength: counter};
		this.setBlockParameters(completedBlock, blockIgnoreColors, lineBreaks, headingStart, headingTypes);
		outList.push(completedBlock);
		return outList;
	}

	/**
	 * Sets the parameters of a given block based on the data.
	 * @param block The block to set parameters of.
	 * @param blockIgnoreColors Determines if colors should be ignored.
	 * @param lineBreaks The tracked line breaks.
	 * @param headingStart The tracked headings.
	 * @param headingTypes Types of occurred headings.
	 */
	private setBlockParameters(block: MiniMapDataUnit, blockIgnoreColors: boolean, lineBreaks: number[], headingStart: number[], headingTypes: Record<number, string>): void {
		if (blockIgnoreColors)
			block.ignoreColor = true;
		if (lineBreaks.length) {
			block.lineBreakIndices = lineBreaks;
		}

		if (headingStart.length) {
			block.headingStartIndices = headingStart;
			block.headingTypes = headingTypes;
		}
	}

}