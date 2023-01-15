import AbstractChangesetSubscriber from "../core/changeset-service/abstract-changeset-subscriber";
import Changeset, {Op} from "../changeset/Changeset";
import {RevData} from "../core/changeset-service/rev-data.type";
import {ActivityDataEntry, ActivityType} from "./activity-data-entry.interface";


export default class ActivityProcessor extends AbstractChangesetSubscriber<ActivityDataEntry[]> {
	/**
	 * Allows access to instances of this class, for example
	 * when a router wants to pass the generated data to the frontend.
	 */
	public static instances: Record<string, ActivityProcessor> = {};

	public blockList: ActivityDataEntry[] = [];
	private listRevStatus = 0;

	constructor(padName: string) {
		super(padName);
		ActivityProcessor.instances[padName] = this;
	}

	public getSubjectData(): ActivityDataEntry[] {
		throw new Error("Method not implemented."); // TODO
	}

	dataSourceCallback() {
		let nextRev = this.listRevStatus + 1;
		while (this.dataSource.revData[nextRev]) {
			// we are going through all new revs that we previously pulled from the database
			const currentRevData: RevData = this.dataSource.revData[nextRev];
			// bring the data in a more comfortable shape.
			// ops may contain zero or more operations
			const ops: Generator<Op> = Changeset.deserializeOps(currentRevData.cset.ops);

			// pick up the first operation in ops
			let op = ops.next();

			let addOps = 0,
				deleteOps = 0;

			const authorId: string = currentRevData.author;
			const attribSet: Set<string> = new Set();
			let newEntry: ActivityDataEntry | undefined = undefined;

			while (op.value) {
				// op.value contains something, therefore we are evaluating it
				const currentOp = op.value;
				if (currentOp.attribs) {
					const opAttribs = this.dataSource.attribsToList(currentOp.attribs);
					opAttribs.forEach(attr => {
						attribSet.add(attr);
					});
				}
				switch (op.value.opcode) {

				case "+":
					addOps++;
					break;

				case "-":
					deleteOps++;
					break;
				}
				op = ops.next();
			}

			// We know from testing that Etherpad doesn´t combine delete
			// ops with other op types.
			const deleteFound = deleteOps > 0;
			if (deleteFound) {
				newEntry = this.handleDelete(currentRevData, authorId);
			} else {
				// If more than one add operation was found, this
				// indicates, that the inserted text consisted of
				// several parts of text which had different attributes
				// This is not plausible for normal type writing.
				let pasteFound = addOps > 1;

				// An extraordinary large number of inserted characters within
				// roughly 0.5 seconds is not plausible for a typical user.
				// Disclaimer: We are not expecting people who use Etherpad as
				// a training ground for world-record attempts in type writing.
				pasteFound = pasteFound || currentRevData.cset.charBank.length >= 10;
				if (pasteFound) {
					newEntry = this.handlePaste(currentRevData, authorId);
				} else {
					// If there were no deletes and no addOps then there must have
					// been an edit, i.e. bold, italics, etc...
					// Otherwise there wouldn´t be a changeset at all.
					let editFound = addOps === 0;
					if (!editFound && currentRevData.cset.charBank === "*") {
						// Test whether this author has used the heading function of
						// Etherpad (which should be represented as an edit action).
						// An asterisk '*' is always inserted, when a heading is set.
						// But that alone isn´t conclusive.
						Object.keys(this.dataSource.attrToHeadingMapping).forEach(headingKey => {
							// The asterisk combined with a heading attrib is
							// a clear indicator.
							editFound = editFound || attribSet.has(headingKey);
						});
					}
					if (editFound) {
						newEntry = this.handleEdit(currentRevData, authorId);
					} else {
						// If it wasn´t any of the cases above, it can only be
						// a normal add operation
						newEntry = this.handleAdd(currentRevData, authorId);
					}
				}
			}

			if (newEntry) {
				this.blockList.push(newEntry);
			}
			// this revs-dataset is finished. Move to the next one...
			nextRev++;
		}
		this.listRevStatus = nextRev - 1;
	}

	/**
	 * Handles an "add" operation and creates a new {@link ActivityDataEntry}.
	 *
	 * @param revData The data of the currently inspected revision.
	 * @param author The author id.
	 * @return a newly created {@link ActivityDataEntry}.
	 */
	private handleAdd(revData: RevData, author: string): ActivityDataEntry | undefined {
		return {
			author,
			type: ActivityType.WRITE,
			timestamp: new Date(revData.timestamp),
		};
	}

	/**
	 * Handles a "paste" operation and creates a new {@link ActivityDataEntry}.
	 *
	 * @param revData The data of the currently inspected revision.
	 * @param author The author id.
	 * @return a newly created {@link ActivityDataEntry}.
	 */
	private handlePaste(revData: RevData, author: string): ActivityDataEntry | undefined {

		return {
			author,
			type: ActivityType.PASTE,
			timestamp: new Date(revData.timestamp),
		};
	}

	/**
	 * Handles an "edit" operation and creates a new {@link ActivityDataEntry}.
	 * Move operations could also contain attribute changes which are treated as "EDIT".
	 *
	 * @param revData The data of the currently inspected revision.
	 * @param author The author id.
	 * @return a newly created {@link ActivityDataEntry}.
	 */
	private handleEdit(revData: RevData, author: string): ActivityDataEntry | undefined {
		return {
			author,
			type: ActivityType.EDIT,
			timestamp: new Date(revData.timestamp),
		};
	}

	/**
	 * Handles a "delete" operation and creates a new {@link ActivityDataEntry}.
	 *
	 * @param revData The data of the currently inspected revision.
	 * @param author The author id.
	 * @return a newly created {@link ActivityDataEntry}.
	 */
	private handleDelete(revData: RevData, author: string): ActivityDataEntry | undefined {

		return {
			author,
			type: ActivityType.DELETE,
			timestamp: new Date(revData.timestamp),
		};
	}
}
