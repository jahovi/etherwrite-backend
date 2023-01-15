import {ConstructorOf} from "./constructor-of.interface";
import CouchDbService from "./core/couch/couch-db.service";
import AbstractChangesetSubscriber from "./core/changeset-service/abstract-changeset-subscriber";
import ChangesetService from "./core/changeset-service/changeset-service";
import subscribers from "./core/changeset-service/subscribers";
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
	 * Later calls make the PadRegistry look for newly
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
			if (padName && !ChangesetService.instanceRegistry[padName]) {
				new ChangesetService(padName.toString());
				// create instances of all subclasses of AbstractChangesetSubscriber
				(subscribers as ConstructorOf<AbstractChangesetSubscriber<any>>[]).forEach(subscriber => new subscriber(padName));
				logService.info(PadRegistry.name, "Created Services for '" + padName + "'");
			}
			if (padName && !TrackingService.instanceRegistry[padName]) {
				new TrackingService(padName);
			}
		});
	}

	/**
	 * Helper method to retrieve an instance from the given map of service instances.
	 * If the instance is not there yet, the registry updates itself to try and find new pads to register services for.
	 * @param instances The map of instances to find the instance in.
	 * @param padName The name of the pad to find the instance for.
	 * @return An instance of the service.
	 * @throws Error if no service instance could not be found. This must mean that the pad is not registered correctly.
	 */
	public static async getServiceInstance<T>(instances: Record<string, T>, padName: string): Promise<T> {

		let serviceInstance = instances[padName];

		if (!serviceInstance) {
			// maybe there is new pad in the database? let´s check...
			await PadRegistry.initAndUpdate();

			serviceInstance = instances[padName];

			if (!serviceInstance) {
				// padName apparently unknown
				throw new Error(`Pad "${padName}" not found.`);
			}
		}

		return serviceInstance;
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
			if (list.length) {
				PadRegistry.padIgnoreList = list.map(name => name.trim());
				if (PadRegistry.padIgnoreList.length > this.ignoreListLength) {
					logService.info(PadRegistry.name, "IgnoreList: " + PadRegistry.padIgnoreList);
					this.ignoreListLength = PadRegistry.padIgnoreList.length;
				}
			}
		}
	}


}