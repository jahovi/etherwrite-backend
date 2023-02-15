import CouchDbService from "../couch/couch-db.service";
import ChangesetService from "../changeset-service/changeset-service";
import { MiniMapScrollPos } from "./minimapscrollpos.type";
import { StructuredTrackingData } from "./structured-tracking-data-type";
import { TrackingData } from "./trackingdata-type";
import CohesionDiagramService from "../../coh-service/coh-service";
import { DateService } from "../util/date.service";
import { LoginData, ScrollEvent } from "./coh-interfaces";
import { Subject } from "../subscriber/subject";
import DbChange from "../couch/dbchange.interface";
import AuthorRegistry from "../authors/author-registry";


/**
 * Collects and processes data from the tracking-entries in couch
 * db generated by the ep_tracking plugin. An instance of this class
 * is assigned to each pad. The creation of instances is handled in
 * the PadRegistry-class.
 */
export default class TrackingService extends Subject<MiniMapScrollPos> {

	/** Stores the instances of this class under the corresponding pad names*/
	public static instanceRegistry: Record<string, TrackingService> = {};
	private static docScope = CouchDbService.getConnection("etherpad");

	/** The name of the pad, for which this instance provides services*/
	public readonly pad: string;

	/** Contains the raw data from couch db for the corresponding pad*/
	private padData: TrackingData[] = [];

	/**For each encountered user this contains a StructuredTrackingData object */
	private structuredTrackingData: Record<string, StructuredTrackingData> = {};

	/** Can be accessed by routers to deliver the most recent information regarding scroll positions */
	public miniMapScrollPositions: MiniMapScrollPos = {};

	private cohesDiagService: CohesionDiagramService;
	private scrollEvents: ScrollEvent[] = [];

	constructor(pad: string) {
		super();
		TrackingService.instanceRegistry[pad] = this;
		this.pad = pad;
		this.cohesDiagService = CohesionDiagramService.instances[pad];
	}

	/**
	 * Returns the data that subscribers should receive.
	 */
	getSubjectData(): MiniMapScrollPos {
		const authors = Object.keys(this.miniMapScrollPositions);
		const aReg = AuthorRegistry.getInstance();
		authors.forEach(author => {
			if (!aReg.isMoodleUser(author)) {
				delete this.miniMapScrollPositions[author];
			}
		})
		return this.miniMapScrollPositions;
	}

	/**
	 * Makes the all instances of TrackingService regularly
	 * update their data from couch db.
	 */
	public static async initAndUpdate() {
		await TrackingService.getAndDistributeDatabaseEntries();
		await TrackingService.activateInstances();
		CouchDbService.subscribeChanges(this.docScope, async (change: DbChange) => {
			const doc = change.doc as { _id: string, value: TrackingData };
			if (doc.value && doc.value.pad) {
				TrackingService.testAndRestoreTimeStamp(doc.value, doc._id);
				const instance = TrackingService.instanceRegistry[doc.value.pad];
				if (instance) {
					instance.padData.push(doc.value);
					instance.processData();
				}
			}

		},
		{
			selector: {
				_id: {
					$gte: "tracking:",
					$lte: "tracking;",
				},
			},
			includeDocs: true,
		})
	}

	private static async activateInstances() {
		Object.keys(TrackingService.instanceRegistry).forEach(padName => {
			const instance = TrackingService.instanceRegistry[padName];
			instance.processData();

		});
	}

	private processData(): void {
		this.buildStructuredPadData();
		this.sendCohServiceData();
		this.generateMiniMapScrollPositions();
		this.notifySubscribers();
	}

	private sendCohServiceData() {
		// Send new ScrollEvents
		if (this.scrollEvents.length > 0) {
			this.scrollEvents.sort((x1, x2) => x1.timestamp - x2.timestamp);
			this.cohesDiagService.receiveScrollData(this.scrollEvents);
			this.scrollEvents.length = 0;
		}

		// Send new Events;
		const loginData: LoginData[] = [];
		Object.keys(this.structuredTrackingData).forEach(id => {
			const dataset = this.structuredTrackingData[id];
			dataset.loginTimestamps.sort((x1, x2) => x1 - x2);
			dataset.logoutTimestamps.sort((x1, x2) => x1 - x2);
			while (dataset.loginTimestamps.length > 0 && dataset.logoutTimestamps.length > 0) {
				if (dataset.loginTimestamps[0] > dataset.logoutTimestamps[0]
					|| (dataset.loginTimestamps[1] && dataset.loginTimestamps[1] < dataset.logoutTimestamps[0])) {
					// logout timestamp is implausible. Presumably the ep_tracking module was unable to detect the
					// logout event after this login.
					const login = dataset.loginTimestamps.shift() as number;
					let assumedLogout = login;

					// The element previously at index 1 is now at index 0:
					if (dataset.loginTimestamps[0] && dataset.loginTimestamps[0] < dataset.logoutTimestamps[0]) {
						// We will make an assumption that the logout happened
						// halfway between the two newer login timestamps
						assumedLogout += (dataset.loginTimestamps[0] + login) / 2;
					} else {
						// We will make an assumption that the logout may have happened an hour after the login.
						assumedLogout += 3600000;
					}
					loginData.push({ user: id, login: login, logout: assumedLogout })
				} else {
					// Data seems plausible
					loginData.push({ user: id, login: dataset.loginTimestamps.shift() as number, logout: dataset.logoutTimestamps.shift() as number });
				}
			}
		});
		if (loginData.length > 0) {
			this.cohesDiagService.receiveLoginData(loginData);
		}

		this.cohesDiagService.initTrackingData();
	}

	/**
	 * Extracts the most recent information regarding the
	 * scroll position of each author and stores it into
	 * 'this.miniMapScrollPositions'. If an author is assumed to be
	 * disconnected, no scroll data will be stored for this author.
	 */
	private generateMiniMapScrollPositions() {
		const data = this.structuredTrackingData;
		const out: MiniMapScrollPos = {};
		Object.entries(data).forEach(([author, dataEntry]) => {
			if (!(dataEntry.lastDisconnected?.time && dataEntry.lastConnected?.time
				&& dataEntry.lastDisconnected.time > dataEntry.lastConnected.time)) {
				// user is NOT disconnected
				if (dataEntry.lastTabScrolling != undefined) {
					if (dataEntry.lastDisconnected == undefined || (dataEntry.lastTabScrolling.time > dataEntry.lastDisconnected.time)) {
						// last scrolling event data should be newer than last disconnect event
						out[author] = {
							timeStamp: dataEntry.lastTabScrolling.time,
							debugTimeStamp: DateService.formatDateTime(new Date(dataEntry.lastTabScrolling.time as number)),
							topIndex: dataEntry.lastTabScrolling.state.top.index,
							bottomIndex: dataEntry.lastTabScrolling.state.bottom.index,
						};
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
	private buildStructuredPadData() {
		const data = this.padData;
		const strData = this.structuredTrackingData;
		const csp = ChangesetService.instanceRegistry[this.pad];
		if (!data || !data.length || !csp) {
			return strData;
		}

		while (data.length > 0) {
			const entry = data.shift() as TrackingData;
			if (!strData[entry.user]) {
				strData[entry.user] = { loginTimestamps: [], logoutTimestamps: [] };
			}

			const userdata = strData[entry.user];
			userdata.lastCHSActive = csp.lastActivityTimeStamp[entry.user];
			userdata.lastCHSActiveDebug = DateService.formatDateTime(new Date(userdata.lastCHSActive));
			switch (entry.type) {
			case (0): {
				if (!userdata.lastConnected) {
					userdata.lastConnected = entry;
				} else {
					if (userdata.lastConnected.time < entry.time) {
						userdata.lastConnected = entry;
					}
				}
				userdata.loginTimestamps.push(entry.time);
				break;
			}
			case (4): {
				if (!userdata.lastDisconnected) {
					userdata.lastDisconnected = entry;
				} else {
					if (userdata.lastDisconnected.time < entry.time) {
						userdata.lastDisconnected = entry;
					}
				}
				userdata.logoutTimestamps.push(entry.time);
				break;
			}
			case (3): {
				if (!userdata.lastTabVisible) {
					userdata.lastTabVisible = entry;
				} else {
					if (userdata.lastTabVisible.time < entry.time) {
						userdata.lastTabVisible = entry;
					}
				}
				break;
			}
			case (5): {
				if (!userdata.lastTabScrolling) {
					userdata.lastTabScrolling = entry;
				} else {
					if (userdata.lastTabScrolling.time < entry.time) {
						userdata.lastTabScrolling = entry;
					}
				}
				const scrollEvent: ScrollEvent = {
					user: entry.user, timestamp: entry.time, startParagraph: entry.state.top.index,
					endParagraph: entry.state.bottom.index ? entry.state.bottom.index : Number.MAX_VALUE,
				};
				this.scrollEvents.push(scrollEvent);

				break;
			}
			}
		}
	}

	/**
	 * Collects all available tracking files in couch db
	 * and distributes each of them to the corresponding
	 * instance of TrackingService, if the timestamp of
	 * those tracking files is newer. The data will be stored
	 * in the padData property of the instances.
	 * This method should only be called once at startup. 
	 * All later Tracking events are handled by the CouchDB change
	 * subscription. 
	 */
	private static async getAndDistributeDatabaseEntries() {
		const data = await CouchDbService.readView(TrackingService.docScope, "evahelpers", "fetchtrackingdata",
			{ start_key: "tracking:0", end_key: "tracking:99999999999999" });
		const storage: Record<string, TrackingData[]> = {};
		Object.keys(TrackingService.instanceRegistry).forEach(padName => {
			storage[padName] = [];
		});
		data.rows.forEach(doc => {
			const content = doc.value as TrackingData;
			TrackingService.testAndRestoreTimeStamp(content, doc.id);

			if (storage[content.pad]) {
				storage[content.pad].push(content);
			}
		});

		Object.keys(storage).forEach(padName => {
			storage[padName].forEach(entry => {
				TrackingService.instanceRegistry[padName].padData.push(entry);
			});
		})
	}

	private static testAndRestoreTimeStamp(content: TrackingData, id: string) {
		if (!content.time) {
			let timeStampPart = id.substring(28);
			timeStampPart = timeStampPart.substring(0, timeStampPart.indexOf(":"));
			content.time = Number(timeStampPart);
		}
		const date = new Date(0);
		date.setUTCMilliseconds(content.time);
		content.debugtime = DateService.formatDateTime(date);
	}

}