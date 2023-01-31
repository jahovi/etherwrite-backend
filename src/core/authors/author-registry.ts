import DbChange from "../../websocket/dbchange.interface";
import AuthorData from "../changeset-service/global-author.interface";
import CouchDbService from "../couch/couch-db.service";
import LogService from "../log/log.service";
import { Subject } from "../subscriber/subject";
import { Author } from "./author.interface";

export default class AuthorRegistry extends Subject<Record<string, Author>>{



	public getSubjectData(): Record<string, Author> {
		return this.knownAuthors;
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

	public static getInstance(): AuthorRegistry {
		if (!this.instance) {
			this.instance = new AuthorRegistry();
		}
		return this.instance;
	}


	private constructor() {
		super();
		this.init();
	}

	private async init() {
		CouchDbService.subscribeChanges(AuthorRegistry.docScope, (change: DbChange) => {
			const doc = change.doc as AuthorData
			if (doc._id && doc.value) {
				let newData = false;
				const authorID = doc._id.substring(13);
				if (!this.knownAuthors[authorID]) {
					this.knownAuthors[authorID] = { epalias: doc.value.name, color: doc.value.colorId, mapper2author: "" };
					newData = true;
				} else {
					if (this.knownAuthors[authorID].color !== doc.value.colorId) {
						this.knownAuthors[authorID].color = doc.value.colorId;
						newData = true;
					}
					this.knownAuthors[authorID].epalias = doc.value.name;
				}
				if (newData) {
					this.notifySubscribers();
				}
			}
		},
		{
			selector: {
				_id: {
					$gt: "globalAuthor:",
					$lt: "globalAuthor;",
				},
			},
			includeDocs: true,
		});
		CouchDbService.subscribeChanges(AuthorRegistry.docScope, (change: DbChange) => {
			const doc = change.doc as { _id: string, value: string };
			if (doc._id && (doc.value as unknown) instanceof String) {
				let newData = false;
				const authorID = doc.value;
				if (!this.knownAuthors[authorID]) {
					this.knownAuthors[authorID] = { epalias: "", color: "", mapper2author: doc._id.substring(14) };
					newData = true;
				} else {
					if (this.knownAuthors[authorID].mapper2author !== doc._id.substring(14)) {
						this.knownAuthors[authorID].mapper2author = doc._id.substring(14);
						newData = true;
					}
				}
				if (newData) {
					this.notifySubscribers();
				}
			}
		},
		{
			selector: {
				_id: {
					$gt: "mapper2author:",
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
}

