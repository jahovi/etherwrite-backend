import BasicList, { BasicListNode } from "../core/changeset-service/basic-list";

/**
 * A linked list implementation that is customized
 * to fit the needs of the EtherVizService. 
 */
export default class EtherVizList extends BasicList<EtherVizMeta>{

	listRevStatus = -1;

	copy(): EtherVizList {
		const copy = new EtherVizList();
		let runner = this.head.next as BasicListNode<EtherVizMeta>;
		while (runner && runner.next) {
			copy.insertAfterCurrentAndMoveCurrent(runner.content, runner.author, {});
			Object.keys(runner.meta).forEach(key => {
				copy.current.meta[Number(key)] = runner.meta[Number(key)];
			});
			runner = runner.next;
		}
		copy.listRevStatus = this.listRevStatus;
		return copy;
	}

	print(): void {
		let runner = this.head.next as BasicListNode<EtherVizMeta>;
		while (runner && runner.next) {
			console.log(runner.content + " " + runner.author);
			if (Object.keys(runner.meta).length > 0) {
				Object.keys(runner.meta).forEach(key => {
					console.log(key + "  " + runner.meta[Number(key)]);
				})
			}
			runner = runner.next;
		}
	}
}

export interface EtherVizMeta {

	[timeStampIndex: number]: number;
}