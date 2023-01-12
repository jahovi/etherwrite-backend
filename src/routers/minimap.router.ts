import Router from "../core/router/router.interface";
import {Application, Request, Response} from "express";
import logService from "../core/log/log.service";
import PadRegistry from "../pads";
import TrackingService from "../core/tracking-service/tracking-service";
import MinimapService from "../minimap-service/minimap-service";


export default class MinimapRouter implements Router {

	private ROUTE = "/minimap";

	init(app: Application): void {
		app.get(this.ROUTE + "/blockInfo", this.getBlockInfo);
		app.get(this.ROUTE + "/scrollPositions", this.getScrollPositions);
	}


	/**Delivers the latest block list that the
	 * corresponding ChangesetProcessor contains.
	 *
	 * The block list that the client is NOT guaranteed
	 * to be congruent to the current status within the
	 * etherpad text editor.
	 *
	 * However internally a call to this endpoint will
	 * trigger an update and when the same client calls
	 * again a few seconds later he then will receive a
	 * newer version of the block list.
	 *
	 * @param _req
	 * @param res
	 * @returns
	 */
	async getBlockInfo(_req: Request, res: Response): Promise<void> {
		const padName = _req.query["padName"];
		if (!padName) {
			res.status(400).send("Query parameter \"padName\" is required.");
			return;
		}
		const mmproc = MinimapService.instances[padName.toString()];
		if (!mmproc) {
			// padName apparently unknown
			logService.info(MinimapRouter.name, "could not deliver block info for padName '" + padName + "' to " + _req.ip);

			// maybe there is new pad in the database? let´s check...
			PadRegistry.initAndUpdate();

			res.status(404).send([]);
			return;
		}
		logService.debug(MinimapRouter.name, "delivered block info for padName '" + padName + "' to " 
		+ _req.ip + "("+JSON.stringify(mmproc.minimapBlocklist).length + " chars of JSON data)");
		res.status(200).send(mmproc.minimapBlocklist);
	}

	/**
	 *	required parameter: "padName" - the name of the pad
	 *	Delivers the most recent scroll positions as recorded
	 *	by the ep-tracking module.
	 */
	async getScrollPositions(_req: Request, res: Response) {
		const pad = _req.query["padName"] as string;
		if (!TrackingService.instanceRegistry[pad]) {
			await PadRegistry.initAndUpdate();
		}
		const tService = TrackingService.instanceRegistry[pad];
		if (tService) {
			res.status(200).send(tService.miniMapScrollPositions);
		} else {
			res.status(404).send({});
		}
	}
}