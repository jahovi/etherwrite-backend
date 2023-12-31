/**
 * Mirrors the structure of the value
 * entries in couch db generated by
 * ep-tracking
 */
export type TrackingData = {
	user: string,
	pad: string,
	session: string,
	token: string,
	tab: string,
	type: number,
	state: { top: { index: number, id: number }, bottom: { index: number, id: number } },
	time: number,
	debugtime: string,

}