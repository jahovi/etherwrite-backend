/* eslint-disable no-mixed-spaces-and-tabs */
import { Application, Request, Response } from "express";
import Router from "./core/router/router.interface";
import logService from "./core/log/log.service";
import ChangesetProcessor from "./core/list-service/changeset-processor";
import PadRegistry from "./pads";

export default class AuthorBlocksRouter implements Router {

	private ROUTE = "/getBlockInfo";

	init(app: Application): void {
		app.get(this.ROUTE, this.getInfo);
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
	async getInfo(_req: Request, res: Response): Promise<void> {
		const padName = _req.query["padName"] ? _req.query["padName"] : "";
		const csproc = ChangesetProcessor.instanceRegistry[padName.toString()];
		if (!csproc) {
			// padName apparently unknown
			logService.info( AuthorBlocksRouter.name,"could not deliver block info for padName '"+padName+"' to "+_req.ip);

			// maybe there is new pad in the database? let´s check...
			PadRegistry.initAndUpdate();

			res.status(404).send([]);
			return;
		}
		// just for debugging ...
		if(_req.query["testdata"]=="1"){
			res.status(200).send(csproc.getTextFromList());
			return;
		}
		if(_req.query["del"]=="1"){
			csproc.clearList();
			res.status(200).send("deleting list");
			return;
		}

		const list = csproc.getAuthorBlockList();
		logService.debug(AuthorBlocksRouter.name, "delivered block info for padName '"+padName+"' to "+_req.ip);
		res.status(200).send(list);
	}
}
