export enum ActivityType {
	EDIT = "EDIT",
	WRITE = "WRITE",
	PASTE = "PASTE",
	DELETE = "DELETE",
}

export interface ActivityDataEntry {
	timestamp: Date;
	author: string;
	type: ActivityType;
}