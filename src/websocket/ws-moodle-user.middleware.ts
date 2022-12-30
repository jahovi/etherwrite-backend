import { Socket } from "socket.io";
import * as jwt from "jsonwebtoken";
import {JwtPayload} from "jsonwebtoken";
import LogService from "../core/log/log.service";
import { MoodleUser } from "../core/middleware/moodle-user.middleware"
import { ExtendedError } from "socket.io/dist/namespace";

/**
 * A port of the existing moodle user middleware for use with websockets.
 * 
 * @param socket The socket on which to execute the function
 * @param next The socket io next function 
 */
export const socketIOmoodleUserMiddleware = function(socket: Socket, next: (err?: ExtendedError) => void): void {
	const token = socket.handshake.auth.token;
	jwt.verify(token as string, "0c26bee8-f114-4a59-ad65-15092de45df9", (err, decoded: JwtPayload | string | undefined) => {
		if (err || !decoded) {
			LogService.error("SocketIO Middleware", "Cannot decode token: " + err?.name);
			socket.disconnect();
		} else {
			socket.data = decoded as MoodleUser;
			next();
		}
	});
}
