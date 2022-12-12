import {ActivityDataEntry, ActivityType} from "./activity-data-entry.interface";
import {AggregatedEntry} from "./abstract-aggregated-entry";
import {MoodleUser} from "../core/middleware/moodle-user.middleware";

export class OperationsAggregatedEntry extends AggregatedEntry<OperationsAggregatedEntry> {
	public authorToOperations: Record<string, {
		[ActivityType.WRITE]?: number;
		[ActivityType.EDIT]?: number;
		[ActivityType.PASTE]?: number;
		[ActivityType.DELETE]?: number;
	}>;

	constructor(timestamp: Date) {
		super(timestamp);
		this.authorToOperations = {};
	}

	/**
	 * Adds the given raw data entry to the already aggregated data in this object.
	 * @param entry The entry to add.
	 */
	public addEntry(entry: ActivityDataEntry) {
		this.authorToOperations[entry.author] = this.authorToOperations[entry.author] || {};
		this.authorToOperations[entry.author][entry.type] = (this.authorToOperations[entry.author][entry.type] || 0) + 1;
	}

	/**
	 * Adds the given aggregated data entry to the already aggregated data in this object.
	 * @param entry The entry to add.
	 */
	public addAggregatedEntry(entry: OperationsAggregatedEntry): void {
		Object.entries(entry.authorToOperations)
			.forEach(([author, activities]) => {
				if (!this.authorToOperations[author]) {
					this.authorToOperations[author] = {};
				}
				Object.values(ActivityType).forEach(type => {
					this.authorToOperations[author][type] = (this.authorToOperations[author][type] || 0) + (activities[type] || 0);
				})
			});
	}

	/**
	 * Creates a JSON object from the data in this object.
	 * @param user The user requesting the data.
	 * @param includeHours If true, the timestamp will include the hour, otherwise just the date.
	 */
	public toJSON(user: MoodleUser, includeHours = false) {
		let authorToOperations;
		if (user.isModerator) {
			authorToOperations = this.authorToOperations;
		} else {
			authorToOperations = Object.entries(this.authorToOperations)
				.reduce((result: any, current) => {
					if (current[0] === String(user.epAuthorId)) {
						result[current[0]] = current[1];
					} else {
						if (!result["others"]) {
							result["others"] = {};
						}
						Object.values(ActivityType).forEach(type => {
							result["others"][type] = (result["others"][type] || 0) + (current[1][type] || 0);
						});
					}

					return result;
				}, {});
		}
		return {
			...super.toJSON(user, includeHours),
			authorToOperations,
		}
	}
}
