import {Application, Request, Response} from "express";
import Router from "../core/router/router.interface";

export class ActivityRouter implements Router {

	private readonly ROUTE: string = "/activity";

	init(app: Application): void {
		app.get(`${this.ROUTE}/list`, this.getActivityList);
	}

	private async getActivityList(req: Request, res: Response) {
		// TODO
	}
}