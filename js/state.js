// Estado global compartido
import { ymd } from "./util.js";
export const S = {
  user: null, role: null, cid: null, client: null, profile: null,
  date: ymd(), route: [], session: null, rest: null
};
let _refresh = () => {};
export const setRefresher = (f) => (_refresh = f);
export const refresh = () => _refresh();
export const go = (hash) => { if (location.hash === "#" + hash) refresh(); else location.hash = hash; };
