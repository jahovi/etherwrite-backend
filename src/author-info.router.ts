/* eslint-disable no-mixed-spaces-and-tabs */
import { Application, Request, Response } from "express";
import Router from "./core/router/router.interface";
import logService from "./core/log/log.service";
import AuthorRegistry from "./author-registry";


export default class AuthorInfoRouter implements Router {

	private ROUTE = "/getAuthorInfo";

	init(app: Application): void {
		app.get(this.ROUTE, this.getInfo);
	}

	async getInfo(_req: Request, res: Response): Promise<void> {
		logService.debug(AuthorInfoRouter.name, "delivered author info to "+_req.ip);
		res.status(200).send(AuthorRegistry.knownAuthors);
	}
}
