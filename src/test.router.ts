import {Application, Request, Response} from "express";
import Router from "./core/router/router.interface";

export default class TestRouter implements Router {

	private ROUTE = "/test";

	init(app: Application): void {
		app.get(this.ROUTE, this.getTest);
	}

	getTest(_req: Request, res: Response): void {
		res.status(200)
			.send(true);
	}
}