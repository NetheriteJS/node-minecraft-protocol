### Auth providers

This is a folder for auth providers, which is exported as class (see below).

```ts
interface Session {
	accessToken?: string;
	displayName?: string;
	selectedProfile?: { id?: string, name?: string };
}

interface Credentials {
	accessToken?: string;
	username?: string;
	password?: string;
	clientToken?: string;
}

interface ServerInfo {
	serverId: string,
	sharedSecret: Buffer,
	serverKey: Buffer
}

export class ExampleAuthProvider {
	credentials: Credentials;
	session: Session;
	/**
	 * Both client and server options are passed (but can be empty)
	 * @example Server({...defaults, ...serverOptions})
	 */
	constructor (clientOptions: Object, serverOptions: Object);

	/**
	 * Login using username+password pair with clientToken
	 * @throws on auth error
	 */
	async clientAuth (credentials?: Credentials): Session;
	/**
	 * Login using token
	 * Needs only accessToken to be specified
	 * @throws on auth error
	 */
  	async clientAuthToken (credentials?: Credentials): Session;
	/**
	 * Login using credentials in launcher_profiles.json
	 * Needs only username to be specified
	 * @throws on auth error
	 */
	async clientAuthProfile (credentials?: Credentials): Session;

	/**
	 * (Client-only) Joins a server
	 * @throws on network error
	 */
	async serverJoin (session?: Session, server: ServerInfo): void;
	/**
	 * (Server-only) Verifes a player session
	 * @throws if player session is invalid
	 */
	async serverConfirm (username: String, server: ServerInfo): void;
}
```