/**
 * Mirrors the structure of the
 * {@code pad:PADNAME:revs:XXX} objects
 * in the database.
 */
export default interface PadRev {
	_id: string;
	_rev: string;
	value: {
		changeset: string,
		meta: {
			author: string,
			timestamp: number,
		}
	}
}