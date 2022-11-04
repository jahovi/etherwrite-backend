import {Application} from "express";

export default interface Router {

    /**
     * Initializes the router by registering all routes.
     *
     * @param app the express application.
     */
    init(app: Application): void;

}