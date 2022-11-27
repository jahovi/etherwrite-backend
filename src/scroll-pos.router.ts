import { Application, Request, Response } from "express";
import Router from "./core/router/router.interface";
import TrackingService from "./core/tracking-service/tracking-service";
import PadRegistry from "./pads";

/**
 * Endpoint: "/getScrollPos"
 * required parameter: "padName" - the name of the pad
 * Delivers the most recent scroll positions as recorded
 * by the ep-tracking module. 
 */
export default class ScrollPosRouter implements Router {

	private ROUTE = "/getScrollPos";

	init(app: Application): void {
		app.get(this.ROUTE, this.getData);
	}

	getData(_req: Request, res: Response){
		const pad = _req.query["padName"] as string;
		if (!TrackingService.instanceRegistry[pad]) {
			PadRegistry.initAndUpdate();
		}
		const tService = TrackingService.instanceRegistry[pad];
		if (tService)
			res.status(200).send(tService.miniMapScrollPositions);
		else
			res.status(404).send({});

	}

}

