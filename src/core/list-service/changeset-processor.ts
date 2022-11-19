/* eslint-disable no-mixed-spaces-and-tabs */
import Changeset from "../../changeset/Changeset";
import CouchDbService from "../couch/couch-db.service";
import DLList from "./double-linked-list";
import PadInfo from "./padinfo.interface";
import PadRev from "./pad-rev.interface";
import AuthorRegistry from "../../author-registry";
import {MiniMapDataUnit} from "./mini-map-data-unit.type";
import LogService from "../log/log.service";


/**
 *A Service that evaluates the changesets regarding a given etherpad
 *and generates a linked list. Each node of the linked list contains
 *precisely one character of the etherpad text content. Additionally
 *each node carries meta information corresponding to the character,
 *that is saved with it. Currently the meta information only includes
 *the author information. Future versions will most likely include
 *the timestamp as well.
 *
 *This linked list provides the opportunity to efficiently generate
 *data structures in a shape that fits the needs of the frontend use
 *cases, such as the minimap and other dashboard charts, that require
 *information especially regarding the quantity of author contributions.
 */
export default class ChangesetProcessor {

	public static readonly instanceRegistry: { [padName: string]: ChangesetProcessor } = {};

	private static blocksUpdateDelay = Number(process.env.CSP_UPDATE_DELAY) || 5000;
	/* milliseconds -- the minimum timespan, before a newer version of
	author-blocks-list is generated*/


	private readonly list: DLList; // the linked list described above
	private listRevStatus = -1; // the number of the newest rev, that has been processed in the list
	private blocks: MiniMapDataUnit[] = []; /* the most recent version of a block list. */

	private blocksUpdateTimeStamp = 0; // the timestamp of aforementioned block list

	private docScope = CouchDbService.getConnection("etherpad");
	private padHead?: number; // indicates the newest pad:[name]:revs:[padHead]
	public readonly padName: string; // the name of the etherpad, that this instance provides services for
	private padInfo?: PadInfo; // contains the most recent version of basic information regarding that etherpad
	private initCompleted = false; // internal flag
	private revData: { [key: number]: { cset: Changeset.Changeset, author: string, timestamp: number } } = {};

	// contains all known changsets, that could possibly be retrieved from the database


	/**
	 * @param padName the name of the etherpad that this instance will provide services for
	 */
	public constructor(padName: string) {
		this.padName = padName;
		this.list = new DLList();
		ChangesetProcessor.instanceRegistry[padName] = this;
		this.initialise();
	}

	/**
	 * @returns the newest block list currently available
	 *
	 * Each call of this method potentially triggers the creation
	 * of a newer version of the block list, if a given minimum
	 * amount of time has passed since the current block list has
	 * been created.
	 *
	 * Clients are encouraged to continously call this method
	 * every 3 to 5 seconds.
	 */
	public getAuthorBlockList(): MiniMapDataUnit[] {
		return this.blocks;
	}

	/**Call this only after the timespan set in
	 * the 'blocksUpdateDelay' attribute has passed.
	 *
	 * This will cause requests for new information
	 * from the database and then build an expansion
	 * of the linked list.
	 */
	private async prepareUpdate() {
		this.blocksUpdateTimeStamp = Date.now();
		// has head attribute in database changed?
		await this.checkNewInfoInDataBase();

		if (!this.initCompleted) {
			LogService.warn(ChangesetProcessor.name, `${this.padName}: make sure init has completed`);
			return;
		}
		await this.getRevs();
		await this.buildList();
		this.blocks = this.getBlocks();
	}

	/**Checks the 'root-document' of our database for
	 * new infos regarding updates in the text and
	 * new author data.
	 *
	 * The AuthorRegistry will be triggered
	 * by this method to look for updated
	 * info regarding the authors in this pad in the
	 * database.
	 */
	private async checkNewInfoInDataBase() {
		const padInfo = await this.docScope.get("pad:" + this.padName);
		this.padInfo = padInfo as PadInfo;
		this.padHead = this.padInfo.value.head;
		for (let i = 0; i < this.padInfo.value.pool.nextNum; i++) {
			const entry = this.padInfo.value.pool.numToAttrib[String(i)];
			if (entry[0] == "author") {
				AuthorRegistry.put(entry[1]);
			}
		}
	}

	/**Only called once in the constructor.
	 */
	private async initialise() {
		await this.checkNewInfoInDataBase();
		this.initCompleted = true;
		await this.getRevs();
		await this.buildList();
		this.blocks = this.getBlocks();
		setInterval(() =>
			this.prepareUpdate(), ChangesetProcessor.blocksUpdateDelay);
	}

	/**Generates and updates the linked list.
	 * Must be called every time when new data
	 * has arrived from the database.
	 */
	private async buildList() {
		// init must have completed
		type CSRaw = { oldLen: number, newLen: number, ops: string, charBank: string };

		// this type matches the output of the Changeset package below
		type Op = { opcode: string, chars: number, lines: number, attribs: string }

		// we want to build the list from the newest rev that we haven´t processed yet.
		let nextRev = this.listRevStatus + 1;
		while (this.revData[nextRev]) {
			this.list.setToHead();

			// we are going through all new revs that we previously pulled from the database
			const currentRevData = this.revData[nextRev];

			// bring the data in a more comfortable shape.
			// ops may contain zero or more operations
			const ops = Changeset.deserializeOps(currentRevData.cset.ops);

			// pick up the first operation in ops
			let op = ops.next();

			// each op that inserts or removes something usually
			// is preceded by an op to move to a certain position
			// in the list.

			// charBank contains the characters to be inserted (if any)
			let newChars = currentRevData.cset.charBank;

			while (op.value) {
				// op.value contains something, therefore we are evaluating it
				const currentOp = op.value as Op;
				switch (currentOp.opcode) {

				// we need to insert one or more characters
				case "+":
					// only one character per list node
					// so we may have to split the string data
					while (newChars.length > 0) {
						const char = newChars[0];
						const author = currentRevData.author ? currentRevData.author : "--no author info provided--"
						this.list.insertAfterCurrentAndMoveCurrent(char, author);
						newChars = newChars.substring(1, newChars.length);
					}
					break;

					// this op instructs us to move to a certain position
				case "=":
					// the number of steps we are ordered to move
					// is stored in the .chars attribute
					this.list.moveFwd(currentOp.chars);
					break;

					// we have to remove a number of chars
				case "-":

					// eslint-disable-next-line no-case-declarations
					const rawRevData = currentRevData.cset as unknown as CSRaw;
					if (rawRevData.newLen == 1) {
						this.list.eraseAllNodes();
					} else {
						for (let i = 0; i < currentOp.chars; i++) {
							this.list.removeAfterCurrent();
						}
					}
					break;
				}
				// let´s look at the next op in this set
				op = ops.next();
			}
			// this revs-dataset is finished. Move to the next one...
			nextRev++;
		}
		/* 	'this.revData[nextRev]' didn´t exist and
			caused the loop to end.
			Therefore the last one before it must be
			placed in the attribute */
		this.listRevStatus = nextRev - 1;
	}

	/**Call this to generate an update
	 * of the 'this.blocks' attribute.
	 *
	 * @returns a block list
	 */
	private getBlocks(): MiniMapDataUnit[] {

		if (!this.list.head.next || this.list.head.next == this.list.tail) {
			// can normally never happen
			// but typescript wants this checked
			return [];
		}
		let currentAuthor = this.list.head.next.value.meta.author;

		const outList: MiniMapDataUnit[] = [];
		let counter = 0; // the amount of characters in the current block
		let lineBreaks: number[] = []; // the relative indices of eventually found linebreaks
		let runner = this.list.head.next; // pointer, that points to the
		while (runner.next && runner != this.list.tail) {
			// stops at the last node before tail

			if (runner.value.meta.author == currentAuthor) {
				// the author hasn´t changed therefore the
				// current block is not to be closed yet....

				if (runner.value.content == "\n") {
					// we found a linebreak, put the index in the list
					lineBreaks.push(counter);
				}

				counter++;

			} else {
				/* We are encountering a different author.
				So we have to save the data we gathered regarding
				the previous block to the list and reinitialise
				our variables.
				*/
				const completedBlock: MiniMapDataUnit = {author: currentAuthor, blockLength: counter};
				if (lineBreaks.length) {
					completedBlock.lineBreakIndices = lineBreaks;
				}
				outList.push(completedBlock);
				currentAuthor = runner.value.meta.author;
				counter = 1;
				lineBreaks = [];
				if (runner.value.content == "\n") {
					// case: the first character of this
					// new block is a linebreak
					lineBreaks.push(0);
				}
			}
			runner = runner.next;
		}

		// need to close the final block. The tail is never part of any block.
		const completedBlock: MiniMapDataUnit = {author: currentAuthor, blockLength: counter};
		if (lineBreaks.length) {
			completedBlock.lineBreakIndices = lineBreaks;
		}
		outList.push(completedBlock);

		return outList;
	}

	/**This will take care so that all new revs
	 * we haven´t loaded from the database yet
	 * will be retrieved and saved to
	 * 'this.revData' under their index number as key.
	 */
	private async getRevs() {
		const promises: Promise<void>[] = [];
		for (let i = (this.listRevStatus + 1) ? this.listRevStatus + 1 : 0; i <= (this.padHead ? this.padHead : 0); i++) {
			promises.push(this.getRev(i));
		}

		await Promise.all(promises);
	}

	/**This method is only internally called
	 * by the 'getRevs()' method.
	 *
	 * @param revNumber
	 */
	private async getRev(revNumber: number) {
		const data = await this.docScope?.get("pad:" + this.padName + ":revs:" + revNumber);
		const revData = data as PadRev;
		const cs = Changeset.unpack(revData.value.changeset);
		this.revData[revNumber] = {cset: cs, author: revData.value.meta.author, timestamp: revData.value.meta.timestamp};
	}


	/**
	 * @returns the text of the pad as it is recorded in the linked list
	 */
	public getTextFromList(): string {
		return this.list.toString();
	}

	/**For debugging purposes.
	 *
	 */
	public clearList() {
		this.list.eraseAllNodes();
	}

}