import Changeset from "../../changeset/Changeset";
export default interface RevData {

	[key: number]: { cset: Changeset.Changeset, author: string, timestamp: number } 

}