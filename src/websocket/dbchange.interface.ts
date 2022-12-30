/**
 * Describes a database change as returned from the ChangesReader.
 */
export default interface DbChange {
	seq: string;
	id: string;
	changes: {
		rev: string;
	}[];
	doc?: {};
}