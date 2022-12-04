export type MiniMapScrollPos = {
	[key: string]:
		{
			timeStamp: number,
			debugTimeStamp: string,
			topIndex: number,
			bottomIndex?: number,
		}
}