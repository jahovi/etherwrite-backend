import BasicList from "../core/changeset-service/basic-list";
export default class CohList extends BasicList<CohMeta> {

}

export interface CohMeta {
	//
	partOfABlock:boolean;
}