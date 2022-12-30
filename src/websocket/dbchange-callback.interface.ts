import DbChange from "./dbchange.interface";

/**
 * Describes functions to be registers as callbacks for db changes.
 */
export default interface dbChangeCallback {
	(change: DbChange): void;
}