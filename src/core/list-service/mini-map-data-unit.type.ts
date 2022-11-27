export type MiniMapDataUnit = {
	author: string,
	blockLength: number,
	lineBreakIndices?: number[],
	ignoreColor?:boolean,
	headingStartIndices?:number[],
	headingTypes?:{[key:number]:string},
}