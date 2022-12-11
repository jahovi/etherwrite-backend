/**
 * Mirrors the structure of the
 * {@code pad:PADNAME} objects in the
 * database.
 */
export default interface PadInfo {
	_id: string;
	_rev: string;
	value: {
		atext: {
			text: string,
			attribs: string,
		},
		pool: {
			numToAttrib: Record<string, [string, string]>;
			nextNum: number,
		}
		head: number;
		chatHead: number,
		publicStatus: boolean,
		savedRevisions: string[];
	},
}