import { AuthoringRatios } from "./authoring-ratios.type";

/**
 * Takes authoring ratios and returns an object containing the current user's ratio
 * and an aggregate ratio equalling the sum of the ratios of the other users.
 *
 * @param authoringRatios as returned by the AuthoringRatios calculator
 * @param usersMoodleId the moodle id of the current user
 * @returns aggregated authoring ratios
 */

export default function aggregateRatiosOfOtherUsers(authoringRatios: AuthoringRatios, usersMoodleId: string) {
	const numberOfUsers = authoringRatios.ratios.length;
	if (numberOfUsers === 0) {
		return {
			authors: [],
			moodleIDs: [],
			ratios: [],
			colors: [],
		};
	}

	const userIndex = authoringRatios.moodleIDs.indexOf(usersMoodleId); // index of the current users data in the authors, moodleIDs, ratios, colors arrays
	let aggregateRatioOfOtherUsers = 0;
	for (let i = 0; i < numberOfUsers; i++) {
		if (i !== userIndex) {
			// sum authoring ratios of other users
			aggregateRatioOfOtherUsers += authoringRatios.ratios[i];
		}
	}
	const currentUserAuthor = authoringRatios.authors[userIndex];
	const currentUserColor = authoringRatios.colors[userIndex];
	const currentUserRatio = authoringRatios.ratios[userIndex];
	const colorBlueGray = "#647C90";
	const colorBrownGray = "#746C70"
	const otherUsersColor = (currentUserColor !== colorBlueGray) ? colorBlueGray : colorBrownGray; // Have a fallback color in case the user has picked the one

	if (userIndex === 0 && numberOfUsers === 1) {
		// Only me
		return {
			authors: [currentUserAuthor],
			moodleIDs: [usersMoodleId],
			ratios: [currentUserRatio],
			colors: [currentUserColor],
		};
	}

	if (userIndex === -1) {
		// no ratio for current user since they haven't written anything
		return {
			authors: [`${numberOfUsers} Andere`],
			moodleIDs: [null],
			ratios: [aggregateRatioOfOtherUsers],
			colors: [otherUsersColor],
		}
	}

	return {
		authors: [currentUserAuthor, `${numberOfUsers - 1} Andere`],
		moodleIDs: [usersMoodleId, null],
		ratios: [currentUserRatio, aggregateRatioOfOtherUsers],
		colors: [currentUserColor, otherUsersColor],
	}
}