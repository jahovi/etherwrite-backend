export type MiniMapScrollPos = Record<string, {
	timeStamp: number,
	debugTimeStamp: string,
	topIndex: number,
	bottomIndex?: number,
}>;