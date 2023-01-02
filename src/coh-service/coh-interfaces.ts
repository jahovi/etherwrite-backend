export interface Paragraph {
	startIndex: number,
	endIndex: number,
	contributors: {
		author: string,
		numberOfChars: number
	}
}