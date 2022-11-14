import CouchDbService from "./core/couch/couch-db.service";
import ChangesetProcessor from "./core/list-service/changeset-processor";
import logService from "./core/log/log.service";

export default class PadRegistry {

	private static initWaitTime = 200; /* milliseconds wait time after the retrieval 
										of padnames from db before new procs are created*/

	private static lastUpdate = 0; /* timestamp that indicates the last update check */
	private static updateDelay = Number(process.env.PADREG_UPDATE_DELAY) || 5000; /* milliseconds wait time before another check for
										new pads is allowed */
	private static docScope = CouchDbService.getConnection("etherpad");
	private static padNames: [String?] = [];

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
		await PadRegistry.docScope.view("evahelpers", "detectpadnames", async (err, body) => {
			if (!err) {
				body.rows.forEach(async (doc) => {
					await PadRegistry.insertIfNew(doc.key);
				});
			}
		})
		// let the previous step take its time, 
		// then create new CS-Procs, if needed
		// eslint-disable-next-line @typescript-eslint/no-empty-function
		setTimeout( ()=>{
			PadRegistry.padNames.forEach((padName) => {
				if (padName && !ChangesetProcessor.instanceRegistry[padName.toString()]) {
					new ChangesetProcessor(padName.toString());
					logService.info(PadRegistry.name, "created ChangesetProcessor for '" + padName + "'")
				}
			});}, 300);
	}


	private static async insertIfNew(name: string) {
		if (!PadRegistry.padNames.includes(name)) {
			PadRegistry.padNames.push(name);
			logService.debug(PadRegistry.name, " found pad: '" + name + "'");
		}
	}

}