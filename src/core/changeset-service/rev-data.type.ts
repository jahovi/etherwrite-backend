import Changeset from "../../changeset/Changeset";

export type RevData = Record<number, {
	cset: Changeset.Changeset;
	author: string;
	timestamp: number;
}>;