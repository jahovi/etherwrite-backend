import AbstractChangesetSubscriber from "../core/changeset-service/abstract-changeset-subscriber";
import Changeset, {Op} from "../changeset/Changeset";
import CSRaw from "../core/changeset-service/csraw.interface";
import {EtherVizColumn, EtherVizColumnItem} from "./etherviz-interfaces";
import AuthorRegistry from "../core/authors/author-registry";
import EtherVizList, {EtherVizMeta} from "./etherviz-list";
import {BasicListNode} from "../core/changeset-service/basic-list";

export default class EtherVizService extends AbstractChangesetSubscriber {

	/**Setting this to 'true' lowers the 'stablePeriod' from one
	 * hour to one minute and causes some console.log() debug output
	 * (see the dataSourceCallback method for details)
	 *
	 * Affects the timeStampToDate Method too.
	 */
	private static debugOutput = true;
	public static instances: Record<string, EtherVizService> = {};

	/** milliseconds - the time that has to pass without new changesets
	before a timestamp is eligible as starting point for new status block  */
	private static stablePeriod = EtherVizService.debugOutput ? 60000 : 3600000; // one minute or one hour

	/**Contains the linked list that is evaluated at the
	 * chosen stable timestamp moments.
	 */
	private list: EtherVizList;

	/*Contains the chosen timestamps in ascending order*/
	private stableTimestamps: number[] = []

	/* Forces the reduction of starting points for new status blocks */
	private maxTimeStamps = Number(process.env.ETHERVIZ_MAX_STATUS_BLOCKS) || 12;
	private latestRev = -1;

	private ethervizDataSet: EtherVizColumn[] = []
	private dataSetTimeStamp = 0;
	private updateDelay = 60000;

	constructor(padName: string) {
		super(padName);
		this.list = new EtherVizList();
		EtherVizService.instances[padName] = this;
	}

	public getEtherVizDataSet() {
		if (Date.now() > this.dataSetTimeStamp + this.updateDelay) {
			this.buildOutputData();
		}
		return this.ethervizDataSet;
	}

	dataSourceCallback(): void {
		const padHead = this.dataSource.padInfo ? this.dataSource.padInfo?.value.head : 0;
		if (padHead > this.latestRev) {
			this.latestRev = padHead;
			this.findStableTimestamps();
		}
		//debug output
		if (EtherVizService.debugOutput) {
			if (Date.now() > this.dataSetTimeStamp + this.updateDelay) {
				this.buildOutputData();
			}
			console.log("pad: " + this.padName);
			// this.ethervizDataSet.forEach(columnSet => {
			// 	console.log(columnSet.dateTime);
			// 	console.log("rectangles");
			// 	console.log(columnSet.rectangles);
			// 	console.log("parallelograms");
			// 	console.log(columnSet.parallelograms);
			// });
			const d = this.getEtherVizDataSet();
			console.log(d.length);
		}
	}


	/* Searches in the changesets for stable timestamps.
	A timestamp is considered stable when there were no new
	changesets after the current one for at least the timespan
	that is defined in the 'stablePeriod' attribute */
	private findStableTimestamps(): void {
		this.stableTimestamps = [];
		for (let i = 1; i < this.latestRev; i++) {
			const ts1 = this.dataSource.revData[i].timestamp;
			const ts2 = this.dataSource.revData[i + 1].timestamp;
			if (ts2 - ts1 > EtherVizService.stablePeriod) {
				this.stableTimestamps.push(ts1);
			}
		}
		// the very latest status of the pad will always be used
		const latestTimeStamp = this.dataSource.revData[this.latestRev].timestamp;
		if (!this.stableTimestamps.includes(latestTimeStamp)) {
			this.stableTimestamps.push(latestTimeStamp);
		}

		// remove entries as long as maximum is exceeded
		while (this.stableTimestamps.length > this.maxTimeStamps) {
			this.shrinkStableTimestamps();
		}
	}

	/**
	 * Removes an element from stableTimeStamps.
	 * The removed element lies between two other
	 * elements that have the lowest distance between
	 * each other.
	 */
	private shrinkStableTimestamps(): void {
		if (this.stableTimestamps.length < 3) {
			return;
		}
		let minIndex = 1;
		let minDist = this.stableTimestamps[2] - this.stableTimestamps[0];
		for (let i = 1; i < this.stableTimestamps.length - 2; i++) {
			const dist = this.stableTimestamps[i + 2] - this.stableTimestamps[i];
			if (dist < minDist) {
				minIndex = i + 1;
				minDist = dist;
			}
		}
		for (let i = minIndex; i < this.stableTimestamps.length - 1; i++) {
			this.stableTimestamps[i] = this.stableTimestamps[i + 1];
		}
		this.stableTimestamps.pop();

	}

	/**
	 * Generates a date-time string of the format
	 * DD.MM.YYYY hh.mm
	 * @param ts milliseconds since 01-01-1970
	 * @returns a date-time string
	 */
	static timeStampToDateString(ts: number): string {

		const d = new Date(EtherVizService.debugOutput ? ts : ts + EtherVizService.stablePeriod);
		return d.toLocaleString("de");
	}

	/**Generates and updates the linked list.
	 * Must be called every time when new data
	 * has arrived from the database.
	 */
	private buildOutputData(): void {
		// we want to build the list from the newest rev that we haven't processed yet.
		let nextRev = 0;
		this.list.eraseAllNodes();
		this.ethervizDataSet.length = 0;
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

			if (this.stableTimestamps.includes(currentRevData.timestamp)) {

				// The current changeset timestamp has been chosen to be
				// the basis for one of our status blocks
				this.buildStatusBlock(currentRevData);

			}

			// this revs-dataset is finished. Move to the next one...
			nextRev++;
		}
	}

	/** Generates a status block from the current content of
	 * the linked list. Will generate a transitional block too,
	 * if this isn´t the first status block.
	 */
	private buildStatusBlock(currentRevData: { cset: Changeset.Changeset; author: string; timestamp: number; }): void {
		const timeStampIndex = this.stableTimestamps.indexOf(currentRevData.timestamp);

		// create meta tags for this timeStampIndex
		// and a status block
		let index = 0;
		let runner = this.list.head.next;
		let author = this.list.head.next?.author as string;
		let authorRecord = AuthorRegistry.knownAuthors[author];
		let color = authorRecord.color;
		let currentBlock: EtherVizColumnItem = {
			authorId: author,
			authorColor: color,
			upperLeft: 0,
			lowerLeft: -1,
		};
		const list = [];
		while (runner && runner.next) {
			if (runner.author != author) {
				// close block
				list.push(currentBlock);
				// reinitialise
				author = runner.author;
				authorRecord = AuthorRegistry.knownAuthors[author];

				color = authorRecord.color;
				currentBlock = {
					authorId: author,
					authorColor: color,
					upperLeft: index,
					lowerLeft: index,
				};
			} else {
				currentBlock.lowerLeft++;
			}
			runner.meta[timeStampIndex] = index;
			runner = runner.next;
			index++;
		}
		// close final block
		currentBlock.lowerLeft = --index;
		list.push(currentBlock);

		const dateString = EtherVizService.timeStampToDateString(currentRevData.timestamp);
		const entry: EtherVizColumn = {dateTime: dateString, rectangles: list};

		this.ethervizDataSet.push(entry);

		// create transitional block
		if (timeStampIndex > 0) {
			// collect nodes that appear in both status blocks
			let runner = this.list.head.next as BasicListNode<EtherVizMeta>;
			const commonNodes: typeof runner[] = [];
			while (runner && runner.next) {
				if (timeStampIndex in runner.meta && (timeStampIndex - 1) in runner.meta) {
					commonNodes.push(runner);
				}
				runner = runner.next;
			}

			if (commonNodes.length > 0) {
				// prepare first element of parallelograms list
				const nodeZero = commonNodes[0] as BasicListNode<EtherVizMeta>;
				let author = nodeZero.author;
				let authorRecord = AuthorRegistry.knownAuthors[author];
				let color = authorRecord.color;
				let currentBlock: EtherVizColumnItem = {
					authorId: author,
					authorColor: color,
					upperLeft: nodeZero.meta[timeStampIndex - 1],
					lowerLeft: nodeZero.meta[timeStampIndex - 1],
					upperRight: nodeZero.meta[timeStampIndex],
					lowerRight: nodeZero.meta[timeStampIndex],
				};
				const parallelograms: EtherVizColumnItem[] = []

				// The offset describes the difference in the position of the
				// current character in the text in the previous status block
				// compared to the current status block.
				// If following characters share the same offset, they will be treated
				// as being a part of the same parallelogram
				let offset = currentBlock.upperLeft - (currentBlock.upperRight as number);


				for (let i = 1; i < commonNodes.length; i++) {
					const node = commonNodes[i];
					const nodeLRDiff = (node.meta[timeStampIndex - 1]) - (node.meta[timeStampIndex]);
					if (node && node.author != currentBlock.authorId || nodeLRDiff != offset) {
						// close block because the author has changed and/or
						// the offset has changed
						parallelograms.push(currentBlock);
						// reinitialise
						author = node.author;
						authorRecord = AuthorRegistry.knownAuthors[author];
						color = authorRecord.color;
						currentBlock = {
							authorId: author,
							authorColor: color,
							upperLeft: node.meta[timeStampIndex - 1],
							lowerLeft: node.meta[timeStampIndex - 1],
							upperRight: node.meta[timeStampIndex],
							lowerRight: node.meta[timeStampIndex],
						}
						offset = currentBlock.upperLeft - (currentBlock.upperRight as number);

					} else {
						currentBlock.lowerLeft++;
						currentBlock.lowerRight = (currentBlock.lowerRight as number) + 1;
					}
				}
				//close final block
				parallelograms.push(currentBlock);
				this.ethervizDataSet[timeStampIndex - 1]["parallelograms"] = parallelograms;
			}
		}
		this.dataSetTimeStamp = Date.now();
	}

	private handleAdd(currentOp: Op, currentRev: number, remainingCharbank: string[]) {
		let author: string; // the etherpad id
		try {
			// trying to find author in attribs
			const authorKey = this.dataSource.extractAuthorKeyFromAttribs(currentOp.attribs);
			author = this.dataSource.getFromNumToAttrib(authorKey, 1);
		} catch (e) {
			// else use author data from revdata
			author = this.dataSource.revData[currentRev].author;
		}
		for (let i = 0; i < currentOp.chars; i++) {
			const char = remainingCharbank.shift();
			this.list.insertAfterCurrentAndMoveCurrent(char as string, author, {});
		}
		return remainingCharbank;
	}

	private handleMove(currentOp: Op) {
		this.list.moveFwd(currentOp.chars);
	}

	private handleRemove(currentOp: Op, currentRev: number) {
		const currentRevData = this.dataSource.revData[currentRev];
		const rawRevData = currentRevData.cset as CSRaw;
		if (rawRevData.newLen == 1) {
			this.list.eraseAllNodes();
		} else {
			for (let i = 0; i < currentOp.chars; i++) {
				this.list.removeAfterCurrent();
			}
		}
	}

}