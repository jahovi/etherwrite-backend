import CouchDbService from "./core/couch/couch-db.service";
import ChangesetProcessor from "./core/list-service/changeset-processor";
import logService from "./core/log/log.service";
import TrackingService from "./core/tracking-service/tracking-service";

export default class PadRegistry {

	private static lastUpdate = 0; /* timestamp that indicates the last update check */
	private static updateDelay = Number(process.env.PADREG_UPDATE_DELAY) || 5000; /* milliseconds wait time before another check for
										new pads is allowed */
	private static docScope = CouchDbService.getConnection("etherpad");
	private static padNames: string[] = [];
	private static padIgnoreList: string[] = [];
	private static ignoreListLength = 0;

	/**Call this at startup to initialise the registry.
	 * Later calls make the PadRegsitry look for newly
	 * created pads in the database.
	 */
	public static async initAndUpdate() {
		PadRegistry.initIgnoreList();
		const timestamp = Date.now();
		if (PadRegistry.lastUpdate + PadRegistry.updateDelay > timestamp) {
			// refusing update if the previous update was not too long ago
			return;
		}

		PadRegistry.lastUpdate = timestamp;
		// fill the list with padnames from the database
		const pads = await CouchDbService.readView(PadRegistry.docScope, "evahelpers", "detectpadnames");
		pads.rows.forEach(doc => PadRegistry.insertIfNew(doc.key));


		PadRegistry.padNames.forEach((padName) => {
			let infoMarker = 0;
			if (padName && !ChangesetProcessor.instanceRegistry[padName]) {
				new ChangesetProcessor(padName.toString());
				infoMarker += 1;
			}
			if (padName && !TrackingService.instanceRegistry[padName]) {
				infoMarker += 2;
				new TrackingService(padName);
			}

			// create fitting info-output
			switch (infoMarker) {
			case (1): {
				logService.info(PadRegistry.name, "Created ChangesetProcessor for '" + padName + "'");
				break;
			}
			case (2): {
				logService.info(PadRegistry.name, "Created TrackingService for '" + padName + "'");
				break;
			}
			case (3): {
				logService.info(PadRegistry.name, "Created ChangesetProcessor and TrackingService for '" + padName + "'");
				break;
			}
			}
		});
	}


	private static insertIfNew(name: string) {
		if (!PadRegistry.padNames.includes(name)) {
			if (!PadRegistry.padIgnoreList.includes(name)) {
				PadRegistry.padNames.push(name);
				logService.debug(PadRegistry.name, "Found pad: '" + name + "'");
			}
		}
	}

	private static initIgnoreList() {
		if (process.env.PADS_IGNORE) {
			const list = process.env.PADS_IGNORE.split(",");
			PadRegistry.padIgnoreList = [];
			list.forEach((name) => PadRegistry.padIgnoreList.push(name.trim()));
		}
		if (PadRegistry.padIgnoreList.length > PadRegistry.ignoreListLength) {
			logService.info(PadRegistry.name, "IgnoreList: " + PadRegistry.padIgnoreList);
			PadRegistry.ignoreListLength = PadRegistry.padIgnoreList.length;
		}
	}

}