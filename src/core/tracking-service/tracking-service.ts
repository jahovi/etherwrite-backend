import CouchDbService from "../couch/couch-db.service";
import ChangesetProcessor from "../list-service/changeset-processor";
import { MiniMapScrollPos } from "./minimapscrollpos-typs";
import { StructuredTrackingData } from "./structured-tracking-data-type";
import { TrackingData } from "./trackingdata-type";

/**
 * Collects and processes data from the tracking-entries in couch 
 * db generatedby the ep-tracking module. An instance of this class 
 * is assigned to each pad. The creation of instances is handled in
 * the PadRegistry-class. 
 */
export default class TrackingService {

	/** Stores the instances of this class under the corresponding pad names*/
	public static instanceRegistry: { [key: string]: TrackingService } = {};
	private static docScope = CouchDbService.getConnection("etherpad");

	/* The amount of milliseconds that passes, before a general update of data occurs*/
	private static updateDelay = Number(process.env.TRS_UPDATE_DELAY) || 5000;

	/* The name of the pad, for which this instance provides services*/
	public readonly pad: string;

	/* Contains the raw data from couch db for the corresponding pad*/
	private padData: TrackingData[] = [];

	/** Can be accessed by routers to deliver the most recent information regarding scroll positions */
	public miniMapScrollPositions: MiniMapScrollPos = {};

	constructor(pad: string) {
		TrackingService.instanceRegistry[pad] = this;
		this.pad = pad;
	}

	/**
	 * Makes the all instances of TrackingService regularly 
	 * update their data from couch db. 
	 */
	public static async initAndUpdate() {
		await TrackingService.getAndDistributeDatabaseEntries();
		Object.keys(TrackingService.instanceRegistry).forEach(padName => {
			TrackingService.instanceRegistry[padName].generateMiniMapScrollPositions();
		});
		setTimeout(() => TrackingService.initAndUpdate(), TrackingService.updateDelay);
	}

	/**
	 * Extracts the most recent information regarding the
	 * scroll position of each author and stores it into
	 * 'this.miniMapScrollPositions'. If an author is assumed to be
	 * disconnected, no scroll data will be stored for this author. 
	 */
	private generateMiniMapScrollPositions() {
		const data = this.getStructuredPadData();
		const authors: string[] = Object.keys(data);
		const out: MiniMapScrollPos = {};

		authors.forEach(author => {

			const dataEntry = data[author];
			if (!((dataEntry.lastdisconnected != undefined && dataEntry.lastconnected != undefined) && (dataEntry.lastdisconnected.time && dataEntry.lastconnected.time) && (dataEntry.lastdisconnected.time > dataEntry.lastconnected.time))) {
				// user is NOT disconnected

				if (dataEntry.lasttabscrolling != undefined) {


					if (dataEntry.lastdisconnected == undefined || (dataEntry.lasttabscrolling.time > dataEntry.lastdisconnected.time)) {
						// last scrolling event data should be newer than last disconnect event		
						out[author] = {
							timeStamp: dataEntry.lasttabscrolling.time,
							debugTimeStamp: new Date(dataEntry.lasttabscrolling.time).toString(),
							topIndex: dataEntry.lasttabscrolling.state.top.index,
							// topId: dataEntry.lasttabscrolling.state.top.id, // presumably not relevant
							bottomIndex: dataEntry.lasttabscrolling.state.bottom.index,
							// bottomId: dataEntry.lasttabscrolling.state.bottom.id, // presumably not relevant
						};
					}
					// } 
					else {
						console.log("a dropping " + author);
						console.log("timestamp scroll " + dataEntry.lasttabscrolling.time);
						console.log("timestamp disconnect " + dataEntry.lastdisconnected?.time);
					}
				}
			}
		});
		this.miniMapScrollPositions = out;
	}


	/**Filters through the padData and creates an object for 
	 * each author in this pad. Each of these objects contains
	 * a set of the most recent tracking entries for this author 
	 * in several categories. 
	 * See the definition of StructuredTrackingData for details. 
	 * Each StructuredTrackingData object is then stored inside 
	 * the return object under the key of the author id. 
	 * @returns an object as described above
	 */
	private getStructuredPadData() {
		const data = this.padData;
		const out: { [key: string]: StructuredTrackingData } = {};
		const csp = ChangesetProcessor.instanceRegistry[this.pad];
		if (!data) { console.log("data false"); return out; }
		if (!data.length) { console.log("data len 0"); return out; }
		if (!csp) { console.log("missing csp"); return out; }
		data.forEach(entry => {
			if (entry.pad == this.pad) {
				if (!out[entry.user]) {
					out[entry.user] = {};
				}

				const userdata = out[entry.user];
				userdata.lastCHSActive = csp.lastActivityTimeStamp[entry.user];
				userdata.lastCHSActiveDebug = new Date(userdata.lastCHSActive).toString();
				switch (entry.type) {
				case (0): {
					if (!userdata.lastconnected) {
						userdata.lastconnected = entry;
					} else {
						if (userdata.lastconnected.time < entry.time) {
							userdata.lastconnected = entry;
						}
					}
					break;
				}
				case (4): {
					if (!userdata.lastdisconnected) {
						userdata.lastdisconnected = entry;
					} else {
						if (userdata.lastdisconnected.time < entry.time) {
							userdata.lastdisconnected = entry;
						}
					}
					break;
				}
				case (3): {
					if (!userdata.lasttabvisible) {
						userdata.lasttabvisible = entry;
					} else {
						if (userdata.lasttabvisible.time < entry.time) {
							userdata.lasttabvisible = entry;
						}
					}
					break;
				}
				case (5): {
					if (!userdata.lasttabscrolling) {
						userdata.lasttabscrolling = entry;
					} else {
						if (userdata.lasttabscrolling.time < entry.time) {
							userdata.lasttabscrolling = entry;
						}
					}
					break;
				}
				}
			}
		});
		return out;
	}

	/**
	 * Collects all available tracking files in couch db
	 * and distributes each of them to the corresponding
	 * instance of TrackingService. The data will be stored
	 * in the padData property of the instances. 
	 */
	private static async getAndDistributeDatabaseEntries() {
		const data = await CouchDbService.readView(TrackingService.docScope, "evahelpers", "fetchtrackingdata");
		const storage: { [key: string]: TrackingData[] } = {};
		Object.keys(TrackingService.instanceRegistry).forEach(padName => {
			storage[padName] = [];
		});
		data.rows.forEach(doc => {
			const content = doc.value as TrackingData;

			/* Unfortunately ep-tracking doesn´t seem to initialise the 
			time property that is announced in the ep-tracking-readme. 
			Therefore this will have to be reconstructed here by parsing 
			that specific part from the document key*/
			if(!content.time){
				let timeStampPart = doc.key.substring(28, doc.key.length);
				timeStampPart = timeStampPart.substring(0, timeStampPart.indexOf(":"));
				content.time = Number(timeStampPart);
			}
			content.debugtime = new Date(content.time).toString();

			if (storage[content.pad])
				storage[content.pad].push(content);
		});
		Object.keys(storage).forEach(padName => {
			TrackingService.instanceRegistry[padName].padData = storage[padName];
		})
	}

}