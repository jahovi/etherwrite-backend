import {Application, Request, Response} from "express";
import Router from "./core/router/router.interface";
import couchDbService from "./core/couch/couch-db.service";
import logService from "./core/log/log.service";

export default class DBTestRouter implements Router {

	private ROUTE = "/dbtest";

	init(app: Application): void {
		app.get(this.ROUTE, this.getTest);
	}

	async getTest(_req: Request, res: Response): Promise<void> {
		const parameters = _req.query;

		if ("dbname" in parameters && parameters["dbname"] != null) {
			try {
				const db = await couchDbService.getConnection(parameters["dbname"].toString());
				const info = await db.info();
				res.status(200).send(JSON.stringify(info));
			} catch (error) {
				const message = "no db '" + parameters["dbname"] + "' found";
				logService.warn(this.ROUTE, message);
				res.status(404).send(message);
			}
		} else {
			res.status(404)
				.send(false);
		}
	}
}