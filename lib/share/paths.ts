import { homedir } from "node:os";
import { join } from "node:path";
import { stateDir } from "../sandbox/util";

/** Server identity and the ticket key: in SPARKFLOW_HOME, outside the apps folder (which may be synced). */
export const shareHome = () => join(process.env.SPARKFLOW_HOME ?? join(homedir(), ".sparkflow"), "share");

/** Invites, members and guest keys, beside the projects' history. */
export const sharingFile = () => join(stateDir(), "sharing.json");
