import { createApp } from "./app";
import { remoteKeySet } from "./core/access";

export default createApp({ getKeyFor: (env) => remoteKeySet(env.TEAM_DOMAIN) });
