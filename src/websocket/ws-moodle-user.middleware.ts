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
	let secretKey = process.env.MOODLE_SECRET_KEY;
	if (!secretKey) {
		const defaultKey = "0c26bee8-f114-4a59-ad65-15092de45df9";
		LogService.error("Middleware", "MOODLE_SECRET_KEY not defined in .env");
		LogService.error("Middleware", "Webtoken encryption uses default key: "+defaultKey)
		secretKey =  defaultKey;
	}
	jwt.verify(token as string, secretKey, (err, decoded: JwtPayload | string | undefined) => {
		if (err || !decoded) {
			LogService.error("SocketIO Middleware", "Cannot decode token: " + err?.name);
			socket.disconnect();
		} else {
			socket.data = decoded as MoodleUser;
			next();
		}
	});
}
