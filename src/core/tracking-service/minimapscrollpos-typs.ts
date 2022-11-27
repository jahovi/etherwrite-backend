export type MiniMapScrollPos = {
	[key: string]:
	{
		timeStamp: number,
		debugTimeStamp: string,
		topIndex: number,
		topId?: number,
		bottomIndex?: number,
		bottomId?: number
	}
}