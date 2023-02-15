import DbChange from "../couch/dbchange.interface";
import AuthorData from "../changeset-service/global-author.interface";
import CouchDbService from "../couch/couch-db.service";
import logService from "../log/log.service";
import LogService from "../log/log.service";
import { Subject } from "../subscriber/subject";
import { Author } from "./author.interface";

export default class AuthorRegistry extends Subject<Record<string, Author>>{



	/**This method filters the content of the
	 * knownAuthors object, removing all entries
	 * that don´t have initialised color and/or mapper2author
	 * propertied. 
	 * 
	 * @returns the filtered author data
	 */
	public getSubjectData(): Record<string, Author> {
		const filtered = Object.entries(this.knownAuthors).filter(([, value]) => value.color !== "" && value.mapper2author !== "");
		return Object.fromEntries(filtered);
	}

	/**This record contains the authors
	 * and their color and epaliases. epaliases
	 * can be manually modified by the users in the 
	 * editor and should only be used for debugging
	 * purposes. 
	 */
	public knownAuthors: Record<string, Author> = {};

	private static docScope = CouchDbService.getConnection("etherpad");

	private static instance: AuthorRegistry | undefined;

	/**Beware: Other internal EVA services should only rely
	 * on data from this instance after the EVA server has 
	 * completed booting. I.e. it´s okay to use the AuthorRegistry
	 * instance for example in service methods that are called in
	 * response to an API call from the frontend. But you should _never_
	 * use AuthorRegistry in the course of routines that are tied
	 * to the initialising phase of a service instance. Otherwise
	 * you are in danger of crashes during EVA´s booting process. 
	 * 
	 * @returns the singleton instance of this class
	 */
	public static getInstance(): AuthorRegistry {
		if (!this.instance) {
			this.instance = new AuthorRegistry();
		}
		return this.instance;
	}

	/**
	 * Useful filtering authors that are not registered in Moodle
	 * @param epId an Etherpad ID string
	 * @returns true if there is a mapper2author value for this ID, else returns false
	 */
	public isMoodleUser(epId: string): boolean {
		return this.knownAuthors[epId] && this.knownAuthors[epId].mapper2author !== "";
	}


	private constructor() {
		super();
		this.init();
	}

	/**
	 * Creates subscriptions to changes in the CouchDB and fetches all author data that is currently stored in CouchDB. 
	 */
	private async init() {
		CouchDbService.subscribeChanges(AuthorRegistry.docScope, async (change: DbChange) => {
			if (change.id.startsWith("globalAuthor:")) {
				const doc = change.doc as AuthorData
				if (doc._id && doc.value) {
					let newData = false;
					const authorID = doc._id.substring(13);
					const dbColor = String(doc.value.colorId);
					const hexColorCode = (/^#([0-9a-f]{1,6})$/i).test(dbColor) ? dbColor : this.applyColorFix(Number(dbColor), authorID);
					await this.fetchMapperData();
					if (!this.knownAuthors[authorID]) {
						this.knownAuthors[authorID] = { epalias: doc.value.name, color: hexColorCode, mapper2author: "" };
						newData = true;
					} else {
						if (this.knownAuthors[authorID].color !== hexColorCode) {
							this.knownAuthors[authorID].color = hexColorCode;
							newData = true;
						}
						this.knownAuthors[authorID].epalias = doc.value.name;
					}
					if (newData) {
						this.notifySubscribers();
					}
				}
			}
			if (change.id.startsWith("mapper2author:")) {
				const doc = change.doc as { _id: string, value: string };
				if (doc._id) {
					const authorID = doc.value;
					if (!this.knownAuthors[authorID]) {
						this.knownAuthors[authorID] = { epalias: "", color: "", mapper2author: doc._id.substring(14) };
					} else {
						if (this.knownAuthors[authorID].mapper2author !== doc._id.substring(14)) {
							this.knownAuthors[authorID].mapper2author = doc._id.substring(14);
							this.notifySubscribers();
						}
					}
				}
			}
		},
		{
			selector: {
				_id: {
					$gt: "globalAuthor:",
					$lt: "mapper2author;",
				},
			},
			includeDocs: true,
		});

		const globalAuthors = await CouchDbService.readView(AuthorRegistry.docScope, "evahelpers", "fetchglobalauthors");
		globalAuthors.rows.forEach(doc => {
			const authorData = doc.value as { colorId: string, name: string };
			this.knownAuthors[doc.key] = { epalias: authorData.name, color: authorData.colorId, mapper2author: "" };
		})
		await this.fetchMapperData();
		this.notifySubscribers();
		LogService.info(AuthorRegistry.name, "Initialised author registry.");
	}

	/**Scans the database for all available
	 * mapper2author:XX files and tries to
	 * connect them to the author data in
	 * 'knownAuthors'.
	 *
	 * Will create a new author-entry if
	 * there wasn´t one before.
	 *
	 */
	private async fetchMapperData(): Promise<void> {
		const body = await CouchDbService.readView(AuthorRegistry.docScope, "evahelpers", "fetchmapper2authordata");
		body.rows.forEach(doc => {
			const author = this.knownAuthors[doc.key] ? this.knownAuthors[doc.key] : { epalias: "", color: "", mapper2author: "" };
			author.mapper2author = String(doc.value);
		});
	}

	private applyColorFix(colorIndex: number, user: string): string {
		// This is a bug in etherpad: The initially added color is an index for the color palette array of etherpad.
		// This palette mirrors the palette defined in the src/node/db/AuthorManager.js file of the 
		// EtherpadLite source code. See https://github.com/ether/etherpad-lite
		const colorPalette = [
			"#ffc7c7",
			"#fff1c7",
			"#e3ffc7",
			"#c7ffd5",
			"#c7ffff",
			"#c7d5ff",
			"#e3c7ff",
			"#ffc7f1",
			"#ffa8a8",
			"#ffe699",
			"#cfff9e",
			"#99ffb3",
			"#a3ffff",
			"#99b3ff",
			"#cc99ff",
			"#ff99e5",
			"#e7b1b1",
			"#e9dcAf",
			"#cde9af",
			"#bfedcc",
			"#b1e7e7",
			"#c3cdee",
			"#d2b8ea",
			"#eec3e6",
			"#e9cece",
			"#e7e0ca",
			"#d3e5c7",
			"#bce1c5",
			"#c1e2e2",
			"#c1c9e2",
			"#cfc1e2",
			"#e0bdd9",
			"#baded3",
			"#a0f8eb",
			"#b1e7e0",
			"#c3c8e4",
			"#cec5e2",
			"#b1d5e7",
			"#cda8f0",
			"#f0f0a8",
			"#f2f2a6",
			"#f5a8eb",
			"#c5f9a9",
			"#ececbb",
			"#e7c4bc",
			"#daf0b2",
			"#b0a0fd",
			"#bce2e7",
			"#cce2bb",
			"#ec9afe",
			"#edabbd",
			"#aeaeea",
			"#c4e7b1",
			"#d722bb",
			"#f3a5e7",
			"#ffa8a8",
			"#d8c0c5",
			"#eaaedd",
			"#adc6eb",
			"#bedad1",
			"#dee9af",
			"#e9afc2",
			"#f8d2a0",
			"#b3b3e6",
		];
		if (isNaN(colorIndex) || colorIndex < 0 || colorIndex >= colorPalette.length || colorIndex !== Math.ceil(colorIndex)) {
			// invalid colorIndex, will therefore return a fallback color value to avoid having to return "undefined"
			logService.error(AuthorRegistry.name, "invalid color data for user " + user);
			return "#808080";
		}
		return colorPalette[colorIndex];
	}
}

