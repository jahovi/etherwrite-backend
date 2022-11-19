import CouchDbService from "./core/couch/couch-db.service";
import ChangesetProcessor from "./core/list-service/changeset-processor";
import logService from "./core/log/log.service";

export default class PadRegistry {

	private static lastUpdate = 0; /* timestamp that indicates the last update check */
	private static updateDelay = Number(process.env.PADREG_UPDATE_DELAY) || 5000; /* milliseconds wait time before another check for
										new pads is allowed */
	private static docScope = CouchDbService.getConnection("etherpad");
	private static padNames: string[] = [];

	/**Call this at startup to initialise the registry.
	 * Later calls make the PadRegsitry look for newly
	 * created pads in the database.
	 */
	public static async initAndUpdate() {
		const timestamp = Date.now();
		if (PadRegistry.lastUpdate + PadRegistry.updateDelay > timestamp) {
			// refusing update if the previous update was not too long ago
			return;
		}

		PadRegistry.lastUpdate = timestamp;
		// fill the list with padnames from the database
		const pads = await CouchDbService.readView(PadRegistry.docScope, "evahelpers", "detectpadnames");
		pads.rows.forEach(doc => PadRegistry.insertIfNew(doc.key));

		// let the previous step take its time,
		// then create new CS-Procs, if needed
		// eslint-disable-next-line @typescript-eslint/no-empty-function
		PadRegistry.padNames.forEach((padName) => {
			if (padName && !ChangesetProcessor.instanceRegistry[padName.toString()]) {
				new ChangesetProcessor(padName.toString());
				logService.info(PadRegistry.name, "Created ChangesetProcessor for '" + padName + "'")
			}
		});
	}


	private static insertIfNew(name: string) {
		if (!PadRegistry.padNames.includes(name)) {
			PadRegistry.padNames.push(name);
			logService.debug(PadRegistry.name, " found pad: '" + name + "'");
		}
	}

}