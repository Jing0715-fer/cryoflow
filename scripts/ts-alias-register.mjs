/** t523 — registers the alias hook (see ts-alias-hook.mjs for the why).
 *  Usage:  node --import ./scripts/ts-alias-register.mjs <script.mjs> */
import { register } from "node:module";
import { pathToFileURL } from "node:url";

register(pathToFileURL(new URL("./ts-alias-hook.mjs", import.meta.url).pathname));
