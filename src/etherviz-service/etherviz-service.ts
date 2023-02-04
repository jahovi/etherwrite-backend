import AbstractChangesetSubscriber from "../core/changeset-service/abstract-changeset-subscriber";
import Changeset, { Op } from "../changeset/Changeset";
import CSRaw from "../core/changeset-service/csraw.interface";
import { EtherVizColumn, EtherVizColumnItem } from "./etherviz-interfaces";
import AuthorRegistry from "../core/authors/author-registry";
import EtherVizList, { EtherVizMeta } from "./etherviz-list";
import { BasicListNode } from "../core/changeset-service/basic-list";
import { DateService } from "../core/util/date.service";

/**
 * This Service will create the data needed for drawing the
 * EtherVizDiagram.
 * There will be a status column (consisting of an array of rectangles)
 * for each day since the creation of the Etherpad. Between each two
 * neighboring status columns there is usually a transitional column
 * (consisting of an array of parallelograms) that indicates from which
 * to which location individual characters from the pad text have moved.
 * The transitional column may be empty if no common characters are present
 * in a pair of neighboring status columns.
 */
export default class EtherVizService extends AbstractChangesetSubscriber<EtherVizColumn[]> {

	public static readonly instances: Record<string, EtherVizService> = {};
	private static readonly debug = process.env.ETHERVIZ_DEBUG === "true";

	private static readonly milSecInDay = 1000 * 60 * 60 * 24;

	/**Contains the linked list that is evaluated at the
	 * chosen stable timestamp moments.
	 */
	private readonly permanentList: EtherVizList;

	/**
	 * Contains the timestamps of the millisecond when a past day has ended.
	 */

	private readonly startOfDayTimestamps: number[] = [];
	/*Contains the chosen timestamps in ascending order*/
	private readonly chosenTimestamps: number[] = [];

	/**
	 * This contains all data up until yesterday.
	 * The status for the current day will be generated and added
	 * dynamically from the most recent pad content,
	 * whenever the method getEtherVizDataSet() is called.
	 */
	private readonly ethervizPermanentDataSet: EtherVizColumn[] = [];

	constructor(padName: string) {
		super(padName);
		this.permanentList = new EtherVizList();
		EtherVizService.instances[padName] = this;
	}

	/**
	 * Returns the data that subscribers should receive.
	 */
	public getSubjectData(): EtherVizColumn[] {
		return this.getEtherVizDataSet();
	}

	/**
	 * Appends to the permanently saved data the data
	 * for the current day and status of the pad content.
	 * @returns The EtherVizColumn [] required for drawing the EtherVizDiagram
	 */
	public getEtherVizDataSet() {
		this.expandPermanentData();
		const outputEtherVizDataSet = JSON.parse(JSON.stringify(this.ethervizPermanentDataSet)) as EtherVizColumn[];
		const listCopy = this.permanentList.copy();

		const newestRev = this.dataSource.padInfo?.value.head as number;
		const latestRevDataTimeStamp = this.dataSource.revData[newestRev].timestamp;
		const startOfCurrentDayTimeStamp = this.getStartOfDayTimestamp(Date.now());

		// Provisionally add these timestamps:
		this.chosenTimestamps.push(latestRevDataTimeStamp);
		this.startOfDayTimestamps.push(startOfCurrentDayTimeStamp);

		this.buildOutputData(listCopy, latestRevDataTimeStamp, outputEtherVizDataSet);


		// Remove the provisional timestamps
		this.chosenTimestamps.pop();
		this.startOfDayTimestamps.pop();

		// Remove entries whose authors are unknown to moodle 
		const aReg = AuthorRegistry.getInstance();
		outputEtherVizDataSet.forEach(column => {
			column.rectangles = column.rectangles.filter(item => aReg.isMoodleUser(item.authorId));
			if("parallelograms" in column){
				column.parallelograms = column.parallelograms?.filter(item => aReg.isMoodleUser(item.authorId));
			}
		})
		return outputEtherVizDataSet;
	}

	dataSourceCallback(): void {
		this.expandPermanentData();

		if (EtherVizService.debug) {
			this.printDebugOutput();
		}
	}

	private printDebugOutput(): void {
		this.getEtherVizDataSet().forEach(columnSet => {
			console.log(columnSet.dateTime);
			console.log("rectangles");
			console.log(columnSet.rectangles);
			console.log("parallelograms");
			console.log(columnSet.parallelograms);
		});
	}


	/**
	 * This methods first builds or expands the startOfDayTimestamps
	 * and chosenTimestamps attributes and then tries to build or expand
	 * the permanentList, from which then the permanentDataSet will be built
	 * or expanded.
	 *
	 */
	private expandPermanentData(): void {
		const creationTimestamp = this.dataSource.revData[0].timestamp;
		const startOfCreationDayTimestamp = this.getStartOfDayTimestamp(creationTimestamp);

		// Build up of permanent list will not happen
		// before the day after the creation of the pad.
		if (Date.now() < startOfCreationDayTimestamp + EtherVizService.milSecInDay) {
			return;
		}
		// Initialise the first element
		if (this.startOfDayTimestamps.length === 0) {
			this.startOfDayTimestamps.push(startOfCreationDayTimestamp);
		}

		// Insert more "start of day" timestamps until yesterday
		let latestTimestamp = this.startOfDayTimestamps[this.startOfDayTimestamps.length - 1];
		while (Date.now() > latestTimestamp + 2 * EtherVizService.milSecInDay) {
			latestTimestamp += EtherVizService.milSecInDay;
			this.startOfDayTimestamps.push(latestTimestamp);
		}

		// Fill the chosenTimestamps
		for (let i = this.chosenTimestamps.length; i < this.startOfDayTimestamps.length; i++) {
			// Inserting the largest revData timestamp that happened
			// up to 24 hours after the timestamp from the beginning of that day
			this.chosenTimestamps.push(this.findMaxTimestamp(this.startOfDayTimestamps[i] + EtherVizService.milSecInDay));
		}

		this.buildOutputData(this.permanentList, this.chosenTimestamps[this.chosenTimestamps.length - 1], this.ethervizPermanentDataSet);
	}

	/**
	 * @param limit The timestamp that must not be exceeded
	 * @returns The maximum timestamp in revData, that is smaller than the limit
	 */
	private findMaxTimestamp(limit: number): number {
		let revIndex = this.dataSource.padInfo ? this.dataSource.padInfo?.value.head : 0;
		while (revIndex > 0 && this.dataSource.revData[revIndex].timestamp > limit) {
			revIndex--;
		}
		return this.dataSource.revData[revIndex].timestamp;
	}

	/**
	 * @param ts An UTC timestamp
	 * @returns The timestamp of the beginning of ts´s day in local timezone
	 */
	private getStartOfDayTimestamp(ts: number): number {
		const time = ts % EtherVizService.milSecInDay;
		const timeZoneOffset = new Date(ts - time).getTimezoneOffset() * 60 * 1000;
		return ts - time + timeZoneOffset;
	}

	/**
	 *
	 * @param list The instance of EtherVizList, that is to be updated
	 * @param maxTimestamp The timestamp of a rev data object. No revs newer than this shall be inserted
	 * @param outputDataSet The instance of EtherVizColumn [], that is to be filled
	 */
	private buildOutputData(list: EtherVizList, maxTimestamp: number, outputDataSet: EtherVizColumn[]): void {
		while (list.listRevStatus >= 0 && this.chosenTimestamps[outputDataSet.length] === this.dataSource.revData[list.listRevStatus].timestamp) {
			this.buildStatusBlock(list, outputDataSet);
		}

		let nextRev = list.listRevStatus + 1;
		while (this.dataSource.revData[nextRev] && this.dataSource.revData[nextRev].timestamp <= maxTimestamp) {
			list.setToHead();
			const currentRevData = this.dataSource.revData[nextRev];
			const ops: Generator<Op> = Changeset.deserializeOps(currentRevData.cset.ops);

			let op = ops.next();

			let newChars = currentRevData.cset.charBank.split("");
			while (op.value) {
				const currentOp = op.value;
				switch (currentOp.opcode) {

				case "+":
					newChars = this.handleAdd(list, currentOp, nextRev, newChars);
					break;

				case "=":
					this.handleMove(list, currentOp);
					break;

				case "-":
					this.handleRemove(list, currentOp, nextRev);
					break;
				}
				op = ops.next();
			}
			while (this.chosenTimestamps[outputDataSet.length] === currentRevData.timestamp) {

				// The current changeset timestamp has been chosen to be
				// the basis for the status block of the day.
				// Since it´s possible that there are no changes for
				// a longer period of time, it may be necessary to evluate
				// the current revision several times in order to get
				// the data needed for each day since the creation of the pad.

				this.buildStatusBlock(list, outputDataSet);

			}

			// this revs-dataset is finished. Move to the next one...
			nextRev++;
		}
		list.listRevStatus = nextRev - 1;
	}

	/** Generates a status block from the current content of
	 * the linked list. Will generate a transitional block too,
	 * if this isn´t the first status block.
	 */
	private buildStatusBlock(list: EtherVizList, etherVizDataSet: EtherVizColumn[]): void {
		const timeStampIndex = etherVizDataSet.length;
		const dateString = DateService.formatDate(new Date(this.startOfDayTimestamps[timeStampIndex]));

		// Create meta tags for this timeStampIndex
		// and a status block
		let index = 0;
		let runner = list.head.next;
		if (runner === list.tail) {
			// Pad is currently empty
			etherVizDataSet.push({ dateTime: dateString, rectangles: [] });
			return;
		}
		let author = list.head.next?.author as string;
		let currentBlock: EtherVizColumnItem = {
			authorId: author,
			upperLeft: 0,
			lowerLeft: -1,
		};
		const statusBlock = [];
		while (runner && runner.next) {
			if (runner.author != author) {
				// Close block
				statusBlock.push(currentBlock);
				// Reinitialise
				author = runner.author;

				currentBlock = {
					authorId: author,
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
		// Close final block
		currentBlock.lowerLeft = --index;
		statusBlock.push(currentBlock);


		const entry: EtherVizColumn = { dateTime: dateString, rectangles: statusBlock };

		etherVizDataSet.push(entry);

		// Create transitional block
		if (timeStampIndex > 0) {
			// Collect nodes that appear in both status blocks
			let runner = list.head.next as BasicListNode<EtherVizMeta>;
			const commonNodes: typeof runner[] = [];
			while (runner && runner.next) {
				if (timeStampIndex in runner.meta && (timeStampIndex - 1) in runner.meta) {
					commonNodes.push(runner);
				}
				runner = runner.next;
			}

			if (commonNodes.length > 0) {
				// Prepare first element of parallelograms list
				const nodeZero = commonNodes[0] as BasicListNode<EtherVizMeta>;
				let author = nodeZero.author;
				let currentBlock: EtherVizColumnItem = {
					authorId: author,
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
						// Close block because the author has changed and/or
						// the offset has changed
						parallelograms.push(currentBlock);
						// Reinitialise
						author = node.author;
						currentBlock = {
							authorId: author,
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
				// Close final block
				parallelograms.push(currentBlock);
				etherVizDataSet[timeStampIndex - 1]["parallelograms"] = parallelograms;
			}
		}
	}

	private handleAdd(list: EtherVizList, currentOp: Op, currentRev: number, remainingCharbank: string[]) {
		let author: string;
		try {
			// Trying to find author in attribs
			const authorKey = this.dataSource.extractAuthorKeyFromAttribs(currentOp.attribs);
			author = this.dataSource.getFromNumToAttrib(authorKey, 1);
		} catch (e) {
			// Else use author data from revdata
			author = this.dataSource.revData[currentRev].author;
		}
		for (let i = 0; i < currentOp.chars; i++) {
			const char = remainingCharbank.shift();
			list.insertAfterCurrentAndMoveCurrent(char as string, author, {});
		}
		return remainingCharbank;
	}

	private handleMove(list: EtherVizList, currentOp: Op) {
		list.moveFwd(currentOp.chars);
	}

	private handleRemove(list: EtherVizList, currentOp: Op, currentRev: number) {
		const currentRevData = this.dataSource.revData[currentRev];
		const rawRevData = currentRevData.cset as CSRaw;
		if (rawRevData.newLen == 1) {
			list.eraseAllNodes();
		} else {
			for (let i = 0; i < currentOp.chars; i++) {
				list.removeAfterCurrent();
			}
		}
	}

}