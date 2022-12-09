/**
 * Mirrors the structure of the objects in the
 * database that contain central author information.
 */
import {IdentifiedDocument, RevisionedDocument} from "nano";

export default interface AuthorData extends IdentifiedDocument, RevisionedDocument {
	value: {
		colorId: string,
		name: string,
		timestamp: number;
	}
}