export interface ScrollEvent {
	user: string,
	timestamp: number,
	startParagraph: number,
	endParagraph: number
}

export type LoginData = { user: string, login: number, logout: number };