import AbstractChangesetSubscriber from "../core/changeset-service/abstract-changeset-subscriber";
import Changeset, {Op} from "../changeset/Changeset";
import {RevData} from "../core/changeset-service/rev-data.type";
import {ActivityDataEntry} from "./activity-data-entry.interface";

export default class ActivityProcessor extends AbstractChangesetSubscriber {
	/**
	 * Allows access to instances of this class, for example
	 * when a router wants to pass the generated data to the frontend.
	 */
	public static instances: Record<string, ActivityProcessor> = {};

	public blockList: ActivityDataEntry[] = [];
	private listRevStatus = -1;

	constructor(padName: string) {
		super(padName);
		ActivityProcessor.instances[padName] = this;
	}

	dataSourceCallback(): void {
		let nextRev = this.listRevStatus + 1;
		while (this.dataSource.revData[nextRev]) {
			// we are going through all new revs that we previously pulled from the database
			const currentRevData: RevData = this.dataSource.revData[nextRev];
			// bring the data in a more comfortable shape.
			// ops may contain zero or more operations
			const ops: Generator<Op> = Changeset.deserializeOps(currentRevData.cset.ops);

			// pick up the first operation in ops
			let op = ops.next();

			while (op.value) {
				// op.value contains something, therefore we are evaluating it
				const currentOp = op.value;
				let author: string;

				try {
					const authorKey: string = this.dataSource.extractAuthorKeyFromAttribs(currentOp.attribs);
					author = this.dataSource.getFromNumToAttrib(authorKey, 1);
				} catch (e) {
					// else use author data from revdata
					author = currentRevData.author;
				}

				let newEntry: ActivityDataEntry | undefined = undefined;

				switch (currentOp.opcode) {

				case "+":
					newEntry = this.handleAdd(currentRevData, currentOp, author);
					break;

				case "=":
					newEntry = this.handleMove(currentRevData, currentOp, author);
					break;

				case "-":
					newEntry = this.handleDelete(currentRevData, currentOp, author);
					break;
				}

				if (newEntry) {
					const timestamp = new Date();
					timestamp.setUTCMilliseconds(currentRevData.timestamp);
					(newEntry as ActivityDataEntry).timestamp = timestamp;
					this.blockList.push(newEntry);
				}
				op = ops.next();
			}
			// this revs-dataset is finished. Move to the next one...
			nextRev++;
		}
		this.listRevStatus = nextRev - 1;
	}

	private handleAdd(currentRevData: RevData, currentOp: any, author: string): ActivityDataEntry | undefined {
		return undefined;
	}

	private handleMove(revData: RevData, currentOp: any, author: string): ActivityDataEntry | undefined {
		return undefined;
	}

	private handleDelete(revData: RevData, currentOp: any, author: string): ActivityDataEntry | undefined {
		return undefined;
	}

	private getTimestamp(revData: RevData): Date {
		const timestamp = new Date();
		timestamp.setUTCMilliseconds(revData.timestamp);
		return timestamp;
	}
}
