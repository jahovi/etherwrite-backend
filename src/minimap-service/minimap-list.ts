import BasicList from "../core/changeset-service/basic-list";
import MinimapMeta from "./minimap-meta";

/**
 * This is a customized list to fit the needs of the minimap service.
 */
export default class MinimapList extends BasicList<MinimapMeta> {

	/**
	 * Changes the metadata of the node behind
	 * the 'current' pointer.
	 * @param meta
	 */
	public changeAttributesOfNextChar(meta: MinimapMeta) {
		this.moveFwd(1);
		this.current.meta.headingStart = meta.headingStart;
		this.current.meta.ignoreColor = meta.ignoreColor;
	}

	public printDebug() {
		let output = "";
		let runner = this.head;
		while (runner.next) {
			if (runner.content == "*" && runner.meta.headingStart) {
				output += "#" + runner.meta.headingStart + "#";
			} else {
				if (runner.content == "\n") {
					output += "|";
				}
				if (runner.meta.ignoreColor) {
					output += "=";
				} else {
					output += runner.content;
				}
			}
			runner = runner.next;
		}
		output += this.tail.content;
		console.log(output);
	}

}