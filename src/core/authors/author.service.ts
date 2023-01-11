import {MoodleUser} from "../middleware/moodle-user.middleware";

class AuthorService {

	/**
	 * Returns if the given user is allowed to see the pade with the given name.
	 *
	 * @param user The user to check.
	 * @param padName The padName which is requested.
	 */
	public isAllowedToSeePadData(user: MoodleUser, padName: string): boolean {
		return !!user.editorInstances.find(editor => editor.padName === padName);
	}
}

export const authorService: AuthorService = new AuthorService();