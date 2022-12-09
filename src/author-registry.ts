import CouchDbService from "./core/couch/couch-db.service";
import AuthorData from "./core/changeset-service/global-author.interface";
import LogService from "./core/log/log.service";

export default class AuthorRegistry {

	/**This list contains the authors
	 * and their traits.
	 */
	public static knownAuthors: { [epid: string]: { epalias: string, color: string, mapper2author: string } } = {};

	/* This helps to protect the 'put' method from overheating*/
	private static authorTimers: {[epid:string]:number} = {};
	private static mapperUpdateDelay = 5000;
	private static mapperTimeStamp = 0;

	private static scope = CouchDbService.getConnection("etherpad");

	/** Call only at startup! */
	public static async init() {
		const globalAuthors = await CouchDbService.readView(AuthorRegistry.scope, "evahelpers", "fetchglobalauthors");
		globalAuthors.rows.forEach(doc => {
			const authorData = doc.value as { colorId: string, name: string };
			AuthorRegistry.knownAuthors[doc.key] = {epalias: authorData.name, color: authorData.colorId, mapper2author: ""};
		})
		await AuthorRegistry.fetchMapperData();
		LogService.info(AuthorRegistry.name, "Initialised author registry.");
	}

	/**Notify the AuthorRegistry that an author might have been
	 * recently active. The AuthorRegistry will create an entry
	 * for this author and/or look for updated data in the database
	 *
	 * @param authorId the id of a possibly new author
	 */
	public static put(authorId: string): void {
		const timestamp = Date.now();
		if(timestamp < AuthorRegistry.authorTimers[authorId]+AuthorRegistry.mapperUpdateDelay){
			// refusing update if the previous update was not too long ago
			return;
		}
		if (!AuthorRegistry.knownAuthors[authorId]) {
			AuthorRegistry.knownAuthors[authorId] = {epalias: "", color: "", mapper2author: ""};
			AuthorRegistry.authorTimers[authorId] = timestamp;
		}
		AuthorRegistry.authorTimers[authorId] = timestamp;
		console.log("updating "+authorId);
		// update aliases and color for this author
		CouchDbService.getIfExists(AuthorRegistry.scope, "globalAuthor:" + authorId)
			.then(data => {
				if (data) {
					const authorData = data as AuthorData;
					AuthorRegistry.knownAuthors[authorId].epalias = authorData.value.name;
					AuthorRegistry.knownAuthors[authorId].color = authorData.value.colorId;
					if (AuthorRegistry.knownAuthors[authorId].mapper2author == "") {
						this.fetchMapperData();
					}
				}
			});
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
	private static async fetchMapperData(): Promise<void> {
		const timestamp = Date.now();
		if (timestamp < AuthorRegistry.mapperTimeStamp + AuthorRegistry.mapperUpdateDelay) {
			// refusing update if the previous update was not too long ago
			return;
		}
		AuthorRegistry.mapperTimeStamp = timestamp;
		const body = await CouchDbService.readView(AuthorRegistry.scope, "evahelpers", "fetchmapper2authordata");
		body.rows.forEach(doc => {
			const author = AuthorRegistry.knownAuthors[doc.key] ? AuthorRegistry.knownAuthors[doc.key] : {epalias: "", color: "", mapper2author: ""};
			author.mapper2author = String(doc.value);

			if (!author.color) {
				AuthorRegistry.put(doc.key);
			}
		});
	}
}