import Changeset from "../../changeset/Changeset";

export interface RevData {
	cset: Changeset.Changeset;
	author: string;
	timestamp: number;
}