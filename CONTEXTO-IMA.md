# CONTEXTO-IMA — léelo primero

Resumen para retomar el desarrollo en un chat nuevo sin el historial. Actualizado: 20-nov-2026, versión **1.27.0**.

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
- `ima-planes.json` regenerado: chía (INTA, por 100 g), Nutella (etiqueta 539/57,5/30,9/6,3), jalea sin azúcar = 0, y los 3 extras KFC de Felipe con el total de la tarjeta del PDF (1431 kcal · C 111 · L 68 · P 99) **repartido según gramos** (aproximado: corregir en el editor si tiene los valores por producto). Se quitó el "(" que quedaba al final de algunas medidas.
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
- Felipe alt. 4: `noTime` y "Durante el día (KFC)" libre con el total de su PDF (1431 kcal · C 111 · L 68 · P 99); los productos KFC quedan como referencia sin macros propios (antes se repartía el total por gramos y se veía raro).
- **Colores por tiempo de comida** en Mi plan (`mealColor`): desayuno ámbar, colación AM turquesa, almuerzo rojo, colación PM violeta, once azul, cena índigo, pre entreno verde, libre gris; borde y cápsula con `--mc`.
- **Lista de compras en crudo** (`toRaw`): lo cocido con par crudo en la base de intercambio y del mismo grupo se pasa a crudo con las mismas porciones (arroz, fideos, quínoa, cous cous, legumbres). Las carnes quedan como están hasta que Joaquín defina si las porciones de su base son en crudo o cocido (por los macros, 50 g = 11 g de proteína calza más con carne cruda).
- Import: el PDF guarda "(" y "×" como caracteres privados (U+E081, U+E09F); `fixtxt` los convierte. Ya no quedan medidas con "(" suelto.
- Casillas del editor con estilo `label.chk`.
