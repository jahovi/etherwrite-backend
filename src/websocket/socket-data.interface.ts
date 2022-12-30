/**
 * Describes the structure of the data property of sockets opened through the fronted Communication method.
 */
export default interface SocketData {
	userId: string;
	epGroup: string;
	padName: string;
	isModerator: boolean;
	epAuthorId: string;
}