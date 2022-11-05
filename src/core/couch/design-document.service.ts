import couchDbService from "./couch-db.service";
import {DocumentInfer, DocumentScope, ViewDocument} from "nano";
import {MaybeRevisionedViewDocument} from "./maybe-revisioned-view-document.type";
import logService from "../log/log.service";

/**
 * Static service
 */
export class DesignDocumentService {

	private static readonly DOCS: ViewDocument<any>[] = [];

	/**
	 * Register a document. Should be called
	 * @param doc
	 */
	public static register(doc: ViewDocument<any>): void {
		this.DOCS.push(doc);
	}

	public async registerAllDocuments(): Promise<void> {
		const db: DocumentScope<any> = couchDbService.getConnection("etherpad");

		const promises = DesignDocumentService.DOCS
			.map(doc => this.createOrUpdateDesignDocument(doc, db));

		await Promise.all(promises);

		logService.info(DesignDocumentService.name, "All design documents up to date!");
	}

	private async createOrUpdateDesignDocument(document: MaybeRevisionedViewDocument<any>, db: DocumentScope<any>): Promise<void> {
		const id = document._id;

		const newDocument: MaybeRevisionedViewDocument<any> = {
			_id: id,
			views: {},
		};

		Object.entries(document.views).forEach(([viewName, view]) => {
			const viewBody: any = {}
			if (view.map) {
				viewBody.map = this.stringifyFunction(view.map);
			}
			if (view.reduce) {
				viewBody.reduce = view.reduce;
			}
			newDocument.views[viewName] = viewBody;
		});

		const existingDocument: MaybeRevisionedViewDocument<any> | undefined = await couchDbService.getIfExists(db, id);
		if (existingDocument) {
			newDocument._rev = existingDocument._rev;
			if (this.stringifyDocument(newDocument) === this.stringifyDocument(existingDocument)) {
				logService.debug(DesignDocumentService.name, `Design document: ${id} – no changes`);
				return Promise.resolve();
			} else {
				logService.debug(DesignDocumentService.name, `Design document: ${id} – deleting old version`);
				await couchDbService.delete(db, existingDocument);
			}
		}
		logService.debug(DesignDocumentService.name, `Design document: ${id} – uploading`);
		await couchDbService.insert(db, document);

		return Promise.resolve();
	}

	private stringifyFunction(fn: string | DocumentInfer<any>): string {
		return fn.toString();
	}

	private stringifyDocument(document: MaybeRevisionedViewDocument<any>): string {
		return JSON.stringify({
			_id: document._id,
			_rev: document._rev,
			views: Object.entries(document.views).reduce((result: any, [viewId, view]) => {
				result[viewId] = {
					map: view.map?.toString(),
					reduce: view.reduce?.toString(),
				};
				return result;
			}, {}),
		});
	}
}

export default new DesignDocumentService();