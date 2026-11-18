# Cómo se armó la base de alimentos (nov 2026)

## 1. Alimentos genéricos → `js/realfoods.js`
- Fuente: **Tabla de Composición de Alimentos INTA 2018** (PDF escaneado que entregó Joaquín).
- `inta2018-transcripcion.txt`: página;nombre;fuente;kcal;proteína;CHO disp.;fibra;lípidos (por 100 g).
  Fuente según el superíndice de la tabla: 1 USDA, 2 Tabla Chilena (Schmidt-Hebbel), 3 análisis INTA, 4 etiqueta, 6 INTA.
- `gen.py` arma la base: elige una versión por alimento (prefiere 3 > 2 > 6 > 1 > 4), asigna grupo de intercambio,
  calcula la porción, agrega medidas caseras (`medidas.py`, de la Base NT y la tabla de equivalencias INTA) y suma
  los alimentos del USDA que la tabla no trae (`keep_old.py`). Carnes y pescados crudos quedan con "(crudo)".
- Para corregir un valor: editar el .txt y volver a correr `python3 gen.py` (y el bloque que escribe realfoods.js),
  o más simple: el coach sube un CSV con el mismo nombre desde Biblioteca y reemplaza al de la base.

## 2. Productos envasados de Chile → `js/offchile.js`
- Fuente: Open Food Facts (ODbL), copia en Hugging Face (`openfoodfacts/product-database`, food.parquet).
- `off-1-buscar-chile.py` busca las filas con `en:chile` (lee solo esa columna, por rangos HTTP);
  `off-2-descargar.py` baja nombre, marca, nutrientes y porción de esas filas.
- Filtro: deben traer kcal, CHO, lípidos y proteína, y las kcal deben cuadrar con 4·C + 4·P + 9·G (±15 %).
- Resultado nov 2026: 8.135 productos chilenos → 5.076 aceptados.
