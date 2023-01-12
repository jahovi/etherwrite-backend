import {Application, Request, Response} from "express";
import Router from "../core/router/router.interface";
import {MoodleUser} from "../core/middleware/moodle-user.middleware";
import {activityService} from "../activity/activity.service";
import {ActivitiesAggregatedEntry} from "../activity/activities-aggregated-entry";
import {OperationsAggregatedEntry} from "../activity/operations-aggregated-entry";
import {authorService} from "../core/authors/author.service";

export class ActivityRouter implements Router {

	private readonly ROUTE: string = "/activity";

	init(app: Application): void {
		app.get(`${this.ROUTE}/activities/:padName`, this.getActivityListOfPad.bind(this));
		app.get(`${this.ROUTE}/activities`, this.getActivityListOfAllPads.bind(this));
		app.get(`${this.ROUTE}/operations/:padName`, this.getOperationListOfPad.bind(this));
	}

	/**
	 * Returns an aggregated list of distinct operations that happened in the given pad.
	 * Requires "padName" as query parameter.
	 */
	private async getActivityListOfPad(req: Request, res: Response) {
		const user: MoodleUser = res.locals.user;
		const padName: string = req.params.padName as string;

		if (!padName) {
			throw new Error("Query parameter \"padName\" is required.");
		}

		if (!authorService.isAllowedToSeePadData(user, padName)) {
			// Unauthorized access, send empty data.
			return res.send([]);
		}

		return res.send(await activityService.getList(padName, user, ActivitiesAggregatedEntry));
	}

	/**
	 * Returns an aggregated list of distinct operations that happened in the given pad.
	 * Requires "padName" as query parameter.
	 */
	private async getActivityListOfAllPads(req: Request, res: Response) {
		const user: MoodleUser = res.locals.user;

		if (!user.isModerator) {
			// Unauthorized access, send empty data.
			return res.send([]);
		}

		return res.send({});
	}

	/**
	 * Returns an aggregated list of distinct operations that happened in the given pad.
	 * Requires "padName" as query parameter.
	 */
	private async getOperationListOfPad(req: Request, res: Response) {
		const user: MoodleUser = res.locals.user;
		const padName: string = req.params.padName as string;
		
		if (!padName) {
			throw new Error("Query parameter \"padName\" is required.");
		}

		if (!authorService.isAllowedToSeePadData(user, padName)) {
			// Unauthorized access, send empty data.
			return res.send([]);
		}

		return res.send(await activityService.getList(padName, user, OperationsAggregatedEntry));
	}
}