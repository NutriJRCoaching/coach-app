// Plan de ejemplo para el registro propio de Joaquín (19-nov-2026): para ver cómo se ve "Mi plan" con 4 alternativas.
// Se carga una sola vez en su vista de cliente si aún no tiene opciones. Pauta ≈ P 120 · C 380 · G 60 (≈ 2.500 kcal).
// Formato: [tiempo de comida, hora, [[alimento de la base de intercambio, porciones], ...]]
import { INTERCAMBIO } from "./intercambio.js";

export const JR_PAUTA = { "Cereales": 8, "Verduras generales": 2, "Verduras libre consumo": 2, "Frutas": 4, "Lácteos altos en grasa": 1, "Lácteos bajos en grasa": 2, "Carnes magras": 6, "Aceites y grasas": 1, "Alimentos ricos en lípidos": 1, "Azúcar": 3 };

const OPTS = [
  ["Entreno AM", "Día que entrenas temprano: el desayuno es tu pre entreno y la colación AM tu post entreno.", [
    ["Desayuno · pre entreno", "06:30", [["Avena", 2], ["Plátano", 1], ["Leche Descremada", 1], ["Miel de abeja", 2]]],
    ["Colación AM · post entreno", "09:30", [["Pan integral molde", 2], ["Huevo entero", 2], ["Queso gouda", 1], ["Kiwi", 1]]],
    ["Almuerzo", "13:30", [["Arroz cocido", 2], ["Pollo cocido", 3], ["Tomate crudo", 1], ["Lechuga", 1], ["Aceite de oliva", 0.5]]],
    ["Once", "17:30", [["Yogurt descremado", 1], ["Avena", 1], ["Frutilla", 1], ["Miel de abeja", 1]]],
    ["Cena", "21:00", [["Papa cocida o cruda", 1], ["Posta negra", 1], ["Brócoli cocido", 1], ["Pepino", 1], ["Aceite de oliva", 0.5], ["Palta (grasa)", 1], ["Manzana", 1]]]]],
  ["Entreno PM", "Día que entrenas en la tarde: la once es tu pre entreno y la cena tu post entreno.", [
    ["Desayuno", "08:00", [["Pan integral molde", 2], ["Huevo entero", 2], ["Palta (grasa)", 1], ["Naranja", 1]]],
    ["Colación AM", "11:00", [["Yogurt descremado", 1], ["Manzana", 1], ["Galletas de Arroz", 1]]],
    ["Almuerzo", "14:00", [["Fideos cocidos", 2], ["Carne molida (tártaro)", 3], ["Tomate crudo", 1], ["Lechuga", 1], ["Aceite de oliva", 0.5]]],
    ["Once · pre entreno", "17:30", [["Avena", 2], ["Plátano", 1], ["Leche Descremada", 1], ["Miel de abeja", 3]]],
    ["Cena · post entreno", "21:00", [["Arroz cocido", 1], ["Pollo cocido", 1], ["Queso gouda", 1], ["Brócoli cocido", 1], ["Pepino", 1], ["Aceite de oliva", 0.5], ["Kiwi", 1]]]]],
  ["Con legumbres", "Día con legumbres: 2 porciones menos de cereales, 2 menos de carnes y 2 de legumbres.", [
    ["Desayuno", "08:00", [["Avena", 2], ["Plátano", 1], ["Leche Descremada", 1], ["Miel de abeja", 2]]],
    ["Colación AM", "11:00", [["Pan integral molde", 1], ["Jamón de pavo", 1], ["Queso gouda", 1], ["Mandarina", 1]]],
    ["Almuerzo", "14:00", [["Lenteja cocida", 2], ["Arroz cocido", 1], ["Zanahoria cruda", 1], ["Lechuga", 1], ["Aceite de oliva", 0.5], ["Naranja", 1]]],
    ["Once", "17:30", [["Pan integral molde", 1], ["Mantequilla de Maní", 1], ["Yogurt descremado", 1], ["Frutilla", 1], ["Miel de abeja", 1]]],
    ["Cena", "21:00", [["Papa cocida o cruda", 1], ["Pollo cocido", 3], ["Tomate crudo", 1], ["Pepino", 1], ["Aceite de oliva", 0.5]]]]],
  ["Entreno · 4 comidas", "Día de entrenamiento con 4 comidas más contundentes: el desayuno es tu pre entreno y el almuerzo tu post entreno.", [
    ["Desayuno · pre entreno", "07:00", [["Avena", 2], ["Plátano", 1], ["Frutilla", 1], ["Leche Descremada", 1], ["Miel de abeja", 2]]],
    ["Almuerzo · post entreno", "12:00", [["Arroz cocido", 3], ["Pollo cocido", 3], ["Tomate crudo", 1], ["Lechuga", 1], ["Aceite de oliva", 0.5], ["Naranja", 1]]],
    ["Once", "17:00", [["Pan integral molde", 2], ["Huevo entero", 2], ["Queso gouda", 1], ["Palta (grasa)", 1], ["Yogurt descremado", 1], ["Miel de abeja", 1]]],
    ["Cena", "21:00", [["Papa cocida o cruda", 1], ["Posta negra", 1], ["Brócoli cocido", 1], ["Pepino", 1], ["Aceite de oliva", 0.5], ["Manzana", 1]]]]]
];

export function jrPlan() {
  const idx = new Map(INTERCAMBIO.map((r) => [r[0].toLowerCase(), r]));
  const item = ([name, por]) => {
    const r = idx.get(name.toLowerCase()); if (!r) return { name, cat: "", por: null, gp: null, g: 0, medida: "", medidaG: null };
    const [n, cat, medida, gp] = r;
    return { name: n, cat, por, gp, g: Math.round(por * gp * 10) / 10, medida, medidaG: gp };
  };
  const menus = OPTS.map(([name, note, meals], k) => ({ id: "jr-ej-" + (k + 1), name, note, meals: meals.map(([m, time, items]) => ({ name: m, time, items: items.map(item) })) }));
  return { menus, pauta: JR_PAUTA };
}
