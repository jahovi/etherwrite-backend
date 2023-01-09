import BasicList, { BasicListNode } from "../core/changeset-service/basic-list";

/**A double linked list customized to fit the needs of 
 * the CohesionDiagramService
 */
export default class CohList extends BasicList<CohMeta> {

	constructor() {
		super();
		this.head.meta.countedAsSupport = true;
		this.head.meta.seenByEvaluated = Number.MAX_VALUE;
		this.tail.meta.countedAsSupport = true;
		this.tail.meta.seenByEvaluated = Number.MAX_VALUE;
	}

	debugPrint() {
		let runner = this.head.next as BasicListNode<CohMeta>;
		while (runner && runner.next) {
			if (runner.content !== "\n")
				console.log(runner.content + " " + JSON.stringify(runner.meta));
			runner = runner.next;
		}
	}
}
/**Defines the meta object carried by the CohList
 */
export interface CohMeta {
	countedAsSupport: boolean,
	seenBy: string[],
	seenByEvaluated: number
}