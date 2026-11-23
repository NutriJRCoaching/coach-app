// Audios del cliente al coach. Un documento de Firestore admite ~1 MB, y un audio de buena calidad (64 kbps, 3 min) pesa más:
// se guarda en partes. Doc principal {id} = { data: parte 1, parts: N, ... } y las demás en {id}~p2, {id}~p3…
// Los audios antiguos (una sola parte, sin "parts") se siguen leyendo igual.
import { db } from "./db.js";
const SIZE = 900000;
export async function saveAudio(col, id, data, meta) {
  const parts = Math.max(1, Math.ceil(data.length / SIZE)), old = (await db.get(`${col}/${id}`).catch(() => null))?.parts || 1;
  for (let k = 1; k < parts; k++) await db.set(`${col}/${id}~p${k + 1}`, { data: data.slice(k * SIZE, (k + 1) * SIZE), of: id }, false);
  for (let k = parts; k < old; k++) db.del(`${col}/${id}~p${k + 1}`).catch?.(() => {});
  await db.set(`${col}/${id}`, { ...meta, data: data.slice(0, SIZE), parts }, false); // el principal al final: así nunca queda a medias
}
export async function loadAudio(col, id, main) {
  const a = main || (await db.get(`${col}/${id}`)); if (!a?.data || !(a.parts > 1)) return a;
  const rest = await Promise.all([...Array(a.parts - 1)].map((_, k) => db.get(`${col}/${id}~p${k + 2}`)));
  if (rest.some((x) => !x?.data)) return { ...a, data: "" }; // falta una parte (aún sincronizando)
  return { ...a, data: a.data + rest.map((x) => x.data).join("") };
}
export async function delAudio(col, id) {
  const a = await db.get(`${col}/${id}`).catch(() => null);
  for (let k = 2; k <= (a?.parts || 1); k++) db.del(`${col}/${id}~p${k}`).catch?.(() => {});
  db.del(`${col}/${id}`).catch?.(() => {});
}
