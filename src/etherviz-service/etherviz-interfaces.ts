export interface EtherVizColumn {
		dateTime:string,
		/**A rectangle describes a status block */
		rectangles: EtherVizColumnItem[], 
		/**A parallelogram describes the transitions from
		 * the characters that are part of the rectangles
		 * block to the status block after the cuurent one. 
		 */
		parallelograms?: EtherVizColumnItem[] 
	}

export interface EtherVizColumnItem {
	authorId:string,
	authorColor:string,
	upperLeft: number,
	upperRight?:number,
	lowerLeft:number,
	lowerRight?:number,
}