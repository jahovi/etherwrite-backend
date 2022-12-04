import Router from "./core/router/router.interface";
import {Application, Request, Response} from "express";
import ChangesetProcessor from "./core/list-service/changeset-processor";
import logService from "./core/log/log.service";
import PadRegistry from "./pads";
import AuthorRegistry from "./author-registry";
import TrackingService from "./core/tracking-service/tracking-service";

export default class MinimapRouter implements Router {

	private ROUTE = "/minimap";

	init(app: Application): void {
		app.get(this.ROUTE + "/blockInfo", this.getBlockInfo);
		app.get(this.ROUTE + "/authorInfo", this.getAuthorInfo);
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
		const csproc = ChangesetProcessor.instanceRegistry[padName.toString()];
		if (!csproc) {
			// padName apparently unknown
			logService.info(MinimapRouter.name, "could not deliver block info for padName '" + padName + "' to " + _req.ip);

			// maybe there is new pad in the database? let´s check...
			PadRegistry.initAndUpdate();

			res.status(404).send([]);
			return;
		}
		// just for debugging ...
		if (_req.query["testdata"] == "1") {
			res.status(200).send(csproc.getTextFromList());
			return;
		}
		if (_req.query["del"] == "1") {
			csproc.clearList();
			res.status(200).send("deleting list");
			return;
		}
		if (_req.query["testdata"] == "2") {
			res.status(200).send(csproc.getIgnoreColorText());
			return;
		}
		if (_req.query["testdata"] == "3") {
			res.status(200).send(csproc.getAuthorAttribMapping());
			return;
		}
		if (_req.query["testdata"] == "4") {
			res.status(200).send(csproc.authorUNDOAnomalyCounter);
			return;
		}
		if (_req.query["testdata"] == "5") {
			res.status(200).send(csproc.getHeadingTestText());
			return;
		}

		const list = csproc.getAuthorBlockList();
		logService.debug(MinimapRouter.name, "delivered block info for padName '" + padName + "' to " + _req.ip);
		res.status(200).send(list);
	}

	/**
	 * Returns base info about all active authors.
	 */
	async getAuthorInfo(_req: Request, res: Response): Promise<void> {
		logService.debug(MinimapRouter.name, "delivered author info to " + _req.ip);
		res.status(200).send(AuthorRegistry.knownAuthors);
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