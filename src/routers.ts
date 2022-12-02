import DBTestRouter from "./db-test.router";
import TestRouter from "./test.router";
import AuthorBlocksRouter from "./author-blocks.router";
import AuthorInfoRouter from "./author-info.router";
import AuthoringRatiosRouter from "./authoring-ratios.router";
import EtherpadRouter from "./etherpad.router";

export default [
	TestRouter,
	DBTestRouter,
	AuthorBlocksRouter,
	AuthorInfoRouter,
	AuthoringRatiosRouter,
	EtherpadRouter,
];