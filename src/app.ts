import express, { Application } from "express";
import routers from "./routers";
import Router from "./core/router.interface";
import { ConstructorOf } from "./constructor-of.interface";

const app: Application = express();

const port = process.env.PORT || 8083;

(routers as ConstructorOf<Router>[]).forEach(router => {
	console.info("Registering router: ", router.name);
	new router().init(app);
});

app.listen(port, () => {
	console.log(`EVA is listening on port ${port} !`);
});