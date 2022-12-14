import BasicList from "../core/changeset-service/basic-list";

export default class EtherVizList extends BasicList<EtherVizMeta>{

}

export interface EtherVizMeta {
	// timestamp:number;

	[timeStampIndex:number]: number;
}