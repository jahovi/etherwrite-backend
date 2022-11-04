import { Application, Request, Response } from "express";
import Router from "./core/router.interface";
import nano from "nano";

export default class DBTestRouter implements Router {

	private ROUTE = "/dbtest";

	init(app: Application): void {
		app.get(this.ROUTE, this.getTest);
	}

	async getTest(_req: Request, res: Response): Promise<void> {
		const parameters = _req.query;
		const dbuser = "dbuser" in parameters && parameters["dbuser"] != null ? parameters["dbuser"] : "somename";
		const dbpassword = "dbpw" in parameters && parameters["dbpw"] != null ? parameters["dbpw"] : "password";
		const host = "host" in parameters && parameters["host"] != null ? parameters["host"] : "localhost";
		const port = "port" in parameters && parameters["port"] != null ? parameters["port"] : "5984";
		const serverscope = nano("http://" + dbuser + ":" + dbpassword + "@" + host + ":" + port);

		if ("dbname" in parameters && parameters["dbname"] != null) {
			try{
				const db = await serverscope.use(parameters["dbname"].toString());
				const info = await db.info();
				res.status(200).send(JSON.stringify(info));
			}catch(error){
				const message = "no db '"+parameters["dbname"]+ "' found";
				console.warn(message);
				res.status(404).send(message);
			}
		} else {
			res.status(404)
				.send(false);
		}
	}
}