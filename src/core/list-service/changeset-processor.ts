/* eslint-disable no-mixed-spaces-and-tabs */
import Changeset from "../../changeset/Changeset";
import CouchDbService from "../couch/couch-db.service";
import DLList from "./double-linked-list";
import PadInfo from "./padinfo.interface";
import PadRev from "./pad-rev.interface";
import AuthorRegistry from "../../author-registry";
import { MiniMapDataUnit } from "./mini-map-data-unit.type";
import LogService from "../log/log.service";
import logService from "../log/log.service";


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
 *Instances of this class are created by the PadRegistry-class. 
 */
export default class ChangesetProcessor {

	public static readonly instanceRegistry: { [padName: string]: ChangesetProcessor } = {};

	private static blocksUpdateDelay = Number(process.env.CSP_UPDATE_DELAY) || 5000;
	/* milliseconds -- the minimum timespan, before a newer version of
	author-blocks-list is generated*/


	private readonly list: DLList; // the linked list described above
	private listRevStatus = -1; // the number of the newest rev, that has been processed in the list
	private blocks: MiniMapDataUnit[] = []; /* the most recent version of a block list. */

	private docScope = CouchDbService.getConnection("etherpad");
	private padHead?: number; // indicates the newest pad:[name]:revs:[padHead]
	public readonly padName: string; // the name of the etherpad, that this instance provides services for
	private padInfo?: PadInfo; // contains the most recent version of basic information regarding that etherpad
	private initCompleted = false; // internal flag
	private revData: { [key: number]: { cset: Changeset.Changeset, author: string, timestamp: number } } = {};
	// contains all known changsets, that could possibly be retrieved from the database

	public authorKeys: string[] = []; // the keys of authors in the numToAttrib of the pad
	private blankKey = ""; /* contains the attribute key if an anonymous author is used by etherpad
								 to designate a char as colorless  */
	public authorUNDOAnomalyCounter: { [key: string]: number } = {}; /* counter for _possible_ abuse cases per author
																		NOTE: It cannot be determined here whether an 
																		author has actually gained an advantage at the
																		expense of other users. It´s just as possible that
																		the number of characters counted here where already
																		previously his own*/

	public lastActivityTimeStamp:{[key:string]:number} = {};

	private attrToHeadingMapping: { [key: string]: string } = {};




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
	 * Clients are encouraged to continously call for a new list
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
				if (entry[1] != "") {
					if (!this.authorKeys.includes(String(i))) {
						this.authorKeys.push(String(i));
					}
					AuthorRegistry.put(entry[1]);
					if (!this.authorUNDOAnomalyCounter[entry[1]]) {
						this.authorUNDOAnomalyCounter[entry[1]] = 0;
					}
					if(!this.lastActivityTimeStamp[entry[1]]){
						this.lastActivityTimeStamp[entry[1]] = 0;
					}
				}
				else {
					this.blankKey = String(i);
				}
			}
			if (entry[0] == "heading") {
				if (!this.attrToHeadingMapping[String(i)]) {
					this.attrToHeadingMapping[String(i)] = entry[1];
				}
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
			this.lastActivityTimeStamp[currentRevData.author] = currentRevData.timestamp;
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
				case "+": {
					let applyIgnoreColor = false;
					let author: string; // the etherpad id 
					try {
						// trying to find author in attribs
						const authorKey = this.extractAuthorKeyFromAttribs(currentOp.attribs);
						author = this.getFromNumToAttrib(authorKey, 1);
						if (author == "") throw new Error();
					}
					catch {
						// else use author data from revdata
						author = currentRevData.author;

						/* 	We assume that this happened because of an
									UNDO after the deletion of a section, that contained
									characters where the etherpad-lite button "Autorenfarben zurücksetzen"
									was used
								*/
						this.authorUNDOAnomalyCounter[author] += currentOp.chars;
						applyIgnoreColor = true;
					}

					// is equal to "" unless a heading start symbol is set. 
					// otherwise will contain the size, i.e "h1", "h2", "h3" or "h4"
					const headingType = this.extractHeadingKeyFromAttribs(currentOp.attribs);

					for (let i = 0; i < currentOp.chars; i++) {
						const char = newChars[0];
						this.list.insertAfterCurrentAndMoveCurrent(char, author, applyIgnoreColor, headingType);
						newChars = newChars.substring(1, newChars.length);
					}
					break;
				}
				// this op instructs us to move to a certain position
				case "=":

					if (currentOp.attribs) {
						const attrList = this.attribsToList(currentOp.attribs);
						const ignoreColors = this.blankKey != "" && attrList.includes(this.blankKey);
						const headingType = this.extractHeadingKeyFromAttribs(currentOp.attribs);
						// if (this.blankKey && attrList.includes(this.blankKey)) {
						// the 'blank author' is used by etherpad-lite to
						// indicate that the "Autorenfarben zurücksetzen"
						// function was applied
						// this.list.setIgnoreColor(currentOp.chars);
						// ignoreColors=true;
						// }
						for (let i = 0; i < currentOp.chars; i++) {
							this.list.changeAttributesOfNextChar(ignoreColors, headingType);
						}


					} else {
						// normal movement
						this.list.moveFwd(currentOp.chars);
					}
					break;

					// we have to remove a number of chars
				case "-": {
					const rawRevData = currentRevData.cset as unknown as CSRaw;
					if (rawRevData.newLen == 1) {
						this.list.eraseAllNodes();
					} else {
						for (let i = 0; i < currentOp.chars; i++) {
							this.list.removeAfterCurrent();
						}
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
			return [];
		}
		let currentAuthor = this.list.head.next.value.meta.author;
		let blockIgnoreColors = this.list.head.next.value.meta.ignoreColor;

		const outList: MiniMapDataUnit[] = [];
		let counter = 0; // the amount of characters in the current block
		let lineBreaks: number[] = []; // the relative indices of eventually found linebreaks
		let headingStart: number[] = [];
		let headingTypes: { [key: number]: string } = {};
		let runner = this.list.head.next; // pointer, that points to the
		while (runner.next) {
			// stops after the last node before tail

			if (runner.value.meta.author == currentAuthor && runner.value.meta.ignoreColor == blockIgnoreColors) {
				// the author and/or ignoreColor hasn´t changed therefore the
				// current block is not to be closed yet....

				if (runner.value.meta.headingStart) {
					headingStart.push(counter);
					headingTypes[counter] = runner.value.meta.headingStart;
				}

				if (runner.value.content == "\n") {
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
				const completedBlock: MiniMapDataUnit = { author: currentAuthor, blockLength: counter };
				if (blockIgnoreColors)
					completedBlock.ignoreColor = true;
				if (lineBreaks.length) {
					completedBlock.lineBreakIndices = lineBreaks;
				}

				if (headingStart.length) {
					completedBlock.headingStartIndices = headingStart;
					completedBlock.headingTypes = headingTypes;
				}

				outList.push(completedBlock);
				currentAuthor = runner.value.meta.author;
				blockIgnoreColors = runner.value.meta.ignoreColor;
				counter = 1;
				lineBreaks = [];

				headingStart = [];
				headingTypes = {};
				if (runner.value.content == "\n") {
					// case: the first character of this
					// new block is a linebreak
					lineBreaks.push(0);
				}
				if (runner.value.meta.headingStart) {
					// first character is a heading start
					headingStart.push(counter);
					headingTypes[counter] = runner.value.meta.headingStart;
				}
			}
			runner = runner.next;
		}

		// need to close the final block. The tail is never part of any block.
		const completedBlock: MiniMapDataUnit = { author: currentAuthor, blockLength: counter };
		if (blockIgnoreColors)
			completedBlock.ignoreColor = true;
		if (lineBreaks.length) {
			completedBlock.lineBreakIndices = lineBreaks;
		}

		if (headingStart.length) {
			completedBlock.headingStartIndices = headingStart;
			completedBlock.headingTypes = headingTypes;
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
		for (let i = this.listRevStatus + 1; i <= (this.padHead ? this.padHead : 0); i++) {
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
		this.revData[revNumber] = { cset: cs, author: revData.value.meta.author, timestamp: revData.value.meta.timestamp };
	}


	/**
	 * @returns the text of the pad as it is recorded in the linked list
	 */
	public getTextFromList(): string {
		return this.list.toString();
	}

	/**
	 * For debugging purposes only.
	 * Colorless characters are replaced by '@'
	 * @returns the text with colorless characters marked
	 */
	public getIgnoreColorText(): string {
		return this.list.getIgnoreColorText();
	}

	public getHeadingTestText(): string {
		return this.list.getHeadingTestText();
	}

	/**For debugging purposes.
	 *
	 */
	public clearList() {
		this.list.eraseAllNodes();
	}

	/**Transforms the attribs string from
	 * an op into a list
	 * @param attribs 
	 * @returns a list of attributes
	 */
	private attribsToList(attribs: string): string[] {
		return attribs.substring(1, attribs.length).split("*");
	}

	/**
	 * 
	 * @param attribs the attribs string from an op
	 * @returns the id of the first author attribute found, excluding the blank author.
	 * @throws error, if no author is found
	 */
	public extractAuthorKeyFromAttribs(attribs: string): string {
		if (attribs == "") throw new Error("no author attrib");
		let out = "";
		this.attribsToList(attribs).forEach(entry => {
			if (this.authorKeys.includes(entry) && out == "") {
				out = entry;
			}
		});
		if (out == "")
			throw new Error("no author attrib");
		return out;
	}

	private extractHeadingKeyFromAttribs(attribs: string): string {
		let out = "";
		this.attribsToList(attribs).forEach(entry => {
			if (this.attrToHeadingMapping[entry])
				out = this.attrToHeadingMapping[entry];
		})
		return out;
	}

	/**Allows convenient access to the numToAttrib
	 * section of padInfo
	 * 
	 * @param key 
	 * @param index 
	 * @returns data
	 */
	public getFromNumToAttrib(key: string, index: number) {
		if (this.padInfo) {
			const attrs = this.padInfo.value.pool.numToAttrib;
			const entry = attrs[key];
			return entry[index];
		}
		logService.warn(ChangesetProcessor.name + " " + this.padName, "padInfo not initialised");
		return "";
	}

	/**For debugging
	 * 
	 * @returns 
	 */
	public getAuthorAttribMapping() {
		const out = [];
		if (this.padInfo)
			for (const key in this.authorKeys) {
				const data = { [key]: this.padInfo.value.pool.numToAttrib[key] };
				out.push(data);

			}
		return out;
	}

}