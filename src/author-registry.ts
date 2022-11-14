import CouchDbService from "./core/couch/couch-db.service";
import AuthorData from "./core/list-service/global-author.interface";

export default class AuthorRegistry {

	/**This list contains the authors 
	 * and their traits.  
	 */
	public static knownAuthors: { [epid: string]: { epalias: string, color: string, mapper2author: string } } = {};
	private static mapperUpdateDelay = 5000;
	private static mapperTimeStamp = 0;

	private static scope = CouchDbService.getConnection("etherpad");

	/** Call only at startup! */
	public static async init() {
		AuthorRegistry.scope.view("evahelpers", "fetchglobalauthors", (err, body) => {
			if (!err) {
				body.rows.forEach((doc) => {
					const authorData = doc.value as { colorId: string, name: string };
					AuthorRegistry.knownAuthors[doc.key] = { epalias: authorData.name, color: authorData.colorId, mapper2author: "" };
				})
			}
		});
		setTimeout(AuthorRegistry.fetchMapperData, 200);
	}

	/**Notify the AuthorRegistry that an author might have been 
	 * recently active. The AuthorRegistry will create an entry 
	 * for this author and/or look for updated data in the database
	 * 
	 * @param authorId the id of a possibly new author
	 */
	public static put(authorId: string): void {
		// do we need to create a new author object?
		if (!AuthorRegistry.knownAuthors[authorId]) {
			AuthorRegistry.knownAuthors[authorId] = { epalias: "", color: "", mapper2author: "" };
		}

		// update aliases and color for this author
		AuthorRegistry.scope.get("globalAuthor:" + authorId)
			.then((data) => {
				if (data) {
					const authorData = data as unknown as AuthorData;
					AuthorRegistry.knownAuthors[authorId].epalias = authorData.value.name;
					AuthorRegistry.knownAuthors[authorId].color = authorData.value.colorId;
					if (AuthorRegistry.knownAuthors[authorId].mapper2author == "")
						this.fetchMapperData();
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
	private static fetchMapperData(): void {
		const timestamp = Date.now();
		if (timestamp < AuthorRegistry.mapperTimeStamp + AuthorRegistry.mapperUpdateDelay) {
			// refusing update if the previous update was not too long ago
			return;
		}
		AuthorRegistry.mapperTimeStamp = timestamp;
		AuthorRegistry.scope.view("evahelpers", "fetchmapper2authordata", (err, body) => {
			if (!err) {
				body.rows.forEach((doc) => {
					const author = AuthorRegistry.knownAuthors[doc.key] ? AuthorRegistry.knownAuthors[doc.key] : { epalias: "", color: "", mapper2author: "" };
					author.mapper2author = String(doc.value);

					if (!author.color) {
						AuthorRegistry.put(doc.key);
					}
				})
			}
		});
	}


}