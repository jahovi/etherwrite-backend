import {Application, Request, Response} from "express";
import Router from "../core/router/router.interface";
import {MoodleUser} from "../core/middleware/moodle-user.middleware";
import {activityService} from "../activity/activity.service";
import {ActivitiesAggregatedEntry} from "../activity/activities-aggregated-entry";
import {OperationsAggregatedEntry} from "../activity/operations-aggregated-entry";

export class ActivityRouter implements Router {

	private readonly ROUTE: string = "/activity";

	init(app: Application): void {
		app.get(`${this.ROUTE}/activities`, this.getActivityList.bind(this));
		app.get(`${this.ROUTE}/operations`, this.getOperationList.bind(this));
	}

	/**
	 * Returns an aggregated list of distinct operations that happened in the given pad.
	 * Requires "padName" as query parameter.
	 */
	private async getActivityList(req: Request, res: Response) {
		const user: MoodleUser = res.locals.user;
		const padName: string = req.query.padName as string;

		if (!padName) {
			throw new Error("Query parameter \"padName\" is required.");
		}

		if (!user.isModerator && user.padName !== padName) {
			// Unauthorized access, send empty data.
			return res.send([]);
		}

		return res.send(await activityService.getList(padName, user, ActivitiesAggregatedEntry));
	}

	/**
	 * Returns an aggregated list of distinct operations that happened in the given pad.
	 * Requires "padName" as query parameter.
	 */
	private async getOperationList(req: Request, res: Response) {
		const user: MoodleUser = res.locals.user;
		const padName: string = req.query.padName as string;

		if (!padName) {
			throw new Error("Query parameter \"padName\" is required.");
		}

		if (!user.isModerator && user.padName !== padName) {
			// Unauthorized access, send empty data.
			return res.send([]);
		}

		return res.send(await activityService.getList(padName, user, OperationsAggregatedEntry));
	}
}