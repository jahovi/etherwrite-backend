import nano, {DocumentScope, DocumentViewParams, DocumentViewResponse} from "nano";
import logService from "../log/log.service";
import {MaybeRevisionedViewDocument} from "./maybe-revisioned-view-document.type";

/**
 * Service for communication with the Couch DB server.
 */
export class CouchDbService {

	/**
	 * Retrieve a connection to the given database. Credentials are to be found in the environment.
	 * @param db The database name.
	 * @return a connection to the database.
	 */
	public getConnection(db: string): DocumentScope<any> {
		const dbuser: string = process.env.COUCH_DB_USER ?? "somename";
		const dbpassword: string = process.env.COUCH_DB_PWD ?? "password";
		const host: string = process.env.COUCH_DB_HOST ?? "localhost";
		const port: string = process.env.COUCH_DB_PORT ?? "5984";
		const serverScope = nano(`http://${dbuser}:${dbpassword}@${host}:${port}`);

		return serverScope.use(db);
	}

	/**
	 * Retrieves a document with the given id. If it doesn't exist, the resulting error will be sucked up and instead, _undefined_ will be returned.
	 * @param db The database connection to work with.
	 * @param docId The id of the wanted document.
	 * @return a promise of a document if there is one, _undefined_ otherwise.
	 */
	public async getIfExists<D>(db: DocumentScope<any>, docId: string): Promise<D | undefined> {
		try {
			// eslint-disable-next-line @typescript-eslint/ban-ts-comment
			// @ts-ignore – we only work with view documents here, so we can assume that this is one.
			return await db.get(docId);
		} catch (e) {
			return undefined;
		}
	}

	/**
	 * Inserts the given document to the database. Only works if the document does not exist yet. In this case, use {@link delete} before.
	 * @param db The database connection to work with.
	 * @param document The document to insert.
	 */
	public async insert<D>(db: DocumentScope<D>, document: MaybeRevisionedViewDocument<D>): Promise<boolean> {
		try {
			await db.insert(document);
			return true;
		} catch (e: any) {
			logService.exception(CouchDbService.name, "Cannot put document: " + e.message, e);
			return false;
		}
	}

	/**
	 * Deletes the given document in the database. The document must have a _rev, otherwise it would not be an existing document.
	 * @param db The database connection to work with.
	 * @param document The document to delete.
	 */
	public async delete(db: DocumentScope<any>, document: MaybeRevisionedViewDocument<any>): Promise<void> {
		if (!document._rev) {
			throw new Error(`Document ${document._id} does not have a _rev, so it doesn't seem to exist.`);
		}

		try {
			await db.destroy(document._id, document._rev);
		} catch (e: any) {
			logService.exception(CouchDbService.name, "Cannot delete document: " + e.message, e);
		}
	}

	/**
	 * Retrieves the result of the given view in the given design document.
	 * @param db The database connection to work with.
	 * @param document The document to request.
	 * @param view The view inside the document to request.
	 */
	public async readView(db: DocumentScope<any>, document: string, view: string, params: DocumentViewParams = {}): Promise<DocumentViewResponse<any, any>> {
		return new Promise((resolve, reject) => {
			db.view(document, view, params, async (err, body) => {
				if (err) {
					reject(err);
				} else {
					resolve(body);
				}
			});
		});
	}
}

export default new CouchDbService();