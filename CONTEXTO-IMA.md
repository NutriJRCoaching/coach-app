# CONTEXTO-IMA — léelo primero

Resumen para retomar el desarrollo en un chat nuevo sin el historial. Actualizado: 23-nov-2026, versión **1.42.0**.

## Qué es
**IMA · Inteligencia Muscular Aplicada** (antes "Team JR"). Es la app de coaching de Joaquín Rojas (nutricionista y coach online), inspirada en tracked.gg.
- **Clientes:** la usan en el celular (PWA instalable desde Chrome).
- **Coach:** usa el panel de escritorio.
- **Él mismo** también la usa como cliente, con la opción "Mi registro (vista cliente)".
- **Sin conexión:** funciona offline y sincroniza al volver la señal.
- **Costo:** todo con planes gratuitos, no usar servicios pagados.

- App: https://nutrijrcoaching.github.io/coach-app/
- Repositorio: `NutriJRCoaching/coach-app` (rama main). GitHub Pages publica solo al hacer push.
- Copia local en su PC: `~/OneDrive/Escritorio/Claudio App/App (código)/` (sincronizar a mano tras los cambios).
- Firebase: proyecto `jr-coach` (plan Spark; Firestore en nam5; Auth con correo/contraseña).

## Stack
- JS vanilla con módulos ES, **sin compilación**. Enrutado por hash (`#inicio`, `#comida`, `#coach/...`).
- Acciones por delegación: `data-a="nombre"` para clic, y `data-a-change` / `data-a-input`, más el registro `act("nombre", fn)` (en ui.js).
- Firebase v10.12.2 desde gstatic, con `persistentLocalCache` (offline). Las escrituras **no se esperan**.
- Modo demo: si `apiKey` está vacío usa IndexedDB local. La copia de pruebas está en /tmp/demoapp con `apiKey: ""`.
- `sw.js`: red primero y caché de respaldo. **Cada versión: subir `VERSION` en sw.js y `appVersion` en js/config.js.** El aviso "Nueva versión disponible" sale cuando cambia sw.js.
- Íconos con `?v=ima2` para romper el caché.

## Archivos
| Archivo | Qué hace |
|---|---|
| js/config.js | Firebase, `coachEmailHash` (SHA-256 del correo del coach; el correo NO va en el código), `vapidKey`, `appName`, `appVersion`, comidas por defecto |
| js/db.js | Capa de datos (`get`, `list`, `set`, `del`, `watch`, auth). Lectura rápida: caché si ya se descargó + revisión del servidor en segundo plano (`onStale` → re-render). v1.17.1: **memoria de 20 s** (`remember`/`forget`) que entrega al instante lo ya leído y comparte lecturas iguales; al guardar se olvida el doc y su colección. El panel precarga las colecciones del cliente al abrir su ficha (era lento cambiar de pestaña) |
| js/app.js | Login (mantener sesión, recordar correo), roles, `enterClient` (el coach como cliente, carga su rutina y sus metas una vez), render, transición `.enter`, aviso de actualización |
| js/client.js | Vistas del cliente: inicio (campana de pendientes que se mueve, días con rutina abreviada), comida (Comida 1…N + "Agregar otra comida", sin mostrar hora, comidas con borde rojo brillante, voz, código de barras (lee una vez y espera ~1 s con "Cargando datos del producto…"), macros C/L/P de cada alimento bajo su nombre, renombrar alimento escaneado o registrado), agua (+200), peso (dos preguntas Sí/No: "¿En ayunas?" → `weightFast` y "¿Después de ir al baño?" → `weightBath`; obliga a responder ambas), progreso, ajustes (recordatorios, horario, avisos push, "Probar notificación"), pasos de ayer + informe de ayer en 3 niveles con confeti |
| js/train.js | Entrenamiento: semana (botón **Ver** rutina sin empezarla, con la última vez), sesión (reps del plan pegadas a la izquierda del casillero de reps, estilo app de referencia) (objetivo destacado, técnica Mejor/Igual/Peor en azul/verde/rojo, unilaterales Izq/Der con diferencia, video por serie guardado en el celular, descanso ajustable con pantalla encendida y alarma a pantalla completa que suena y vibra, reiniciar/descartar), resumen con progreso por serie y botón "Eliminar este entrenamiento" (borra sesión + audio), imagen para compartir, audio para el coach (graba en m4a si se puede; se guarda en el panel y se comparte con un toque) |
| js/data.js | Helpers de datos, `weekPlan`, `setVerdict` / `suggest` (progresión), `setProgress`, `mealList`, etapas (`applyStage`), CHECKIN |
| js/coach.js | Panel coach: clientes (tabla por estado + campana), timeline, etapas, entrenamientos (con audio y progreso), rutinas, alimentación, check-ins (responder / marcar respondido), feedback, datos (acceso, asesoría, pendientes a mano, notas), biblioteca (+ casillas de servicios), importar clientes, clientes de ejemplo |
| js/alerts.js | Pendientes del coach por cliente: `alertsFor(c, ctx)` → rojo (urgente) / amarillo (pendiente) / gris (info). `loadCtx` carga rutinas, sesiones, 7 días, check-ins, feedbacks y `access` |
| js/features.js | **Qué incluye cada servicio**: lista `FEATURES` (32 funciones × 1-1 / solo entrenamiento / solo nutrición) con valores de fábrica; el coach las cambia con casillas (doc `library/services`). En la app del cliente todo se pregunta con `has("clave")` |
| js/voice.js | Registro de comidas por voz o texto: separa los alimentos, cantidades, medidas caseras y gramos estimados |
| js/menus.js | **Plan por opciones** (editor del coach + vista del cliente), **reemplazos** por grupo, **lista de compras** y **escala de hambre** con carita (`faceSvg`) |
| js/push.js | Token de FCM para avisos con la app cerrada; `refreshPush` lo renueva al abrir la app (los tokens caducan) |
| js/realfoods.js | **600 alimentos**: 514 de la Tabla de Composición de Alimentos **INTA 2018** + 86 del USDA que la tabla no trae. [nombre, grupo, kcal, CHO disponibles, lip, prot por 100 g, g por porción de intercambio, medida, g de la medida, fuente]. Carnes/pescados crudos dicen "(crudo)" |
| js/offchile.js | **5.076 productos envasados chilenos** de Open Food Facts (ODbL), verificados (kcal cuadran con macros). Se carga al buscar/escanear; el escáner lo revisa antes de ir a internet (funciona sin señal) |
| scripts/base-alimentos/ | Transcripción de la tabla INTA, scripts para regenerar ambas bases y LEEME con el proceso |
| js/seed-plan.js | Plan de ejemplo de Joaquín (4 alternativas: Entreno AM, Entreno PM, Con legumbres, Entreno · 4 comidas; pauta ≈ P 120 · C 380 · G 60). Se carga una vez en "Mi registro" si no tiene opciones (`planDemo1911`) |
| js/seed-jr.js | Rutina de Joaquín (Lun–Sáb, LD/PG; serie 1 8 reps @RIR1, serie 2 6 reps @RIR1) |
| scripts/reminders.mjs + .github/workflows/reminders.yml | "Reloj" de avisos cada 15 min (GitHub Actions + firebase-admin + FCM). Necesita el secreto `FIREBASE_SERVICE_ACCOUNT` y la variable `PUSH_ON=1` (ya configurados). Borra tokens caducados y solo marca un aviso como enviado si llegó. Ojo: GitHub corre el cron más o menos cada hora, no cada 15 min |
| firestore.rules | Plantilla (las reglas reales están publicadas en la consola con el correo del coach, incluida `barcodes`) |

## Acceso de clientes (v1.16)
- El coach crea la ficha (`clients/{id}` con id propio, ya no es el uid) y `access/{correo en minúsculas}` = `{cid, name, ok}`.
- El cliente toca **"Crear mi cuenta"** con ese correo → Firebase le manda correo de verificación → entra solo si verificó y `ok == true` (si no, ve una pantalla de espera). El coach da/quita acceso en "Datos y objetivos" y copia la invitación para WhatsApp.
- Fichas antiguas cuyo id = uid (el registro propio de Joaquín) siguen funcionando.
- **Reglas nuevas** en `firestore.rules` (hay que pegarlas en la consola manteniendo su correo en `isCoach`): `access`, `hasAccess(cid)` con `email_verified`, y rutinas editables por el cliente si su `service == 'nutricion'`.
- Archivar un cliente le quita el acceso.

## Tipos de asesoría (v1.16)
- `client.service`: `completa` (1-1), `entrenamiento`, `nutricion`. Otros campos nuevos: `modalidad`, `checkinDay` (0–6), `checkinForm` (usa Google Forms), `endDate`, `city`, `sheetUrl` (planilla anterior), `todo` (pendientes a mano; "!" = urgente), `notes` (internas), `ranges` (guía de macros g/kg), `planPdf`, `weightStart`, `seen.entrenos`, `example`.
- **Solo entrenamiento**: sin plan de alimentación; "Mi guía de macros" con rangos por kg (`macroGuide` en data.js; por defecto P 1,6–2,2 · G 0,7–1 · C 3–5). Si no hay kcal/macros fijos, la meta del inicio es el punto medio.
- **Solo nutrición**: el cliente arma sus rutinas (editor en Entreno: nombre, días, ejercicios de la biblioteca, n° de series; `routine.own`, `routine.days` → arma el calendario). Sin videos, rangos, sugerencias de carga, técnica, videos de series ni audio. Ve los **tips** de la biblioteca (`library/exercises[].tips`).
- Todo esto se ajusta en Biblioteca → "Servicios" (casillas).

## Panel del coach (v1.16)
- Tabla de clientes ordenada por gravedad, con resumen (urgentes / pendientes / al día / con acceso), campana con todos los pendientes y punto de color por cliente en la barra lateral.
- Check-in "respondido" = existe `feedbacks/{semana}` con `at` o `answered` (al publicar la retro o con "Marcar respondido").
- La retro del coach le aparece al cliente en el inicio ("Tu coach respondió tu check-in") y en Progreso durante 9 días desde que se publica (`freshFb`).
- **"Ver como cliente"**: abre la app del cliente (`S.preview`), con barra amarilla; no activa avisos ni pide pasos de ayer.
- **Importar clientes**: sube un `ima-clientes.json` (no se guarda en el repo porque es público). Crea/actualiza fichas, rutinas, entrenamientos anteriores (`imported: true`), notas de configuración y la biblioteca. Nunca da acceso.
- **Clientes de ejemplo**: uno por servicio, con 4 semanas de datos (`seedClient` en demo.js).
- Importación del 18-nov-2026: 7 clientes desde "PANEL DE CONTROL - Asesorías" y sus planillas (Vicente, Felipe, Marian, René, Cristóbal, Gabriel, Déborah). La historia de entrenamiento se acomodó para que el último registro de la planilla quede en la semana pasada. Solo Vicente tenía su plan por opciones en el panel; los demás quedan con "plan en PDF: pásalo a la app".

## Bienvenida y etapas (v1.17)
- **Bienvenida (onboarding)** en js/onboarding.js: se abre sola la primera vez que el cliente entra (no en la vista previa) y queda en Más → "Bienvenida a IMA". Pantallas: video + mensaje del coach, su asesoría (según `has()`), instalar y activar avisos, día a día, entrenamientos, check-in, listo. El coach configura video, mensaje y link al manual en Biblioteca (`library/onboarding`). Al terminar: `clients/{id}/settings/onboarding.done`. El panel muestra en gris "Aún no completa la bienvenida".
- **Ajuste del plan por etapa**: `stage.adj = { grupo: ±porciones }` (Etapas → botón "Ajuste del plan"). `applyStage` cambia la pauta, achica/agranda en la misma proporción los gramos de ese grupo en las opciones del plan y, si la etapa no fija kcal/macros, los recalcula con los macros de intercambio. El cliente ve un aviso con el ajuste arriba de su plan.
- Decisiones de Joaquín (18-nov): **no trabaja con bloques fijos ni descargas** (los bloques duran lo más posible y se ajustan de forma natural); los **videos de las series siguen por WhatsApp** (descartado subirlos a Drive); quien deja la asesoría pierde el acceso.
- Primeros clientes en usar la app: **Marian, Vicente, Felipe y René** (semana del 23-nov-2026).

## Check-in v1.18 (inspirado en un carrusel de @logandube.3dfit que mandó Joaquín)
- Idea: preguntas que no se contestan con "bien"; escuchar progreso, barreras y lo que viene; acordar **una acción** y hacerle seguimiento.
- Abre con "Lo más importante de tu semana": `facil` (qué se hace más fácil que hace un mes), `barrera` (qué hizo más fácil/difícil seguir el plan), `orgullo`, `proxSemana` (qué pasa la próxima semana que debamos planificar), `foco` (una cosa concreta hasta el próximo check-in).
- Si hay foco anterior (primera línea de `weeklyGoals`, o el `foco` del check-in pasado): "Tu foco de la semana pasada" con `accion` (Lo logré / A medias / No lo logré) + `accionDet`; se guarda `accionFoco`.
- Ya no se pregunta lo que la app sabe: entrenos hechos (se guarda `entrenos` "4/4" automático) y días con registro. Se quitaron progCarga, progTec, top2/top3, motivación nutricional, "contribuyen", comentarios genéricos, tiempo de respuesta y servicio general. Nuevas: `confianza` (qué ejercicio domina sin el coach y cuál no), `momentoDificil`.
- Panel: recuadro destacado con seguimiento, progreso, barreras, orgullo, próxima semana y foco; las respuestas de preguntas antiguas salen en "Otras respuestas (versión anterior)" (`CHECKIN_OLD`). En Retroalimentación, "Foco de la semana" viene prellenado con el foco que propuso el cliente.

## Panel v1.19 (revisión con Felipe, 18-nov)
- Servicios se llaman **Coaching 1-1 / Entrenamiento / Nutrición**; la barra lateral agrupa a los clientes por servicio.
- **Timeline semanal**: arriba un calendario del mes con los días pintados por etapa (`monthCal` en data.js; tocar un día cambia la semana), entrenamientos, peso promedio y días con registro (en lista). Gráfico **peso vs métrica elegida** (calorías, CHO, grasa, proteína, pasos, agua, sueño, cardio) de 56 días con media móvil de 7 (`dualChart` en ui.js). Colores con criterio (`judge`): pasarse en pasos/agua/sueño/proteína no es malo; calorías sobre la meta es malo en déficit/mantención y bajo la meta en superávit. **Peso corregido** = si se pesó sin ir al baño se restan 0,12 kg (mediana 128 g/día y 1,1 deposiciones/día, Rose et al. 2015). Fila de **cafeína PM** (se pregunta al registrar el sueño: `day.cafPM`). Timeline por semanas en orden 1 → N con scroll.
- **Etapas**: calendario de 2 meses donde se elige una etapa (incluye **Break de dieta**) y se pintan semanas completas; las etapas se rearman solas como tramos seguidos. Fórmula: kcal = mantención (del cliente `kcalMaint` o de la etapa `maint`) × (1 + % de la etapa; % por defecto editables en `library/phases`), proteína y grasa en g/kg (`protKg`/`fatKg`), CHO completa. Se guarda calculado en `stage.auto` (lo usa `applyStage` si no hay número a mano). **Agua automática** = 40 ml × kg del último peso (`waterAuto`), si no hay meta a mano. El ajuste del plan muestra en vivo kcal/macros de la pauta y su cambio.
- **Rutinas**: editor por serie (reps y RIR por serie), descanso, **tempo** (excéntrica-pausa-concéntrica-pausa, `ex.tempo`), link de video (cualquiera), tips uno por línea (el cliente los ve en punteo), **reemplazos con link y tips propios**. Se quitó "salto de carga". El cliente ve tempo y descanso en "Lo que tienes que hacer hoy"; al usar un reemplazo se cargan sus tips.
- **Biblioteca de ejercicios**: agrupada por grupo muscular (`MUSCLES`), con ✓ de video y tips, botón para asignar grupo automáticamente (`guessMuscle`). Joaquín va a mandar cues de Tracked y un Excel de otra base de ejercicios.
- **Alimentación** (coach): resumen semanal con porciones promedio por grupo vs pauta, lo más comido y lo que quedó fuera de la pauta.
- **Plan de alimentación** (editor y reemplazos del cliente): usa la **base de porciones de intercambio de Joaquín** (`js/intercambio.js`, 426 alimentos de su "Base de Datos NT": 1 porción = lo que aporta los macros del grupo) + alimentos propios de Biblioteca. El registro diario sigue con INTA + Open Food Facts.
- **Datos**: inicio y fin del servicio arriba, sin "modalidad" ni "check-in por formulario"; objetivos del formulario de ingreso; muestra los objetivos vigentes por etapa; **próximo pago** (`payDate`, `payEvery`): aviso al coach 3 días antes y tarjeta amable al cliente en el inicio (`payMsg` en data.js; vista previa en Datos); **cumpleaños**: aviso el día antes y el mismo día.
- **Retroalimentación**: botón para dictar el mensaje (Web Speech, Chrome) y "Sacar puntos clave del mensaje" (separa frases). **Progreso**: gráfico de fuerza estimada (1RM con RIR) por ejercicio.

## v1.20 (18-nov, noche)
- **Revisión semanal de rutina** (`reviewWindow` en data.js): desde el día del último entrenamiento de la semana hasta que parte la siguiente, el panel avisa "Revisa su rutina para la semana N" (rojo el último día). En Rutinas: "Seguir igual la semana N" o guardar cambios (marca `client.rutReview = {week, same}`). Los cambios guardados dentro de esa ventana se marcan para la semana siguiente. Por ejercicio: **indicación de la semana** (`weekNote`) y **peso sugerido** (`wSug`); el cliente los ve arriba del ejercicio y en "Ver rutina".
- **Preanálisis** arriba de Retroalimentación: Destacar / A trabajar / Responder / Foco / Puedes omitir + guion de 3–4 min. Se quitaron los botones de dictado (Joaquín quiere video tipo Loom/Capso con burbuja).
- Progreso por ejercicio: primera vez vs última (kg y reps de la mejor serie), sin 1RM.
- Pago: el cliente ve el mensaje solo el día del pago; si pasó la fecha, "Pago pendiente" en rojo. Al coach se le avisa 3 días antes. Cumpleaños: solo aviso al coach.
- Pestaña "Datos y objetivos" quedó primera.
- Cafeína: "¿Tomaste alguna fuente de cafeína después de las 12:00 el día de ayer?".
- Plan de Felipe pasado del PDF (08/11/2026) a la app: 4 alternativas (3 = 4 comidas, 4 = fin de semana KFC) con las porciones y gramos del PDF; archivo `ima-felipe-plan.json` (fuera del repo).
- **Grabador de retro (v1.21, js/recorder.js)**: en Retroalimentación, "● Grabar" → `getDisplayMedia` (prefiere esta pestaña) + cámara y micrófono; compone en un canvas la pantalla + burbuja redonda con la cara (abajo a la izquierda, borde rojo) a 30 fps con un reloj en Web Worker (no se congela si la pestaña queda atrás); MediaRecorder webm en 720p a ~1,2 Mbps (≈9 MB por minuto, para no llenar los 15 GB gratis de Drive). Barra flotante con tiempo, pausar y terminar. Transcripción en vivo con el reconocimiento de voz de Chrome (es-CL, se reinicia solo). Al terminar: vista previa, descargar, descartar, "Pasar a puntos clave" y **subir a su Google Drive** (Google Identity Services, permiso `drive.file`, carpeta "IMA · Retroalimentaciones", link visible para quien lo tenga, se pone solo en "Link del video"). Ya configurado (18-nov) `CONFIG.googleClientId` (ID de cliente OAuth "Aplicación web" con origen https://nutrijrcoaching.github.io y Google Drive API habilitada en el proyecto jr-coach). El cliente ve los videos de Drive incrustados (`embedUrl` acepta links de Drive).
- **Guías**: siguen como PDF en Drive (Joaquín no quiere páginas, son de 20+ páginas); el cliente las lee dentro de la app con el visor de Drive.
- Pendiente acordado (antes): ~~grabador de retro tipo Loom~~ (pantalla + burbuja de cámara, subir a su Google Drive, transcripción en vivo con el reconocimiento de voz de Chrome); **guías dentro de la app** como páginas de texto; revisar macros de alimentos de la base del registro (ej. lentejas con arroz); cues de Tracked para la biblioteca.

## Datos (Firestore)
- `users/{uid}`
- `library/exercises`, `library/foods`
- `barcodes/{code}` (compartida)
- `clients/{cid}` (metas, `schedule`, `startDate`, `stages`, `pauta`, `plan` {pdfUrl, notes}, `menus`)
  - `days/{fecha}`: `meals` (`{"Comida 1": [items]}`, cada item con `t` = hora, que ya no se muestra), `water`, `steps`, `weight`, `weightFast` y `weightBath` (true/false), `sleep`, `mealCount`, `hunger` (`{"Comida 1": {a: 1–10 antes, d: 1–10 después}}`), `stress` (1–10)
  - Otras subcolecciones: `sessions`, `routines`, `foods`, `checkins`, `exnotes`, `photos`, `audios`, `settings` (`reminders`, `push`, `pushlog`)
- Reglas: el cliente escribe sus subcolecciones, salvo `routines` y `feedbacks`. El doc del cliente solo lo escribe el coach.

## Agregar alimento (v1.12.1, inspirado en FatSecret)
- Pantalla completa (`sheet(..., { full: true })`) con el **buscador fijo arriba**; al escribir pasa solo a resultados y al borrar vuelve a la pestaña anterior.
- Pestañas: Frecuentes (lo más registrado en 30 días; al tocarlo queda con los gramos de la última vez), Favoritos, Recetas, Por voz, Añadir rápido, Suplementos, Crear.
- `pickFood`: con medida casera parte en 1 unidad; al cambiar a **Gramos el campo queda vacío ("–")**, no se convierte el número.
- Ojo: los ids de la base (`r0`, `r1`…) cambiaron con la base INTA; los registros viejos guardan `fid` antiguos. Siempre buscar alimentos por **nombre** (Frecuentes ya lo hace).
- Inicio: calorías, agua y pasos muestran "Llevas el X %".
- ~~Idea pendiente: mostrar los alimentos de las opciones del plan como atajo en el agregador~~ (hecho en v1.24.0, pestaña "Mi plan").

## Base de alimentos (v1.12)
- Búsqueda: genéricos (INTA) primero, después marcas; varias palabras deben aparecer todas (nombre o marca).
- Ficha del alimento muestra la **fuente** y un aviso si los datos parecen raros (`foodCheck` en data.js: kcal vs macros ±20 %, proteína alta para cereales/frutas/verduras).
- El coach corrige un alimento de la base subiendo un CSV en Biblioteca con **el mismo nombre** (reemplaza al de la base).
- FatSecret descartado: lo gratis solo trae datos de EE.UU. (Chile es de pago) y su API exige un servidor con IP fija.
- La tabla INTA 2018 escaneada no trae plátano, pera, uva, piña ni sandía (salen del USDA).

## Plan de alimentación por opciones (v1.13)
- `menus` en el doc del cliente: `[{id, name, note, meals: [{name, time, note, items: [{name, cat, por, gp, g, medida, medidaG}]}]}]`. `gp` = g por porción de intercambio del alimento (de la base), `g` = por × gp. Alimentos sin grupo de intercambio van solo en gramos.
- **Coach**: pestaña "Plan alimentación" del cliente. Copia de trabajo local (`MW`) que se publica con "Guardar y publicar". Opciones con duplicar/eliminar; tiempos de comida con hora sugerida, subir/bajar; buscador de alimentos (datalist de la base) que completa grupo, gramos y medida. Muestra kcal/macros por intercambio y porciones de la opción vs la `pauta` (verde igual, amarillo faltan, rojo sobran). Por defecto: Desayuno, Colación, Almuerzo, Once, Cena.
- **Cliente** ("Mi plan"): pestañas por opción, comidas con hora, cada alimento con porciones · gramos · medida casera. Al tocarlo: hoja con **todos los alimentos del mismo grupo** y los gramos equivalentes a esas porciones (filtro de búsqueda). El PDF, las notas y la pauta siguen abajo.
- **Lista de compras** (`#compras`): el cliente elige cuántos días de cada opción; suma los gramos por alimento, agrupa por grupo de intercambio, ≈ medida casera, check para tachar (guardado en localStorage del celular), compartir como texto.
- `homeMeasure(g, medida, medidaG)` convierte gramos a medida casera multiplicando la cantidad que trae la medida ("1 ½ taza", "5 unidades") y usa plural.

## Escala de hambre (v1.13 · QUITADA de las comidas en v1.14.1)
- Joaquín pidió sacarla de cada comida (no era para eso). El código (`faceSvg`, `openHunger`, `hungerBtn`) sigue en menus.js por si se reutiliza; los datos `day.hunger` ya guardados quedan.
- Antes: carita en cada comida (junto a ⋯). Abría una hoja con dos deslizadores 1–10: "¿Con cuánta hambre llegaste?" y "¿Cómo quedaste después de comer?". La carita cambia de forma al deslizar (cejas preocupadas → ojos cerrados tranquilos con sonrisa en 6–7 → mejillas infladas y boca ondulada en 10) y el color pastel (coral → verde menta → lavanda).
- Niveles: Muerto de hambre, Mucha hambre, Con hambre, Un poco de hambre, Ni hambre ni lleno, Satisfecho, Tranquilo en su punto, Lleno, Muy lleno, A punto de reventar.
- El coach lo ve en Alimentación ("Hambre 3 → 7" junto a cada comida).

## Estrés del día (QUITADO en v1.15.2)
- Se probó una barra deslizable de estrés con carita (en peso y luego en el inicio). A Joaquín no le convenció y se quitó completa, igual que la escala de hambre en las comidas. Los valores ya guardados (`day.stress`, `day.hunger`) quedan en Firestore, pero no se muestran. No volver a proponerla salvo que él lo pida.

## Descanso entre series (v1.15)
- Al terminar el descanso sigue contando hacia arriba: "+0:12" = segundos después del descanso (botón y barra en amarillo, sin texto). La barra flotante ya no tiene los botones −15/+15, solo el tiempo y ✕. Se apaga con ✕, al iniciar otro descanso o solo a los 10 min.
- Al terminar sigue igual: alarma en la app + notificación que vibra si la app está en segundo plano. Lo de pantalla completa fuera de la app quedó descartado por ahora.

## Reglas de colores y cumplimiento (v1.11)
- **Barras de macros**: color fijo por macro (Calorías rojo, CHO amarillo, Lípidos azul, Proteína verde; igual en inicio y en comida) y un ✓ cuando llegan al 95 % de la meta. Joaquín descartó los colores según % de cumplimiento.
- **Informe de ayer**: ±5 % cumplido · 6–10 % "un pelito" · >10 % "hay que mejorar". En agua y pasos, pasarse cuenta como cumplido. Confeti completo solo si todo está cumplido.

## Notificaciones
- Ícono pequeño (`badge`) = `icons/badge-96.png`, silueta blanca del logo sobre transparente (Android exige monocromo; si no, muestra una campana).
- El texto "· nutrijrcoaching.github.io" lo agrega Chrome a todo aviso web, incluso con la app instalada (comprobado 17-nov). No se puede quitar desde el código: solo con la app Android nativa (Capacitor/TWA, ya pendiente por Health Connect) o con un dominio propio (pagado) en vez de github.io.

## Compartir con el coach
- Una web no puede mandar un archivo directo a un número de WhatsApp (wa.me solo acepta texto). Se usa el menú de compartir del celular; tras la primera vez el chat del coach aparece arriba como acceso directo. El audio y la sesión quedan igual en el panel del coach.
- Se quitó "Enviar como texto" y el "(imagen)" del botón.
- El audio fallaba porque Android no deja compartir `audio/webm;codecs=opus`: ahora el archivo va con tipo limpio (`audio/x-m4a` .m4a o `audio/webm` .weba) y se comparte con un toque (el permiso para compartir se pierde si se espera a que termine de guardar).

## Pendientes / ideas acordadas
- **Temporizador de descanso fuera de la app / con el celular bloqueado** (en pausa por decisión de Joaquín, 18-nov): una web no puede ponerse a pantalla completa sobre otras apps ni sobre la pantalla de bloqueo, y con la pantalla apagada el navegador puede congelar los temporizadores (el aviso de fin de descanso no es confiable). Opciones conversadas: (1) audio de fondo durante el descanso que suena al terminar (funciona bloqueado, pero pausa la música del cliente); (2) app Android nativa (Capacitor, misma que para Health Connect) con alarma a pantalla completa estilo despertador. En iPhone solo con app nativa en App Store (99 USD/año).
- **Verificar en el celular** (v1.11): que llegue la notificación de prueba y los avisos con la app cerrada; que el audio se comparta a WhatsApp.
- **Criterio completo de progresión de cargas.** Actualmente: técnica primero; bajar el peso si hay fallo o faltan 2 o más reps; unilaterales con el mismo peso en ambos lados.
- **"Loom" dentro de IMA** para retroalimentación en video al cliente: grabador con burbuja de cámara, guardado en Google Drive, contador de vistas, comentarios con minuto, subtítulos y velocidad.
- **App Android (Capacitor) para leer los pasos desde Health Connect** (hoy se anotan a mano).
- **Tips de ejecución por ejercicio** desde su hoja "Programa y tips".
- **Plan de alimentación**: verificar en el celular las opciones, reemplazos y lista de compras (v1.13). Idea: mostrar la escala de hambre como gráfico semanal en el panel.
- Importar `ima-planes.json` en la ficha de cada cliente (Felipe, Vicente, Marian, René, Cristóbal, Déborah) y publicar. Ojo: a Vicente le reemplaza el plan por opciones que ya tenía.

## Forma de trabajar con Joaquín
- Habla en español de Chile, informal. Prefiere ver el código en el chat y no como adjunto.
- Pedir permiso antes de acciones irreversibles o en sus cuentas.
- Para ahorrar uso: chats nuevos, Sonnet para cambios chicos, varios pedidos juntos; "sin probar" para cambios simples.

## v1.22.0 — Grabador tipo Loom/Zoom
- Al grabar: ventana flotante (Document Picture-in-Picture de Chrome) con controles + preanálisis; no sale en el video. Sin PiP, la barra queda arriba al centro en la página.
- body.rec-on oculta sidebar (otros clientes), alertbar y la tarjeta del grabador; solo se ve el cliente que se graba.
- Burbuja de cámara visible (#recbub) arrastrable, 3 tamaños (LS bubSize/bubPos), ocultable. Si se comparte "Esta pestaña" se graba la pestaña tal cual (burbuja + dibujos incluidos); si es ventana/pantalla, se compone en canvas con la burbuja abajo-izq.
- Dibujo (#recdraw): rojo, blanco, destacador; trazos se borran solos ~4 s. Pausa/reanudar. Cuenta regresiva 3-2-1 antes de empezar.
- "⬆ Subir un video que ya tengo": sube cualquier archivo de video del computador a la carpeta de Drive y pone el link.
- ui.js exporta bindActions(doc) para que data-a funcione en la ventana PiP.

## v1.23.0 — Reproductor de retroalimentación + encuesta al terminar
- js/player.js (cliente, se carga con import dinámico desde openFeedback): si videoUrl es archivo directo (firebasestorage/.webm/.mp4/blob:) usa <video> propio con velocidad 1/1,25/1,5/2x (LS fbSpeed), subtítulos WebVTT generados de fb.cues (LS fbCC), capítulos fb.chapters [{s,t}] clicables. Drive/YouTube siguen en iframe (capítulos solo como lista).
- Encuesta al terminar (o abajo si es iframe): estrellas 1–5, "¿Tienes alguna duda o consulta?", "¿Sientes que hubo algo que faltó mencionar?" → clients/{cid}/fbreplies/{week} {rating, duda, falto, viewed %, at, seen}. Guarda % visto cada 20 %.
- Grabador: cues con tiempo (Web Speech, sin contar pausas) y botón 🔖 para marcar capítulos → se prellenan en "Capítulos del video" (formato "1:20 Sentadilla").
- Coach: tarjeta "Respuesta del cliente a tu retro" en Retroalimentación + "Marcar leída"; alertas: duda = rojo, faltó / ≤3★ = amarillo, resto = info.
- Pendiente: activar Blaze + Storage (us-east1), subir grabaciones a Storage en vez de Drive, reglas de Storage y caché offline del último video.
- 18-nov: Blaze NO activado (Google pidió prepago de $30.000; Joaquín no quiere dejarlo inmovilizado). Se sigue con Drive. RECORDARLE averiguar si puede activar Blaze con tarjeta de crédito sin prepago; cuando se active: Storage us-east1, alerta de presupuesto US$1, subir grabaciones a Storage y caché offline.

## v1.23.1 — Grabador: controles a la izquierda, guion a la derecha
- Sin PiP. Al grabar: barra vertical fija a la izquierda (86 px: tiempo, pausa, capítulo, lápiz+colores, borrar, espejo, cámara, guion, terminar), guion (preanálisis) en panel derecho plegable (360 px, LS recGuide), y #recstage al medio: con "Esta pestaña" el track se recorta al escenario con Region Capture (CropTarget/cropTo), así barra y guion no salen en el video.
- Burbuja: tamaño libre 90–460 px (esquina roja o rueda del mouse, LS bubPx), arrastrable dentro del escenario, espejo activable (LS bubMirror, por defecto espejo).
- allAlerts: usa el último cálculo y recalcula por detrás cada 60 s (no durante la grabación); cambio de pestaña ~0,3 s.

## v1.23.2 — Retro del cliente más limpia
- Sin texto automático, miniatura, foco de la semana, tarjeta neutra y la pregunta "¿Sientes que me faltó mencionar algo?".

## v1.24.0 (19-nov) — Planes desde PDF, plan de ejemplo y atajo "Mi plan"
- **Importar plan** (Plan alimentación → botón "Importar plan"): sube `ima-planes.json` (`{type: "ima-planes", plans: [{name, pauta, menus}]}`; NO va en el repo, es público). Busca el plan por nombre y apellido del cliente (si no calza, deja elegir de la lista), avisa que reemplaza las opciones actuales y lo carga en la copia de trabajo; recién se publica con "Guardar y publicar", que también guarda la **pauta** (`MW.pauta`).
- El archivo del 19-nov trae los 6 planes pasados de los PDF: Felipe (4 alt.: 3 = 4 comidas, 4 = fin de semana KFC), Vicente (4), Marian (4, 6 comidas), René (4), Cristóbal (alt. de 4, 5 y 6 comidas) y Déborah (5 alternativas + 2 opciones de 4 tiempos). Horarios desde "Tus horarios" (Vicente y Marian no tienen). El nombre del plato queda como nota de cada comida. Se extrajo con pdfplumber (globos de color = grupo y porciones; a la derecha alimento y medida) y se verificó contra las kcal impresas en cada tarjeta: calzan todas salvo los extras en gramos (chía, Nutella, KFC), que no tienen grupo y no suman en el editor.
- René: el huevo va como carne baja en grasa (pauta carnes magras = 4 + 3 huevos = 7). La pauta del "día con legumbres" no se importa (la app tiene una sola pauta).
- **Pestaña "Mi plan" en Agregar alimento** (si el servicio tiene `plan_menus` y hay opciones): alimentos de la opción elegida por tiempo de comida (recuerda la opción en LS `ima-plan-opt`). Al tocar uno: si el nombre (sin paréntesis) calza con la base real, abre la ficha con los gramos del plan; si no, busca (acorta la búsqueda si no hay resultados) y el alimento que elija queda con esos gramos (`FS.planG`). Se descartó el emparejamiento automático por palabras (daba errores tipo "Huevos" → clara de huevo).
- `homeMeasure` escala cada parte de "6 cdas o ½ taza" (antes salía "12 cdas o ½ taza").
- Editor del coach: el color de las porciones compara sin redondear (4,75 ya no sale rojo como 4,8).

## v1.25.0 (20-nov) — Menos ruido para el cliente, extras con macros y día con legumbres
- **Decisión de Joaquín:** al cliente NO se le muestra a cuántas porciones equivale lo que registra ni cuántas lleva de su pauta (la porción de intercambio no calza con el aporte real y confunde). Se compara solo con sus macros. Se quitó: la tarjeta "Porciones de tu pauta" en Comida, el "· X porc." de cada alimento registrado y la unidad "Porción de intercambio" al registrar (queda la porción propia de productos creados/escaneados, ej. 1 scoop, `ownPor`). Los ítems siguen guardando `cat` y `por` para el análisis del coach. El plan (opciones, reemplazos, "Porciones por día") sí muestra porciones.
- **Extras en el plan** (`isExtra(it)` = sin grupo de intercambio de la pauta): llevan sus macros de la cantidad del plan (`kcal, cho, fat, prot`) y suman al total de la opción en el editor (no a las porciones). Botón "＋ Extra" en cada comida; si el nombre calza con un alimento de la base sin grupo, guarda `p100` y recalcula al cambiar los gramos (si se edita un macro a mano se borra `p100`). El cliente ve "Extra" y sus kcal (sin ⇄; al tocarlo ve sus macros).
- `ima-planes.json` regenerado: chía (INTA, por 100 g), Nutella (etiqueta 539/57,5/30,9/6,3), jalea sin azúcar = 0, y los extras de comida rápida de un cliente con el total de su tarjeta del PDF. Se quitó el "(" que quedaba al final de algunas medidas.
- **Día con legumbres:** `client.pautaLeg` (se edita en Datos y objetivos junto a la pauta normal; viene en el import desde la 2ª columna de la pauta del PDF; `applyStage` le aplica el mismo ajuste de etapa). Una opción con `leg: true` ("Es el día con legumbres" en el editor) se compara con esa pauta (Déborah alt. 5 y la opción "Con legumbres" del plan de ejemplo de Joaquín, migración `planLeg2011`). Si ninguna opción es de legumbres, el cliente ve una pestaña "Día con legumbres" en Mi plan con lo que cambia (−2 cereales, −1 carnes, +2 legumbres…) y la tabla normal vs legumbres (`legHtml`).
- **Coach → Alimentación (resumen semanal):** macros del día a día vs meta (verde ±5 %, amarillo 6–10 %, rojo >10 %; proteína sobre la meta = bien) con promedio; cuánto comió de cada grupo en la semana (gramos reales + ≈ porciones/día vs pauta, aproximadas); lo más consumido (días y gramos promedio) y **lo que no está en su plan** (comparando nombres con las opciones `menus`; "habitual" si lo comió 3+ días) para ajustar el plan.

## v1.26.0 (20-nov) — Mi plan más visual, lista de compras y preparaciones caseras
- **Mi plan (cliente):** cada tiempo de comida en su tarjeta con borde rojo (como en Comida) y el nombre ("Desayuno · pre entreno") en una cápsula roja (`.card.pmeal`, `.pmh b`). Sin macros: Joaquín prefiere solo cantidades.
- **Lista de compras:** queda guardada en el celular (LS `ima-shop-{cid}`): los días por opción y lo tachado se mantienen hasta "Nueva lista" (pide confirmar, desmarca todo y guarda la fecha `started`, que se muestra). No se reinicia sola.
- **Agregar alimento:** la pestaña "Mi plan" resaltada en rojo (`.plantab`); el botón del escáner ahora es un ícono de código de barras con el texto "Escanear" (`BARCODE`, `.scanbtn`). La medida casera muestra sus gramos ("1 cda (15 g)"); la porción de intercambio no aparece (decisión de Joaquín: el cliente ya la ve en su plan).
- **Crear → Preparación casera:** guía de 3 pasos; ingredientes crudos con gramos (datalist de la base + alimentos propios), peso total de la preparación lista → guarda un alimento propio por 100 g (`prep: true`, `ings`, `cookedG`) y abre la ficha para registrar los gramos servidos. "Producto con etiqueta" tiene su guía de cuándo usarlo. Las preparaciones aparecen también en la pestaña Recetas.

## v1.27.0 (20-nov) — Sin horario, comida libre, colores por comida y lista en crudo
- **Opción sin horario** (`menu.noTime`, casilla en el editor): el cliente no ve las horas y ve "Sin horario fijo: come cada 3 a 4 horas".
- **Comida libre durante el día** (`meal.free`, casilla por comida): sin hora; el cliente ve "Libre durante el día". Puede llevar un **aporte total** (`meal.budget` {kcal, cho, fat, prot}) que reemplaza la suma de los extras de esa comida en los totales del editor (`hasBudget`).
- Un plan importado usa `noTime` y una comida libre con el total de su PDF; los productos quedan como referencia sin macros propios.
- **Colores por tiempo de comida** en Mi plan (`mealColor`): desayuno ámbar, colación AM turquesa, almuerzo rojo, colación PM violeta, once azul, cena índigo, pre entreno verde, libre gris; borde y cápsula con `--mc`.
- **Lista de compras en crudo** (`toRaw`): lo cocido con par crudo en la base de intercambio y del mismo grupo se pasa a crudo con las mismas porciones (arroz, fideos, quínoa, cous cous, legumbres). Las carnes quedan como están hasta que Joaquín defina si las porciones de su base son en crudo o cocido (por los macros, 50 g = 11 g de proteína calza más con carne cruda).
- Import: el PDF guarda "(" y "×" como caracteres privados (U+E081, U+E09F); `fixtxt` los convierte. Ya no quedan medidas con "(" suelto.
- Casillas del editor con estilo `label.chk`.

## v1.27.1 (20-nov)
- Pestaña "Mi plan" de Agregar alimento: cada tiempo de comida en su tarjeta con el mismo color que en Mi plan (`.pmini`, `mealColor`).
- Decisión de Joaquín (20-nov): **no** pasar el plan a crudo ni poner un aviso de "todo es en crudo" (la gente cocina para varios y pesa cocido). Las carnes del plan quedan como están; solo la lista de compras pasa a crudo arroz, fideos, quínoa, cous cous y legumbres.

## v1.28.0 (20-nov) — Editor del plan (coach) rehecho
- **Regla de Joaquín:** todo plan nuevo lleva un **día con legumbres planificado como opción propia** (no una modificación de otra opción). Si ninguna opción tiene `leg`, el editor avisa y ofrece "＋ Día con legumbres" (copia la opción elegida, `leg: true`, y se ajusta a la pauta del día con legumbres). La pestaña "Día con legumbres" del cliente (solo la regla) queda para planes antiguos sin esa opción.
- **Pauta de alimentación** dentro de la pestaña Plan alimentación (tarjeta plegable, abierta si está vacía): porciones por grupo del día normal y del día con legumbres, con kcal y macros por intercambio y % de las metas del cliente (verde ±5 %, amarillo ±10 %, rojo más). Botón para copiar el día normal al de legumbres (−2 cereales, −1 carne grasa o magra, +2 legumbres). `MW.pauta`/`MW.pautaLeg` se guardan siempre con "Guardar y publicar" (también se siguen editando en Datos y objetivos).
- **Colores:** cada opción tiene su color (`optColor`: pestaña, borde de sus comidas y de la tabla lateral) y cada grupo de alimentos el suyo (`GCOL`: franja en cada fila de alimento y punto en las tablas).
- **Tabla lateral fija** (`.me-side`, sticky al hacer scroll; abajo en pantallas angostas): porciones de la opción / pauta por grupo (verde igual, amarillo faltan, rojo sobran) y kcal/CHO/lípidos/proteína contra las metas. Reemplaza las cápsulas de arriba.
- **Macros por tiempo de comida** bajo el nombre de cada comida en el editor (`mealTot`).

## v1.29.0 (20-nov) — Entrenamiento del coach: bloque semana a semana, progreso por rutina y cardio con descripción
- **Rutinas → vista del bloque** (`blockGrid`, se abre sola la primera rutina): tabla por rutina con cada ejercicio y, por semana (últimas 5), lo **indicado** (series×reps @RIR, en rojo si cambió respecto de la semana anterior) y lo **hecho** por serie (verde subió, rojo bajó). A la derecha, columnas editables de la **semana siguiente**: series, reps por serie ("8, 6" o una sola), RIR, kg sugerido y comentario del ejercicio (`weekNote`). Arriba, **comentario general de la rutina** (`routine.note`), que el cliente ve al empezarla (se copia a `session.coachNote`) y en "Ver rutina". "Guardar cambios" marca los cambios como antes. El detalle por ejercicio (video, tips, tempo, descanso, reemplazos) quedó en un desplegable debajo.
- Datos del bloque: `routineBlock(routine, sessions)` en data.js (último entrenamiento terminado de cada semana; unilaterales juntan izquierda y derecha), `planStr`, `setStr`.
- **Entrenamientos:** bajo cada sesión, "✎ Para la próxima vez" con el comentario general de la rutina y la indicación + kg sugerido por ejercicio; se guarda al salir de la casilla (`patchRoutine`, marca cambios y la revisión semanal).
- **Progreso por rutina** (reemplaza el progreso por ejercicio): tarjetas por rutina; por ejercicio, serie 1 y 2: 1ª vez · semana anterior · última semana, y diferencia en kg y reps contra la 1ª vez y contra la semana anterior.
- **Cardio:** fila compacta (veces/semana, tipo, minutos, intensidad) + **descripción** (`cardio.desc`). El cliente la ve completa en "Ver" del cuadro de Cardio del inicio y al registrar (`cardioPlanHtml`).
- **Plan alimentación (editor):** en la tabla lateral, kcal/CHO/lípidos/proteína en verde/amarillo/rojo según % de la meta.

## v1.30.0 (20-nov) — Requerimientos y etapa en el plan
- **Etapas → Cálculo de requerimientos** (`reqCard`/`reqCalc`): sexo, fecha de nacimiento (edad), estatura, último peso, fórmula (Mifflin-St Jeor por defecto, Harris-Benedict revisada o Katch-McArdle con % de grasa) y factor de actividad (1,2–1,9 con descripción en pasos/entrenos). Muestra gasto en reposo y total; "Usar X kcal como mantención" guarda `kcalMaint` y recalcula todas las etapas. Campos nuevos del cliente: `bodyFat`, `reqFormula`, `actFactor` (sexo, nacimiento y estatura ya existían en Datos).
- **Plan alimentación → cabecera de etapa** (`planBanner`, `planCtx` en coach.js): nombre grande de la etapa de esta semana con su color, semanas, ajuste del plan y metas (kcal/CHO/lípidos/proteína de la etapa). Selector para cambiar la etapa (cambia la etapa completa y borra sus números fijados a mano para que se recalculen; si no hay etapa, crea una de 8 semanas desde esta semana). El editor del plan compara contra las metas de la etapa.
- **Aviso de pauta** (`pautaWarn` en menus.js): verde si la pauta (con el ajuste del plan de la etapa) calza con las metas (kcal ±5 %, macros ±10 %); si no, rojo "Ajusta la pauta para calzar…" con la diferencia de cada uno.

## v1.31.0 (20-nov) — Un plan de alimentación por etapa y una sola pestaña de Entrenamiento
- **Idea de Joaquín:** Plan alimentación es el **diseño de los planes de cada etapa** (Mantención, Déficit, Recomposición…). La app del cliente muestra el plan de la etapa marcada en el Timeline esa semana. Las semanas pasadas quedan como se planificaron (se quitó el selector que cambiaba la etapa desde el plan).
- Datos: `client.plans = { [etapa]: { menus, pauta, pautaLeg, targets: {kcal, cho, fat, prot}, calc: {maint, pct, protKg, fatKg}, at } }`. `applyStage` usa `plans[etapa de la semana]` (opciones, pautas y metas; las metas del plan mandan). Sin plan para esa etapa queda el plan general (`menus`, `pauta`…). Al guardar el plan de la etapa actual también se copia al plan general. `phaseAt`, `hasPlans`, `PHASE_PCT` en data.js.
- **Migración:** al abrir Plan alimentación de un cliente sin `plans`, su plan único pasa a ser el de la etapa actual con sus metas generales (`planCtx`).
- **Editor:** pestañas por etapa (`phaseStrip`), "Partir de una copia de X" / "Empezar vacío", **Metas de la etapa** con calculadora propia (`targetsCard`: mantención × (1 + %), proteína y grasa g/kg; "Usar el cálculo" / "Usar los macros de la pauta"), aviso de pauta vs metas y tabla lateral contra esas metas.
- **Etapas:** la tabla muestra por etapa su plan (listo con metas / falta + link), pasos, cardio y nota; los % y macros por etapa ahora viven en cada plan.
- **Avisos:** rojo si la etapa actual no tiene plan; amarillo si una etapa parte en ≤ 2 semanas sin plan o un plan vigente no tiene metas.
- **ima-planes.json** (fuera del repo) trae por plan su etapa y las metas tal como se calcularon en el PDF; al importar se carga en la pestaña de esa etapa. Los datos de clientes no se escriben en este archivo porque el repositorio es público.
- **Entrenamiento (una sola pestaña, `trainingView`):** lo que hizo la semana (tarjetas compactas, detalle por serie plegado), revisión semanal, rutina semana a semana (`blockGrid` con técnica, 💬 notas, ⇄ reemplazo y "vs 1ª vez") y, plegados, el detalle de ejercicios y la configuración (calendario y cardio). Se quitaron la pestaña Rutinas (la ruta sigue) y "Para la próxima vez"; en Progreso el resumen por rutina quedó plegado.

## v1.32.0 (20-nov) — Avisos de "algo no calza" en los planes
- `planChecks` (alerts.js) revisa los planes de la etapa actual y de las que parten en ≤ 3 semanas y avisa en la campana:
  - pauta vs metas del plan (kcal ±5 %, macros ±10 %) y pauta faltante;
  - cada opción vs las metas (amarillo, con la diferencia) o, si los macros calzan, porciones distintas a su pauta en ≥ 0,5 (gris); la opción de legumbres se compara con la pauta de legumbres;
  - falta el día con legumbres (gris);
  - metas vs requerimiento de la etapa = mantención (del plan o del cliente) × (1 + % de la etapa), si difiere más de 8 %;
  - el peso (promedio de los últimos 7 días) cambió ≥ 2 kg o ≥ 3 % respecto del peso con que se pusieron las metas (`plan.calc.kg`, se guarda al usar la calculadora, los macros de la pauta, editar metas o publicar; el import trae el peso del PDF).
- Al publicar un plan se recalculan los avisos (evento `ima-alerts`).

## v1.33.0 (20-nov) — Revisión semanal por rutina
- **Pendientes para la semana N** (arriba de las rutinas): una cápsula por rutina del calendario (`reviewWindow(...).list`): "por revisar" (amarillo), "cambios sin guardar" (rojo), "con ajustes" / "sin cambios" (verde). Cada rutina se cierra con "Guardar cambios" (guarda `routine.review = {week, same}`) o "Sin cambios para la semana N" (`rSameOne`); cuando están todas, la semana queda revisada (`client.rutReview`). "Todas sin cambios" y "Deshacer" siguen. El aviso de la campana nombra las rutinas pendientes.
- **Tabla semana a semana:** la semana siguiente ahora tiene una fila por serie con sus reps y su RIR (desplegable: fallo, 0–5), según la cantidad de series. Indicador "Cambios sin guardar" y confirmación al cambiar de rutina sin guardar.
- **Lo que ve el cliente:** los cambios se describen serie por serie ("serie 1: 8 → 10 reps", "serie 2: RIR 1 → al fallo", "se agrega la serie 3…") más descanso, tempo, comentarios y kg sugerido, en la tarjeta "Esta semana hubo modificaciones en tu rutina" de la semana en que aplican.
- **Detalle de ejercicios:** solo lo fijo (nombre y orden, video, tips, tempo, descanso, reemplazos). Se quitaron de ahí las series, el peso sugerido y la indicación semanal (viven en la tabla).

## v1.33.1 (20-nov)
- Se quitó "Subir video de tu serie" de la sesión y la función "Videos de sus series" de Servicios: Joaquín prefiere que le manden los videos por WhatsApp (los ve en el celular). Los videos ya guardados se siguen pudiendo ver ("Ver tu video"). La bienvenida dice que los manden por WhatsApp.

## v1.33.2 (20-nov)
- Vuelve "Videos de sus series (vía WhatsApp)": botón "🎥 Video para tu coach (WhatsApp)" en cada serie; graba o elige el video y lo comparte por el menú del celular con los datos de la serie. Se quitó el campo de enlace a Drive/YouTube.
- Arreglo: en ejercicios con Izq/Der la etiqueta usaba la clase `side`, que choca con la barra lateral del panel (`.side` con alto de pantalla completa) y descuadraba la serie. Ahora es `sidel`. Pasaba también en el celular.

## v1.33.3 (20-nov) — Actualizaciones que no llegaban
- GitHub Pages manda los archivos con caché de 10 min, y el service worker (red primero) los pedía pasando por ese caché: la app podía seguir con la versión anterior un rato. Ahora: `install` baja cada archivo con `cache: "reload"`, el `fetch` de archivos propios usa `cache: "no-cache"` (revalida con el servidor) y el registro usa `updateViaCache: "none"`.

## v1.33.4 (20-nov)
- Videos de las series: la función "Videos de sus series (vía WhatsApp)" queda en Servicios para distinguir los planes, pero en la sesión ya no hay botón para grabar/subir: solo un recordatorio al pie de cada ejercicio ("Recuerda mandarle a tu coach el video de tu ejecución por WhatsApp…"). Las acciones `setVideo`/`vidShare` siguen en train.js sin uso.

## v1.34.0 (20-nov) — Check-in reescrito (pedido de Joaquín)
- Textos: "¿Pasa algo la próxima semana que debamos planificar?", "¿En qué cosa en particular quieres enfocarte…?". Opciones en el género que corresponde (entrenamientos "Muy malos…Muy buenos"; disposición "Muy baja…Muy alta"; energía "Muy baja…Muy alta"; digestión "Muy mala…Muy buena"; salud "Terrible, Mal, Regular, Bien, Muy bien, Excelente").
- **Detalle condicional** (`why(when, ph)` en data.js; en client.js el campo `#det-clave` se muestra/oculta al tocar la opción): otro deporte → "¿Cuál y cuánto?" solo con Sí; entrenamientos Muy malos/Malos/Regulares → "¿Por qué?"; disposición Muy baja/Baja → "¿Por qué?"; fuerza y rendimiento Muy malos/Malos → "¿A qué lo asocias?"; dolor articular Leve/Moderado/Alto → "¿Dónde y en qué ejercicio?"; sueño Peor → "¿Por qué?".
- DOMS: Sin dolor, Molestias leves, Adolorido, Muy adolorido, Dolor incapacitante. "Top 3 series o ejercicios de la semana" con 3 casillas (tipo `list3`, claves top1–top3) y "El ejercicio o la serie que más te costó".
- Nutrición: sin "(automático)" ni cintura; se agregan qué le costó más, qué fue más fácil y qué podría mejorar para seguir el plan. Hambre: Sin hambre, Poca hambre, Lo normal, Hambriento, Muy hambriento. Saciedad: Poca, Satisfecho, Muy satisfecho, Incómodamente satisfecho. Deposiciones: se agrega "Pastosas (entre blandas y líquidas)". "Si hubo, describe tus molestias o síntomas intestinales".
- Recuperación: resumen automático de la semana (sueño promedio, calidad y cafeína después de las 12 en cuántos de 7 días, `sleepSum`) y "¿Cómo describirías tu sueño comparado con la semana anterior?".
- Experiencia: progreso (No he visto progreso, Podría ser mejor, Satisfecho, Muy satisfecho, Increíble); "¿Qué tan útil fue mi retroalimentación para esta semana?" (No la vi, No me sirvió, No la apliqué, Útil, Muy útil); "¿Tienes alguna sugerencia sobre qué podría hacer yo para facilitar tu proceso?"; "¿Necesitas algo en particular de mí esta semana? ¿Tienes dudas o consultas…?".
- Preanálisis de la retro: suma los "por qué" de las respuestas negativas y lo que más le costó / podría mejorar del plan. Respuestas antiguas (cintura, momentoDificil) siguen en "versión anterior".

## v1.34.1 (20-nov)
- Ajustes del cliente: la lista de recordatorios (agua, comidas, pasos, peso, entrenamiento, check-in, avisos con la app cerrada) se ve siempre, atenuada hasta que activa "Activar recordatorios" (antes solo aparecía con los avisos activados y el permiso dado). Los recordatorios se guardan en el celular de cada cliente (LS `rem`), no en su ficha: en "Ver como cliente" se ve la configuración del navegador del coach.
- Arreglo: "Tu horario de todos los días" usaba la clase `sched` del calendario del panel (7 columnas) y se veía apretado; ahora `remsched`.

## v1.34.2 (20-nov)
- Progreso del cliente: "Timeline" con la descripción "Un resumen de tus estadísticas semana a semana". En el Timeline, el calendario nutricional es un calendario del mes (`monthCal`, con flechas para cambiar de mes; `TLM`) con los días pintados por etapa y su leyenda, en vez de la barra de etapas.

## v1.34.3 (20-nov)
- Datos y objetivos se guarda solo al cambiar cualquier campo (`dataAuto` → `saveData`, con aviso si falla); el botón Guardar sigue. Al cambiar la fecha de inicio avisa que las semanas y etapas se cuentan desde ese día.
- OJO pendiente: cambiar la fecha de inicio de un cliente con historial renumera las semanas. Sesiones (`weekKey`), check-ins y retros (`S01`, `S02`…) guardan el número de semana viejo, y un check-in nuevo de la "semana 1" pisaría el antiguo de la semana 1. Falta decidir cómo manejar un "nuevo bloque" sin perder lo anterior.

## v1.35.0 (20-nov) — Empezar de cero
- Datos y objetivos → tarjeta "Empezar de cero…": hoja con fecha de semana 1 (por defecto mañana), etapa inicial (por defecto Mantención) y duración en semanas; confirmar escribiendo el primer nombre del cliente. Borra subcolecciones days, sessions, checkins, feedbacks, fbreplies, photos, measures, audios; limpia en rutinas changes/review/changed; en la ficha pone startDate, stages=[{phase,from:1,to:N}], rutReview/feedback null, weeklyGoals [], seen {}, resetAt. Mantiene ficha, rutinas, planes (plans) y acceso. No se puede deshacer.
- Cliente con fecha de inicio futura: cabecera "empieza el …", aviso informativo "Empieza el …", el coach ve la semana 1 (no la 0), sin pendientes de revisión de rutinas hasta que parte (reviewWindow devuelve null si hoy < startDate).
- Uso real: primer cliente oficial en la app parte así (nuevo bloque en Mantención). Sus fotos antiguas quedan en su planilla de Sheets.

## v1.35.1 (20-nov) — Extras en la pauta
- La pauta (porciones de intercambio) ahora suma los extras que están en TODAS las opciones (ej. un postre fijo en gramos), fuera de comidas libres con presupuesto. Se muestran como filas "Extra" (solo lectura, vienen de las opciones) en la tabla de la pauta, y cuentan en el aviso pauta vs metas, en "Usar los macros de la pauta" y en las alertas. Helpers `pautaExtras(menus, leg)` y `pautaMac(pauta, extras)` en foods.js.
- Ojo al revisar planes pasados desde PDF: si el huevo se contó como "carne baja en grasa" (11 g P, 2 g L por porción) pero las metas del PDF usan valores reales del huevo, la pauta queda con más proteína y menos grasa que las metas.

## v1.35.2 (20-nov) — Importar rutinas
- Entrenamiento (coach) → "Importar rutinas" junto a "＋ Nueva rutina": sube `ima-rutinas.json` (`{type:"ima-rutinas", client, routines:[{name, days:[0-6 getDay], note?, exercises:[{name, sets:[{reps, rir}], notes?, video?, wSug?, weekNote?}]}]}`). Reemplaza TODAS las rutinas del cliente (borra las anteriores; los entrenamientos registrados no se tocan), enlaza cada ejercicio con la biblioteca por nombre sin tildes (video, reemplazos, libId) y agrega a la biblioteca los que falten, arma el calendario (schedule con null explícito en los días sin rutina porque Firestore mezcla mapas) y limpia rutReview.
- El JSON se arma fuera del repo desde la hoja de entrenamiento del cliente (ojo: Sheets guarda "8-10" como 10.8 y "6-8" como fecha 6-ago; pesos con punto como fecha d-m).

## v1.35.3 (20-nov) — Cliente que aún no parte
- Si hoy < startDate: el cliente no tiene pendientes (campana en 0, "Todo al día"), ve una tarjeta "Tu plan parte mañana / el …" con la invitación a recorrer Mi plan, Entreno y Ajustes, la franja dice "Partes el …" y los días antes de partir no muestran rutina. weekPlan deja sin entrenamientos las semanas que terminan antes de startDate (no hay "atrasados").

## v1.36.0 (22-nov) — Rotación de rutinas (motor) + appFrom
- `appStart(c)` = la fecha mayor entre `startDate` y `appFrom`. `appFrom` (opcional) = día en que el cliente empieza a usar la app cuando la semana 1 parte antes (ej. semanas dom–sáb y empieza el lunes). Lo usan pendientes, la tarjeta "Tu plan parte…", la franja de días, weekPlan, reviewWindow, la cabecera del panel y el aviso "Empieza (a usar la app) el …".
- `c.rotation = { on, order:[routineId…], perWeek, days:[dow sugeridos], minRest }` + `isRotation(c)`, `nextInRotation(c, sessions)`. weekPlan en rotación: lo hecho en la semana queda en su fecha; lo que falta se reparte desde hoy en los días sugeridos respetando minRest desde el último entreno (si no alcanza, usa días no sugeridos); la rutina sigue la alternancia desde la última sesión (A→B→A…). Devuelve además `rotation, missing, next:{rid,name}, total` y en slots `sug`, `rot`, `freeToday`.
- `plan.total` reemplaza a `plan.planned.length` en todos lados (en rotación = perWeek).

## v1.37.0 (22-nov) — Rotación con interfaz, dos fechas de inicio y check-in de la semana anterior
- **Panel → Entrenamiento → Configuración**: "Días fijos" / "Rotación" (`schedCfg`, acciones `tMode`, `rotMove`, `rotDel`, `rotAdd`, `rotSet`, `rotDay`). Al activar la rotación parte con todas las rutinas en orden, 3 por semana, L-Mi-V, 1 día de descanso mínimo (`ROT_DEF`). Muestra "Próximo entrenamiento". Volver a días fijos deja `rotation.on = false` (se conserva el orden).
- **Importar rutinas** acepta `rotation: {perWeek, days, minRest}` en el JSON: deja las rutinas en rotación en el orden del archivo. Si el cliente ya estaba en rotación, el orden se reemplaza por las rutinas nuevas.
- **Entreno del cliente** (train.js `rotCard`): tarjeta "Próximo entrenamiento: X" con Empezar si hoy puede, explicación de la regla, y aviso si ya no alcanzan los días. Badges "Sugerido" (clase `sugd`, ojo: `.sug` ya existía para las sugerencias de carga) y "Para completar" (día no sugerido que la app usó para que alcance). Día de descanso con `freeToday`: "(puedes entrenar si quieres)" + Empezar.
- **Panel Timeline**: en rotación muestra "Rotación · próximo X", badges sugerido / para completar y "Le faltan N" si `missing`.
- **Campana (alerts.js)**: en rotación avisa `missing` y si entrenó sin el descanso mínimo ("Entrenó 2 días seguidos (…)", mira desde el último día de la semana anterior). reviewWindow lista las rutinas de `rotation.order` en vez de las del calendario.
- **Empezar de cero**: dos fechas, "Semana 1 desde" y "Empieza a usar la app el" (tiene que caer dentro de la semana 1; guarda `appFrom` o null). En Datos y objetivos también está el campo `appFrom`.
- **Check-in del día de inicio de semana** (data.js `ciOff`, `ciLate`, `ciWeek`, `ciOverdue`): si el día de check-in cae ≤ 2 días después de que parte la semana (ej. domingo con semanas dom–sáb), el check-in de ese día es el de la SEMANA ANTERIOR. `ciWeek(c, date)` → `{w, open}`: el sábado (último día) ya puede mandar el de esa semana; del domingo en adelante es el de la semana anterior; el pendiente/recordatorio sale el último día de la semana, el día de check-in y el siguiente. Sin `checkinDay` o con día a mitad de semana, todo sigue como antes (semana actual, pendiente los 2 últimos días). Lo usan checkinView, ciSave, el pendiente del inicio, el recordatorio y el ítem de Más. "¿Cuántos días registraste?" cuenta solo desde `appStart` (ej. "de 6"). En el panel, "No ha enviado el check-in de la semana N" sale recién pasado el día siguiente al de check-in (`ciOverdue`).
- **Marian (primera clienta con rotación)**: archivo `ima-rutinas-marian.json` (fuera del repo, entregado en el chat del 22-nov) con Fullbody A (11 ejercicios) y Fullbody B (10), nombres y tips de "Programa y Tips", reps por serie con RIR 1, peso sugerido = lo de su última sesión en la planilla (serie 1 / serie 2) y `rotation` L-Mi-V. Abdomen y Pantorrilla eran "2-3 series": van con 2 series y la nota "la 3ª es opcional". En el registro, "Hip Thrust/Patada" = "Patada de Glúteo en Máquina" (nombre de Programa y Tips). Planilla leída con el navegador integrado vía `gviz/tq?tqx=out:csv&sheet=…` (el conector de Drive solo trae la estructura, no los valores).


## v1.37.1 (22-nov) — Recordatorio de pago nuevo (pedido de Joaquín)
- `payMsg(c, pay, late)` en data.js. Día del pago: "Hola {nombre} 👋 / Hoy, {martes 1 de diciembre}, se renueva tu asesoría." + datos para transferir + "Una vez transferido recuerda enviarme el comprobante. Cualquier duda o consulta puedes escribirme por WhatsApp." Vencido ("Pago pendiente", en rojo): "Tu asesoría se renovaba el … y aún no tengo registrado el pago." + datos + comprobante + "Si ya pagaste, ignora este mensaje. Si tienes alguna dificultad, escríbeme por WhatsApp y lo vemos." Fecha con el mes completo (`longDate`). Se descartó el texto anterior ("lo que llevamos hasta ahora es puro trabajo tuyo").
- **Datos para transferir** en `library/payment` {name, rut, bank, type, number, email} (`PAY_FIELDS`), editables en Biblioteca → "Datos para transferir". NO van en el código (repo público). El cliente los lee solo el día del pago o si está vencido. Datos y objetivos muestra la vista previa de los dos mensajes.


## v1.37.2 (22-nov) — Kg sugerido por serie y semana correcta en la tabla
- **Kg sugerido por serie** (pedido de Joaquín): en la tabla semana a semana cada serie tiene su casilla de kg junto a reps y RIR (`sets[j].w`, opcional; se guarda con punto). Se quitó la columna única "Kg sug." (`e.wSug`). Las rutinas con `wSug` antiguo se migran al abrirlas en el panel (`migrateWSug`: "43 / 48" → serie 1 = 43, serie 2 = 48) sin marcarlo como cambio; queda guardado al tocar "Guardar cambios". El cliente ve "8 reps @RIR 1 · 43 kg" en "Lo que tienes que hacer hoy" y en "Ver rutina", y el kg sugerido como texto gris en la casilla de peso. Un cambio de kg sugerido se avisa al cliente ("serie 1: peso sugerido 45 kg"). La app sigue mostrando `wSug` viejo si una rutina no se ha vuelto a guardar.
- **Semana de "lo que va a hacer"**: ahora es la misma semana a la que se marcan los cambios al guardar: la siguiente si ya se abrió la revisión semanal; si no, la actual (y la 1 si el cliente aún no parte). Antes decía "Semana 2" para una clienta que todavía no empezaba. El botón "Sin cambios para la semana N" sigue usando la semana de la revisión.
- RE (rutina en edición) ahora es copia profunda de la rutina (antes copia superficial que compartía los ejercicios con la caché).
- Joaquín prefirió no dejarle pesos sugeridos a Marian: `ima-rutinas-marian.json` regenerado sin `wSug` (reimportar; ella aún no registra entrenamientos).


## v1.37.3 (22-nov) — Medidas "Próximamente", check-in antes de partir, femenino e indicaciones del plan
- **Medidas en pausa**: `MEASURES_SOON = true` en client.js. El cliente ve "Medidas · Próximamente" en Progreso y una tarjeta "Próximamente" en vez del formulario; la guía "Cómo medir" no se abre. Joaquín no está conforme con las indicaciones por zona (MEASURE_ZONES en data.js) y va a grabar videos de cómo medirse. Para reactivar: `MEASURES_SOON = false` (y revisar los textos de MEASURE_ZONES con él).
- **Check-in antes de partir**: `ciWeek` ya no devuelve la semana 0 (el domingo antes de que Marian partiera decía "Semana 0 · lun 23 nov – sáb 21 nov"). Si la semana que tocaría es anterior a `appStart`, muestra la semana en que parte (S01) sin pedirlo (`open: false`).
- **Textos en femenino**: `gtxt(texto, c)` e `isFem(c)` en data.js (c.sex === "F"). Cambia orgulloso, adolorido, seguro, hambriento, satisfecho, recuperado, relajado y despierto. Se aplica a las preguntas, opciones y "¿Por qué?" del check-in y a "Minutos despierto/a" del sueño. **Las respuestas se guardan en masculino** (valor canónico, para que las comparaciones y el panel no cambien); solo cambia lo que se muestra. La bienvenida ya usaba "Bienvenida". Si aparecen textos nuevos con género, pasarlos por `gtxt` o agregar la palabra a `FEM`.
- **Indicaciones del plan** (`client.plan.notes`, se muestran abajo de "Mi plan"): vuelve el campo en Datos y objetivos → Plan de alimentación ("Indicaciones del plan…"); antes venían del import y no se podían editar. Joaquín pidió sacar la nota del yogur de Marian (la borra él dejando el campo vacío).


## v1.37.4 (22-nov)
- Campana: "Falta el calendario semanal" ya no sale para clientes en rotación (no tienen días fijos).


## v1.37.5 (22-nov)
- Tabla de Clientes: la columna Pendientes queda plegada (`pendDrop`): puntos con la cantidad de rojos, amarillos e informativos (verde ✓ si no hay rojos ni amarillos); al tocarlos se despliega la lista de pendientes (queda abierta mientras no se recargue, `OPEN_P`). Pedido de Joaquín: la lista completa ocupaba demasiado espacio.


## v1.37.6 (22-nov)
- "Cambios sin guardar" en las rutinas aparecía en la cuenta real de Joaquín sin haber tocado nada (en el demo no se reproducía). Ahora se compara el contenido normalizado (`exDiff`/`canonX`: claves ordenadas, números como texto, sin campos vacíos ni `changed`) en vez del JSON tal cual. Si sigue apareciendo, la causa es otra (revisar el listener global de `change` en `[data-rdirty]`).



## v1.38.0 (22-nov) — Metas del plan balanceadas
- En Plan alimentación → "Metas de la etapa" (`tgBalance`, `tgSet` en menus.js): Calorías, Proteína, Lípidos y Carbohidratos en tarjetas, cada macro en **g y g/kg** (con el último peso, `c.lastKg`, o el peso guardado `calc.kg`), **% de las kcal** y lo que aporta la pauta (verde si calza: kcal ±5 %, macros ±10 %).
- **Compensador** (`MW.calc.comp`, se guarda con el plan; por defecto Lípidos, se elige con "Al cambiar un macro se ajusta: Lípidos / Carbohidratos"): al cambiar un macro, el compensador absorbe la diferencia para mantener las kcal; al cambiar las kcal, se ajusta el compensador; al cambiar el compensador mismo, cambian las kcal. Si el compensador quedaría negativo, queda en 0 y suben las kcal. Pedido de Joaquín: subir la proteína a 2 g/kg y que bajen solas las grasas para acercar las metas a la pauta.
- La calculadora de abajo (mantención × %, "Usar el cálculo", "Usar los macros de la pauta") sigue igual. `meTg` (casillas antiguas) quedó sin uso.


## v1.38.1 (22-nov)
- Etapas: se quitó la tarjeta "Base del cálculo" (mantención actual, peso, proteína y grasa por defecto): a Joaquín le confundía y sobraba. La mantención se fija con "Usar X kcal como mantención" del cálculo de requerimientos o en la calculadora de cada plan; proteína y grasa se ajustan en las metas balanceadas del plan. Los "% por defecto de cada etapa" quedaron plegados al final de Etapas. `kcalMaint`, `protKg`, `fatKg` siguen en la ficha (los usa la calculadora como valores de partida).


## v1.38.2 (23-nov) — Pago: "Pagó" y "Posponer"
- Datos y objetivos, junto al próximo pago: **✓ Pagó** y **Posponer…**. Badge "vencido" / "hoy" / "pospuesto al …".
- v1.38.3: **la fecha de pago es fija** (pedido de Joaquín: no depende de cuándo pagó, porque se puede atrasar). "Pagó" avanza `payDate` exactamente un período desde la fecha que tocaba (1 mes = mismo día del mes siguiente), borra `payGrace` y guarda `lastPaid`/`paidAt`; sin `payEvery` borra la fecha. "Posponer" NO mueve `payDate`: guarda `payGrace` (plazo acordado) y hasta ese día el cliente no ve el aviso; después vuelve a salir "Pago pendiente" con la fecha original. `payState(c)` en data.js → null / "pronto" (≤ 3 días, solo coach) / "hoy" / "vencido" / "pospuesto"; lo usan el inicio del cliente, la campana (gris "pospuesto hasta…") y Datos.


## v1.38.4 (23-nov) — Adherencia proporcional a lo que va de la semana
- Regla de Joaquín: la adherencia se mide contra lo que corresponde **hasta hoy** en la semana del cliente (que puede partir cualquier día), no contra 7 días ni contra la semana completa. Ej.: el martes, 2 de 2 entrenamientos está perfecto.
- data.js: `regSoFar(c, w, dayMap, test, today)` → `{k, n}`: días desde el inicio de la semana (o `appStart`) hasta ayer; hoy suma solo si ya lo registró. `trainSoFar(plan)` → `{done, due, total}`: `due` = total del plan menos lo que queda por delante (hoy incluido si no lo ha hecho; sirve para días fijos y rotación). `hasFood`, `ratioCls` (verde ≥ 70 %, amarillo ≥ 40 %, rojo).
- Se usa en: tabla de Clientes (Entrenos "hechos/hasta hoy" con "de N"; Comida y Pesajes k/n), Timeline semanal ("Días con registro" k/n y "X de Y hasta hoy" en Entrenamientos), preanálisis de la retro, tabla de semanas del cliente ("Días reg." k/n) y campana (comida: avisa si le faltan 2 o más días de esta semana; pesajes: menos de 3 de cada 7, desde 3 días). loadCtx ahora carga los días desde el inicio de la semana actual (o 7 días atrás, lo que sea antes).


## v1.38.5 (23-nov) — Fotos que no se subían
- Un cliente reportó que no se le subían las fotos. Causas posibles que fallaban en silencio: imagen que el celular no puede leer (HEIC en Android → `img.onerror` sin aviso, quedaba en "Subiendo…"), foto que pasa de 1 MB en base64 (Firestore la rechaza) y errores del servidor que solo iban a la consola.
- `compressImage` (util.js): usa `createImageBitmap` (respeta la orientación) con respaldo `<img>`; baja calidad y luego tamaño hasta quedar bajo ~800 KB; si no puede leer el archivo lanza un error con explicación (HEIC → cómo sacar en JPG). Fotos de progreso, de comida y de equipo muestran ese error en un toast; al guardar dice "Foto guardada ✓" (o "se sube al volver la señal").
- `db.set` (Firestore): si el servidor rechaza el guardado dispara `ima-write-error`; app.js muestra un toast ("sin permiso", "demasiado grande" o el código). Antes esos errores se perdían.
- Pendiente: confirmar con el cliente qué pasaba exactamente (celular, mensaje) si sigue fallando.

## v1.39.0 (23-nov) — Extra junto a su ejercicio, reps + RIR, progreso por ejercicio, base de alimentos confiable, Deshacer y guardado automático, audio de calidad
- **Ejercicio extra** (train.js `addExtraOk`): se inserta justo después del ejercicio en que está el cliente (y de los extras que ya le agregó), no al final; guarda `after` = exId del ejercicio anterior. En la tira de ejercicios sale "+" en vez de número (`exNum` cuenta solo los de la rutina) y en azul; título "Extra · fuera de la rutina". Las sesiones ya guardadas con el extra al final quedan como estaban.
- **Reps efectivas = reps + RIR** (`repsEff` en data.js; fallo = reps hechas). Regla de Joaquín: 7 reps RIR 1 = 8; 7 reps RIR 7 = 14. Se usa en "Lados parejos" (`pairDiff`: parejo si la diferencia es ≤ 1 rep efectiva y mismo peso; si no, "Der. vs Izq.: +6 reps contando el RIR (8 vs 14)") y en `setProgress` (con RIR en ambas semanas compara reps efectivas: 10 RIR 2 → 11 RIR 1 = se mantuvo).
- **Progreso por ejercicio, no por serie** (`exProgress`, `sessionProgress` en data.js): progresó = alguna serie mejor y ninguna peor; bajó; mixto; técnica peor; se mantuvo. Resumen del cliente: "X de Y ejercicios con progreso" + desglose, y una etiqueta por ejercicio. El preanálisis de la retro también cuenta ejercicios.
- **Base de alimentos** (client.js): causa de los "0 kcal": `offToFood` solo leía `energy-kcal_100g`; si el producto de Open Food Facts venía en kJ, solo por porción o sin tabla, quedaba todo en 0 **y se guardaba así en la base compartida `barcodes`**, por lo que cada escaneo posterior devolvía 0. Ahora: kJ → kcal, por porción → por 100 g, kcal desde macros si falta; sin datos = `incomplete` → abre "Crear" con código, nombre y marca para copiar la etiqueta. `saveBarcode` nunca guarda productos vacíos y repara uno propio que había quedado en 0. `lookupCode` ignora lo guardado en 0 y vuelve a consultar (`foodEmpty`; `zeroOk` = de verdad 0, ej. bebida zero). La búsqueda oculta los códigos compartidos en 0 y los resultados de OFF sin tabla. `foodCheck` avisa "todos los valores en 0". Los registros viejos en 0 en Firestore siguen ahí pero ya no se usan.
- **Panel: guardado automático + Deshacer / Rehacer** (js/undo.js, pedido de Joaquín: "se me va a olvidar guardar"). Fuentes registradas con `undoSource`: plan de alimentación de la etapa (`savePlan(W, silent)` en menus.js) y la rutina abierta (`saveRoutine(R, silent)` en coach.js). Después de cada acción (`afterActs` en ui.js) y de cada render se compara una foto canónica; si cambió se apila para deshacer y se guarda a los 1,2 s (o al cambiar de rutina/etapa/cliente, ocultar o cerrar la pestaña). Barra flotante abajo a la derecha: ↶ Deshacer · ↷ · "Guardando… / Guardado ✓". Ctrl+Z / Ctrl+Y fuera de los campos de texto. Se quitaron "Guardar y publicar", "Guardar cambios", "Cambios sin guardar" y la confirmación al cambiar de rutina/etapa. Importar un plan lo publica al tiro (se deshace con ↶). `forget("rutina")` al eliminar/importar rutinas para que el guardado no las recree.
- **Avisos al cliente de cambios en la rutina**: ahora se calculan contra cómo estaba la rutina antes de los cambios de esa semana (`changes.base`, `baseNote`, `pre`), así el guardado automático no apila pasos intermedios; si se deshace todo, `changes = null`. Guardar dentro de la revisión semanal marca la rutina como revisada (como antes al tocar Guardar).
- **Campana**: "su peso bajó/subió X kg desde que calculaste las metas", "Se pesó k de n días" y "Registró comida k de n días" pasan a gris (dato): Joaquín no los puede "arreglar". Amarillo/rojo = cosas que él tiene que resolver.
- **Audio del cliente**: se grababa a 24 kbps (sonaba distorsionado). Ahora 64 kbps m4a (48 kbps si es Opus), mono, sin cancelación de eco. Como pasa de 1 MB, se guarda en partes (js/audiostore.js: `audios/{id}` con `parts` + `audios/{id}~p2`…); los audios antiguos se leen igual.
- Pendiente: lo demás del panel (Datos ya se guardaba solo; Biblioteca, retro, etapas) no tiene Deshacer todavía.

## René (22-nov) — paso a la app desde cero
- `ima-rutinas-rene.json` (fuera del repo, entregado en el chat del 22-nov): 4 rutinas con días fijos (Tren Inferior A lun, Tren Superior A mar, Tren Inferior B jue, Tren Superior B vie), 30 ejercicios, series/reps de su última semana de la planilla, sin pesos sugeridos, tips de "Programa y Tips" (typos corregidos: Leg Extension, Dip Machine Hammer Strength). En su planilla el RIR está como RPE: @10 = RIR 0, @9 = RIR 1, @8 = RIR 2 (RDL). Las casillas de reps vacías de la última semana quedaron en 8, 6 (decisión de Joaquín: "ante la duda, 8, 6"): Leg Extension B, Prensa HS, Abductores B, Dip Machine, Jalón B. Aductores B: 1 serie de 8, RIR 0. El leg curl es "Leg Curl Unilateral Acostado" (la app le pide Izq/Der).
- Zona horaria: la app del cliente usa la hora de su celular y los recordatorios usan su zona (`settings/reminders.tz`); el panel del coach calcula "hoy" con la hora de Chile (Alemania va 4 h adelante: de noche en Chile el panel puede ir un día atrás respecto de René). Idea si molesta: `client.tz` y calcular el hoy de cada cliente en el panel.
- Partida: "Empezar de cero" con semana 1 desde el lunes 23-nov (semanas lun–dom), check-in sábado, Mantención. Está en Alemania (la app usa la hora de su celular).

## v1.39.1 (23-nov) — Calendario solo para una semana
- `client.weekSched = { S0N: {0..6: routineId|null} }` + `schedFor(c, weekKey)` en data.js: si esa semana tiene calendario propio se usa ese; si no, el de siempre (`schedule`). Lo usan `weekPlan` (devuelve `special`) y la franja de días del cliente (`dayTag`).
- En una semana especial, si ese día el cliente hizo OTRA de sus rutinas (siguen todas en "Todas tus rutinas"), cuenta como hecho.
- Panel → Entrenamiento → Configuración (días fijos): "＋ Calendario distinto solo esta semana" / "＋ Solo la semana N+1" (parte copiando el de siempre), selects por día (`wsSet`) y "Quitar" (`wsDel`, deja `null`). La revisión semanal y "Falta el calendario" siguen mirando el calendario de siempre.
- Uso: Vicente, semana 1 (23–29 nov) con menos tiempo: rutina "Fullbody (semana con menos tiempo)" mar/jue/dom; sus rutinas oficiales siguen siendo Inferior/Superior desde la semana 2.

## v1.40.0 (24-nov) — Solo entrenamiento revisado con Gabriel
- **Calculadora de macros del cliente** (`#calc`, "Mi calculadora de macros" en Más; reemplaza "Mi guía de macros"; tarjeta "Calcula tus calorías y macros" en el inicio mientras no la use, y aviso si su peso cambió ≥ 2 kg desde el cálculo). Datos (sexo, nacimiento, estatura, peso = último pesaje, actividad `ACT_LEVELS`) → mantención Mifflin-St Jeor × actividad → objetivo `SELF_GOALS`: Mantención 0 %, Déficit ligero −10 %, Déficit moderado −20 %, Superávit ligero +10 % (nada más agresivo sin el coach) → proteína y grasa en g/kg con flechas de 0,1 dentro de los rangos del coach (`c.ranges`, por defecto P 1,6–2,0 · G 0,8–1,2; `DEFAULT_RANGES`), CHO = el resto, con % de kcal y barra; consejo de priorizar carbohidratos. Se guarda en `clients/{id}/settings/calc` (el cliente no puede escribir su ficha). `selfCalc(x)` en data.js.
- **Metas**: `applyStage` (ahora envuelve a `applyStage0`) usa `c.selfCalc` en solo entrenamiento: kcal/CHO/grasa/proteína de su cálculo mandan sobre las de la ficha y las etapas. `selfCalc` se adjunta en clientView (cliente), clientPanel (coach) y loadCtx (alertas). Pasos y agua los sigue fijando el coach.
- Panel → Datos (solo entrenamiento): resumen de su cálculo y rangos sugeridos de proteína y grasa (se quitó el de CHO).
- **Digestión** en el inicio también para solo entrenamiento (`home_digest` por defecto en los 3 servicios; si en Biblioteca → Servicios estaba desmarcado, manda la casilla).
- **Rotación "día por medio"** (`rotation.everyOther`, casilla en Configuración; fija minRest 1): sin días fijos; cada entreno sugerido al primer día que respeta el descanso; `perWeek` = objetivo mínimo; cumplido el objetivo siguen sugerencias **opcionales** (`slot.extra`, badge "Opcional", no cuentan para adherencia ni `missing`).
- **Timeline del cliente** (solo entrenamiento): sin calendario nutricional ni etapa; tarjeta "Tu objetivo" con lo de su calculadora.
- **Check-in**: sin plan de alimentación se ocultan `PLAN_Q` (adhPlan, nutDificil, nutFacil, nutMejorar, fueraPlan); se mantiene la tendencia de consumo, hambre, saciedad y antojos.

## Vicente (23-nov) — paso a la app desde cero
- Planilla: "Coaching - Vicente Núñez" (leída con el navegador integrado vía gviz CSV: Registro Entrenamiento + Programa y Tips).
- "Empezar de cero": semana 1 desde lun 23-nov (semanas lun–dom), usa la app desde mar 24-nov, Mantención 8 semanas. Se borraron los 20 entrenamientos importados el 18-nov (su historial sigue en la planilla). Check-in lunes (= semana anterior).
- Rutinas importadas (JSON armado en el navegador, no se guardó en el repo): Tren Inferior A (mar), Tren Superior A (jue), Tren Inferior B (vie), Tren Superior B (dom); 29 ejercicios con las series/reps de su semana 8. Decisión de Joaquín: **todo RIR 1 salvo las pantorrillas (RIR 0)**; nombres del Registro (no los de Programa y Tips): "Leg Extension Bilateral" (con los tips de Leg Extension), "Extensión de Tríceps DB" y "Pantorrilla Unilateral en Smith" quedan sin tips. Con 3 series y reps "8, 6" la 3ª repite la última (8, 6, 6). Sin pesos sugeridos. Unilaterales (Izq/Der por el nombre): Pantorrilla Unilateral en Smith, Extensión de Tríceps Unilateral Polea, Remo Foco Dorsal Unilateral en Polea. En su planilla los RIR hechos están como RPE (9 = RIR 1, 10 = RIR 0).
- Ya tenía el plan de Mantención (4 alternativas, metas 2617 kcal · C 350 · L 76 · P 133, nota "todas llevan 20 g de chía"). Pendiente de Joaquín: darle acceso (Datos y objetivos), armar el día con legumbres como opción propia y revisar los avisos del plan (Alternativa 4: lípidos −9; porciones distintas a la pauta en Alt. 1–3).

- v1.40.1: panel del coach para solo entrenamiento sin nada de plan ni etapas: sin pestañas Etapas ni Plan alimentación, sin etapa en la cabecera, Timeline semanal con el calendario sin etapas, tabla de semanas con "Objetivo" (de su calculadora) en vez de "Etapa" (también en el Timeline del cliente), y en Datos sin selector de etapa, link al PDF ni pauta ("Indicaciones de alimentación" las ve en su calculadora). Campana: gris "Aún no calcula sus macros".

- v1.40.2: campana: "Le toca pagar el …" y "Hoy le toca pagar" pasan a gris (dato); solo el pago vencido queda en rojo. Calculadora: fecha de nacimiento y estatura NO se prellenan con la ficha (son aproximadas): las llena el cliente; sexo y peso sí.

- v1.40.3: arreglo urgente — la 1.40.2 no cargaba: un comentario `//` agregado a mitad de línea comentó el resto del código (alerts.js y client.js). **Antes de publicar, revisar SIEMPRE con `node --input-type=module --check < archivo`** (el `node --check archivo.js` a secas no detecta estos errores) y cargar los módulos en el demo.

## v1.41.0 (24-nov) — Grabar en cualquier momento
- Botón "🎥 Grabar video" en la cabecera de la ficha de cada cliente y "🎥 Grabar" en la barra amarilla de "Ver como cliente" (para grabar mostrándole la app). Usa el mismo grabador (`startRecording` sin guion). Al terminar (`freeRecSheet`): título, "Subir a mi Drive y mandárselo a X" (`frSend` → `clients/{id}/videos/{id}` {title, url, secs, at, seen}), "Solo subir y copiar el link" (`frLink`), descargar o descartar.
- Cliente: tarjeta "🎥 Tu coach te mandó un video" en el inicio mientras no lo vea (al abrirlo se marca `seen`, salvo en la vista previa del coach) y Más → "Videos de tu coach" (`#videos`).
- v1.42.0: velocidad 1x–2x también en videos de Drive (retro semanal y videos del coach): `CONFIG.driveKey` (clave de API restringida a Google Drive API y a https://nutrijrcoaching.github.io/*) → `directSrc` en player.js lee el archivo por la API (`files/{id}?alt=media`) con el reproductor propio (`speedPlayer`). La clave de Firebase NO sirve (está restringida a APIs de Firebase: 403). Sin driveKey sigue el iframe de Drive. Pendiente: que Joaquín cree la clave.
- v1.41.5: aviso al celular cuando el coach le manda un video (scripts/reminders.mjs): videos con `seen == false` y sin `notified` → push "🎥 Tu coach te mandó un video" + título, entre 8:00 y 22:00 hora del cliente, aunque no tenga los recordatorios activados (basta con los avisos con la app cerrada); marca `notified`. Llega cuando corre el reloj de GitHub (≈ cada hora).
- v1.41.4: botón "⬆ Mandar un video" en la cabecera de la ficha (archivo del computador → mismo flujo que Grabar: título, subir a Drive y mandárselo). La subida siempre parte con un clic ("Subir…"), porque si parte al elegir el archivo Chrome bloquea la ventana de permiso de Drive y quedaba colgado sin aviso (pasaba con "Subir un video que ya tengo" de la retro; ahora pide un segundo clic). `getToken` con `error_callback`: avisa si la ventana se bloquea o se cierra.
- v1.41.3: Retroalimentación → "🎥 Videos que le mandaste": título, fecha, "Visto el … ✓" / "Aún no lo ve", abrir y quitar (`vidDelSent`; el archivo queda en Drive).
- v1.41.2: grabador en 1080p a 3 Mbps (antes 720p a 1,2 Mbps; ≈ 22 MB por minuto en Drive) y cámara de la burbuja en 720×720.
- v1.41.1: burbuja de la cámara sin borde rojo (en pantalla y en el video compuesto). Audio del grabador: Opus 96 kbps (antes 64), mono, sin cancelación de eco (no hay llamada), con supresión de ruido y ganancia automática.

## Gabriel (24-nov) — paso a la app desde cero (primer cliente de solo entrenamiento)
- "Empezar de cero": semana 1 desde lun 23-nov (semanas lun–dom), usa la app desde mié 25-nov (no tenía registros).
- Rotación Fullbody A → Fullbody B, día por medio (`everyOther`), objetivo mínimo 2 por semana (puede hacer más: salen como "Opcional"). Pasos 7.000. Metas de kcal/macros: las calcula él en su calculadora.
- Pendiente de Joaquín: su correo (no tiene) para darle acceso, y su día de check-in.

PENDIENTE:
1. Joaquín: en la ficha de Marian, "Empezar de cero" (semana 1 desde dom 22-nov, usa la app desde lun 23-nov, Mantención) si aún no se hizo, revisar que Día de check-in = domingo, e importar `ima-rutinas-marian.json` en Entrenamiento (queda en rotación sola).
2. Verificar en su celular la primera semana (Próximo / Sugerido, check-in del domingo 29 = semana 1).
4. (Probablemente resuelto en v1.39.0: ya no existe el aviso; todo se guarda solo) "Cambios sin guardar" sigue apareciendo en las rutinas de Marian en la cuenta real aunque no se toque nada (también después de v1.37.6). No es grave (guardar sin cambios no marca nada al cliente). Para encontrarlo: abrir su ficha con el navegador integrado logueado y comparar `RE.orig` vs `RE.r.exercises` en la consola; sospechar del listener global de `change` en `[data-rdirty]` o de alguna re-renderización que modifica RE.r.
3. Joaquín: llenar Biblioteca → Datos para transferir (sus datos los dio en el chat del 22-nov; no se guardan en este archivo).
