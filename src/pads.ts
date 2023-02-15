import { ConstructorOf } from "./constructor-of.interface";
import CouchDbService from "./core/couch/couch-db.service";
import AbstractChangesetSubscriber from "./core/changeset-service/abstract-changeset-subscriber";
import ChangesetService from "./core/changeset-service/changeset-service";
import subscribers from "./core/changeset-service/subscribers";
import logService from "./core/log/log.service";
import TrackingService from "./core/tracking-service/tracking-service";
import DbChange from "./core/couch/dbchange.interface";

export default class PadRegistry {

	private static docScope = CouchDbService.getConnection("etherpad");
	private static padNames: string[] = [];
	private static padIgnoreList: string[] = [];
	private static ignoreListLength = 0;
	private static couchDBChangesInit = false;

	/**Call this at startup to initialise the registry.
	 * Later calls make the PadRegistry look for newly
	 * created pads in the database.
	 */
	public static async initAndUpdate() {
		PadRegistry.initIgnoreList();

		// fill the list with padnames from the database
		const pads = await CouchDbService.readView(PadRegistry.docScope, "evahelpers", "detectpadnames");
		pads.rows.forEach(doc => PadRegistry.insertIfNew(doc.key));


		PadRegistry.padNames.forEach((padName) => {
			PadRegistry.createServices(padName);
		});


		// PadRegistry subscribes for changes that indicate a newly inserted pad
		if (!PadRegistry.couchDBChangesInit) {
			CouchDbService.subscribeChanges(PadRegistry.docScope, (change: DbChange) => {

				// The padName is located after "pad2readonly:" in the change.id
				const newPadName = change.id.substring(13);
				if(PadRegistry.insertIfNew(newPadName)){
					PadRegistry.createServices(newPadName);
				}
			},
			{
				selector: {
					_id: {
						$gte: "pad2readonly:",
						$lte: "pad2readonly;",
					},
				},
			})
			PadRegistry.couchDBChangesInit = true;
		}
	}

	/**Starts the instantiation of a ChangesetService, TrackingService
	 * and the services inheriting from AbstractChangesetSubscriber for
	 * the pad with the given name. 
	 * @param padName 
	 */
	private static createServices(padName:string): void{
		if (padName && !ChangesetService.instanceRegistry[padName]) {
			new ChangesetService(padName.toString());
			// create instances of all subclasses of AbstractChangesetSubscriber
			(subscribers as ConstructorOf<AbstractChangesetSubscriber<any>>[]).forEach(subscriber => new subscriber(padName));
			logService.info(PadRegistry.name, "Created Services for '" + padName + "'");
		}
		if (padName && !TrackingService.instanceRegistry[padName]) {
			new TrackingService(padName);
		}
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
		let attempt = 0;
		while (!serviceInstance && attempt < 150) {
			// Give the newly created services some time to initialise
			// The current maximum wait period is 150 * 100 ms = 15 seconds
			await new Promise(resolve => setTimeout(resolve, 100));
			serviceInstance = instances[padName];
			attempt++;
		}

		if (!serviceInstance) {
			// padName apparently unknown
			throw new Error(`Pad "${padName}" not found.`);
		}

		return serviceInstance;
	}

	private static insertIfNew(name: string): boolean {
		if (!PadRegistry.padNames.includes(name)) {
			if (!PadRegistry.padIgnoreList.includes(name)) {
				PadRegistry.padNames.push(name);
				logService.debug(PadRegistry.name, "Found pad: '" + name + "'");
				return true;
			}
		}
		return false;
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