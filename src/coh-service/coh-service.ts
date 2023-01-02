import AbstractChangesetSubscriber from "../core/changeset-service/abstract-changeset-subscriber";
import CohList from "./coh-list";
import Changeset, { Op } from "../changeset/Changeset";
import CSRaw from "../core/changeset-service/csraw.interface";
import { DateService } from "../core/util/date.service";

export default class CohesionDiagramService extends AbstractChangesetSubscriber {

	public static instances: Record<string, CohesionDiagramService> = {};

	private list: CohList = new CohList();
	private listRevStatus = -1;

	private stableTimeStamps: number[] = [];
	private stableTimeStampInterval  = 60000;
	constructor(padName: string) {
		super(padName);
		CohesionDiagramService.instances[padName] = this;
	}

	dataSourceCallback(): void {
		this.findStableTimeStamps();
		this.buildList();
		this.stableTimeStamps.forEach(t => {
			console.log(DateService.formatDateTime(new Date(t)));
		})
	}

	private findStableTimeStamps() {
		let nextIndex = this.listRevStatus + 1;
		let currentRevData = this.dataSource.revData[nextIndex];

		while (currentRevData) {
			const nextRevData = this.dataSource.revData[nextIndex + 1];
			if (nextRevData && currentRevData.timestamp < nextRevData.timestamp - this.stableTimeStampInterval) {
				this.stableTimeStamps.push(currentRevData.timestamp);
			}
			nextIndex++;
			currentRevData = this.dataSource.revData[nextIndex];
		}
		currentRevData = this.dataSource.revData[nextIndex-1];
		if(currentRevData.timestamp + this.stableTimeStampInterval < Date.now()){
			this.stableTimeStamps.push(currentRevData.timestamp);
		}
	}


	/** Very similar to the template from the MinimapService.
	 *  See the comments there for more details. 
	 */
	private buildList(): void {
		let nextRev = this.listRevStatus + 1;
		while(this.dataSource.revData[nextRev]) {
			this.list.setToHead();
			const currentRevData = this.dataSource.revData[nextRev];
			const ops: Generator<Op> = Changeset.deserializeOps(currentRevData.cset.ops);
			let op = ops.next();
			let newChars = currentRevData.cset.charBank.split("");
			while (op.value) {
				const currentOp = op.value;
				switch (currentOp.opcode) {
				case "+":
					newChars = this.handleAdd(currentOp, nextRev, newChars);
					break;
				case "=":
					this.handleMove(currentOp);
					break;
				case "-":
					this.handleRemove(currentOp, nextRev);
					break;
				}
				op = ops.next();
			}
			// Evaluate partOfABlock:
			// A block is at least the amount of characters in a short sentence.
			// It is assumed, that this number is at least 12. 
			// let runner = this.list.current;
			// let ctr = 0;
			// while(runner && runner.prev){
			// 	if(runner.author==this.dataSource.revData[nextRev].author){
			// 		ctr++;
			// 	}
			// 	runner = runner.prev;
			// }

			nextRev++;
		}
		this.listRevStatus = nextRev - 1;
	}

	private handleAdd(currentOp: Op, currentRev: number, remainingCharbank: string[]) {
		const author = this.dataSource.revData[currentRev].author;
		for (let i = 0; i < currentOp.chars; i++) {
			const char = remainingCharbank.shift();
			this.list.insertAfterCurrentAndMoveCurrent(char as string, author, { partOfABlock: false });
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