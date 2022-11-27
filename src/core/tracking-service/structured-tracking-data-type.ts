import { TrackingData } from "./trackingdata-type"

/**
 * An object of this type is to be assigned to
 * each author in a specific pad. 
 */
export type StructuredTrackingData = {
	
		lastconnected?: TrackingData,
		lastdisconnected?: TrackingData,
		lasttabvisible?: TrackingData,
		lasttabscrolling?: TrackingData,
		
		// the timestamp of the most recent 
		// activity recorded in the changesets
		// Must be retrieved from the Changeset
		// Processor class. 
		lastCHSActive?:number;
		lastCHSActiveDebug?:string;


}