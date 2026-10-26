// asistente.js
//
// Asistente de ayuda: una ventana de chat que responde las dudas sobre el uso
// de la plataforma con las preguntas frecuentes del manual de usuario. No usa
// inteligencia artificial ni servicios externos: busca las palabras de la
// pregunta en cada respuesta y muestra la que mejor coincide. Si ninguna
// coincide, lo dice y propone temas parecidos.
//
// La búsqueda (responder) es una función pura; la ventana se arma solo en el
// navegador.

(function (raiz) {
  'use strict';

  // Cada entrada: pregunta que se muestra, palabras clave (incluye sinónimos),
  // respuesta (párrafos separados por \n; las líneas que empiezan con «• » se
  // muestran como lista) y, si aplica, el paso al que lleva el botón «Ir».
  const PREGUNTAS = [
    { id: 'que-hace', paso: 0, pregunta: '¿Qué hace esta plataforma?',
      claves: 'plataforma aplicacion herramienta para que hace objetivo programa pagina',
      respuesta: 'Calcula cuánta energía consume un proyecto, cuántos paneles solares necesita y qué equipo de conversión (regulador o inversor) y qué baterías debe usar. Al final genera un informe en PDF.\nTiene seis pasos: Proyecto, Cargas, Resultados, Generador, Conversión e Informe. Cada paso usa lo que ya escribió en los anteriores.' },
    { id: 'empezar', paso: 0, pregunta: '¿Por dónde empiezo?',
      claves: 'empezar empiezo comenzar comienzo inicio iniciar primero primer paso arrancar',
      respuesta: 'Pulse «Comenzar» y llene el Paso 1 (nombre del proyecto, integrantes, fecha y contexto). Luego pulse «Guardar datos del proyecto» y siga con «Siguiente».\nSi ya tiene un proyecto guardado en un archivo .json, ábralo en el Paso 1 con «Cargar proyecto desde archivo».', ir: 1 },
    { id: 'contexto', paso: 1, pregunta: '¿Qué contexto elijo: on-grid, off-grid o híbrido?',
      claves: 'contexto ongrid offgrid on grid off hibrido red electrica aislado conectado tipo sistema',
      respuesta: '• On-grid: el lugar tiene red eléctrica y los paneles le ayudan. No lleva baterías.\n• Off-grid: el sistema es aislado, sin red. Lleva baterías.\n• Híbridos: combinan los dos casos.\nEl contexto decide si el Paso 5 empieza con baterías o sin ellas; allí se puede cambiar.', ir: 1 },
    { id: 'ejemplo', paso: 1, pregunta: '¿Cómo abro un proyecto de ejemplo?',
      claves: 'ejemplo ejemplos escenario cartagena caso prueba precargado demostracion resuelto',
      respuesta: 'Los ejemplos son archivos .json (por ejemplo, escenario_f_cartagena.json, en la carpeta ejemplos del repositorio). Descárguelo y, en el Paso 1, pulse «Cargar proyecto desde archivo» y elíjalo. Se cargan las cargas, el sitio y los equipos, y todos los pasos quedan calculados. Puede cambiar cualquier dato después.', ir: 1 },
    { id: 'guardar', paso: 1, pregunta: '¿Cómo guardo mi proyecto y lo vuelvo a abrir?',
      claves: 'guardar guardo abrir recuperar archivo json descargar proyecto perder trabajo continuar despues',
      respuesta: 'En el Paso 1 pulse «Guardar proyecto en archivo (.json)»: se descarga un archivo con todo lo que escribió.\nPara seguir después, pulse «Cargar proyecto desde archivo» y elija ese archivo. El proyecto queda tal como estaba.', ir: 1 },
    { id: 'agregar-carga', paso: 2, pregunta: '¿Cómo agrego un aparato (carga)?',
      claves: 'agregar anadir carga cargas aparato aparatos equipo electrodomestico registrar cuadro',
      respuesta: 'En el Paso 2:\n• Escriba el nombre del aparato, cuántos hay iguales y la potencia de cada uno en vatios (W).\n• Marque las horas en que está encendido.\n• Pulse «Agregar carga al cuadro».', ir: 2 },
    { id: 'potencia-aparato', paso: 2, pregunta: '¿Dónde encuentro la potencia de un aparato?',
      claves: 'potencia vatios w watts placa etiqueta consumo aparato hp caballos fuerza saber cuanto consume',
      respuesta: 'Búsquela en la placa o etiqueta del aparato, o en su manual: aparece en vatios (W). Si solo da los amperios, multiplíquelos por la tensión para tener un valor aproximado (por ejemplo 2 A × 120 V ≈ 240 W).\nSi la placa da caballos de fuerza (HP), use la potencia eléctrica; como referencia del curso, 0,5 HP ≈ 600 W y 1 HP ≈ 1.100 W.' },
    { id: 'horario', paso: 2, pregunta: '¿Cómo marco el horario de uso?',
      claves: 'horario horas hora marcar casilla casillas franja encendido tiempo cuadricula desde hasta',
      respuesta: 'Cada casilla es una hora completa: 08:00 significa de 08:00 a 09:00.\nPara marcar varias horas a la vez use «Marcar franja»: elija «desde» y «hasta» (por ejemplo 08:00 a 20:00) y pulse el botón. «Limpiar horas» quita todas las marcas.', ir: 2 },
    { id: 'medianoche', paso: 2, pregunta: '¿Cómo marco un horario que pasa de medianoche?',
      claves: 'medianoche noche cruza cruce pasa 24 madrugada invertido invertida 22 04 noche dia siguiente',
      respuesta: 'Use «Marcar franja» con la hora final menor que la inicial, por ejemplo desde 22:00 hasta 04:00. La plataforma marca de 22:00 a medianoche y de medianoche a 04:00, y le avisa que la franja cruza la medianoche.', ir: 2 },
    { id: 'dos-franjas', paso: 2, pregunta: '¿Y si el aparato se usa en dos momentos del día?',
      claves: 'dos momentos franjas varias manana tarde dos veces horarios separados discontinuo',
      respuesta: 'Marque la primera franja con «Marcar franja», cambie «desde» y «hasta» y vuelva a pulsar «Marcar franja». Las horas se suman en la misma carga. También puede marcar las casillas una por una.', ir: 2 },
    { id: 'editar-carga', paso: 2, pregunta: '¿Cómo corrijo o elimino una carga?',
      claves: 'editar corregir corrijo cambiar modificar eliminar elimino borrar borro quitar quito carga equivoque',
      respuesta: 'Seleccione la carga en la tabla (haga clic en su fila).\n• Para corregirla pulse «Editar carga seleccionada», cambie los datos y pulse «Guardar cambios».\n• Para quitarla pulse «Eliminar carga seleccionada» y confirme.\nLos resultados se recalculan solos.', ir: 2 },
    { id: 'no-agrega', paso: 2, pregunta: '¿Por qué no me deja agregar la carga?',
      claves: 'no deja agregar error rojo mensaje rechaza duplicada repetida negativa cero vacia falla',
      respuesta: 'El mensaje en rojo dice qué corregir. Los casos más comunes:\n• La potencia está vacía, es cero o negativa.\n• La cantidad es cero o no es un número entero.\n• No marcó ninguna hora de uso.\n• Ya existe una carga igual (mismo nombre, potencia y horario): edítela o aumente su cantidad.', ir: 2 },
    { id: 'medicion', paso: 2, pregunta: '¿Qué es «Perfil medido con el equipo»?',
      claves: 'medicion medido equipo medidor esp32 pinzas hoja datos csv sensor real',
      respuesta: 'Es opcional. Si tiene el equipo de medición (pinzas y nodo ESP32), puede cargar el archivo que registró y la plataforma usa el consumo real hora por hora. Si no lo tiene, no haga nada: el perfil se calcula con las cargas que registró.', ir: 2 },
    { id: 'cu', paso: 3, pregunta: '¿Qué es el CU?',
      claves: 'cu costo unitario precio tarifa kwh pesos valor energia factura',
      respuesta: 'Es el costo unitario de la energía: lo que se paga por cada kilovatio hora (kWh), en $/kWh. Aparece en la factura de la luz. Con él se calculan los costos diario, mensual y anual.\nSi escribe 0, la plataforma calcula igual pero le avisa que los costos saldrán en $ 0.', ir: 3 },
    { id: 'dias', paso: 3, pregunta: '¿Qué son los días de operación?',
      claves: 'dias operacion mes ano anio funcionamiento trabaja abre cuantos dias',
      respuesta: 'Son los días en que se usan las cargas: al mes (1 a 31) y al año (1 a 366). Con ellos la energía diaria se pasa a energía mensual y anual, y a costos. Por ejemplo, un negocio que abre todos los días usa 30 al mes y 365 al año.', ir: 3 },
    { id: 'ventana', paso: 3, pregunta: '¿Qué es la hora de inicio y fin del día?',
      claves: 'ventana solar inicio fin dia hora diurna nocturna mixta clasificacion sol amanece',
      respuesta: 'Es la ventana solar: las horas en que hay sol (por defecto de 06:00 a 18:00). Sirve para clasificar cada carga en diurna, nocturna o mixta y para saber cuánta energía se consume con sol. La hora de inicio debe ser anterior a la de fin.', ir: 3 },
    { id: 'demanda', paso: 3, pregunta: '¿Qué diferencia hay entre potencia instalada y demanda máxima?',
      claves: 'potencia instalada demanda maxima pico diferencia simultanea mayor consumo hora',
      respuesta: '• Potencia instalada: la suma de las potencias de todos los aparatos, como si todos estuvieran encendidos a la vez.\n• Demanda máxima: la mayor potencia que se usa realmente en una misma hora, según los horarios. También se muestra a qué hora ocurre.', ir: 3 },
    { id: 'demanda-repetida', paso: 3, pregunta: '¿Qué pasa si la demanda máxima se repite en varias horas?',
      claves: 'demanda maxima repite repetida varias horas igual empate misma',
      respuesta: 'La plataforma reporta la primera hora en que ocurre y le muestra la lista de las otras horas con el mismo valor.', ir: 3 },
    { id: 'energia', paso: 3, pregunta: '¿Cómo se calcula la energía diaria?',
      claves: 'energia diaria kwh calcula calculo mensual anual consumo perfil formula',
      respuesta: 'Se suma la potencia de cada hora del perfil de 24 horas y se pasa a kWh (cada hora cuenta 1 h). La energía mensual es la diaria por los días al mes, y la anual, la diaria por los días al año.', ir: 3 },
    { id: 'potencia-pico', paso: 4, pregunta: '¿Qué es la potencia pico (kWp)?',
      claves: 'potencia pico kwp wp paneles generador cuantos paneles necesito tamano',
      respuesta: 'Es la potencia que deben tener los paneles en condiciones estándar. Se calcula como Ppico = energía diaria / (HSP · PR). Con ella la plataforma elige el módulo y cuántos se necesitan.', ir: 4 },
    { id: 'hsp', paso: 4, pregunta: '¿Qué es la irradiación o HSP?',
      claves: 'hsp horas sol pico irradiacion radiacion recurso solar kwh m2 sol',
      respuesta: 'Es la energía del sol que llega a los paneles en un día, en kWh/m²·día. Equivale a las horas de sol pico (HSP): un valor de 5 significa lo mismo que 5 horas de sol a 1.000 W/m².', ir: 4 },
    { id: 'criterio', paso: 4, pregunta: '¿Dimensiono con el mes de menor recurso o con el promedio anual?',
      claves: 'mes critico menor recurso promedio anual criterio cual elijo dimensionar con',
      respuesta: '• Promedio anual: suele usarse si hay red eléctrica (on-grid), porque la red cubre los meses con menos sol.\n• Mes de menor recurso: más seguro para sistemas aislados (off-grid), porque los paneles deben alcanzar incluso en el peor mes.\nLa plataforma muestra los dos resultados.', ir: 4 },
    { id: 'pr', paso: 4, pregunta: '¿Qué es el factor de desempeño PR?',
      claves: 'pr factor desempeno rendimiento perdidas performance ratio 0 70',
      respuesta: 'Agrupa las pérdidas del sistema: temperatura, suciedad, cables y conversión. Un PR de 0,70 quiere decir que llega a las cargas el 70 % de lo que producirían los paneles ideales. El valor de referencia del curso es 0,70.', ir: 4 },
    { id: 'sitio', paso: 4, pregunta: 'Mi ciudad no está en la lista, ¿qué hago?',
      claves: 'ciudad sitio lugar ubicacion lista no esta nasa power consultar coordenadas latitud longitud municipio',
      respuesta: 'Abra «Consultar otra ubicación en línea (NASA POWER)», escriba la latitud y la longitud del lugar, elija la inclinación y pulse «Consultar NASA POWER». El sitio se agrega a la lista.\nSi no hay internet, la plataforma sigue con la base de datos local y se lo avisa.', ir: 4 },
    { id: 'segunda-fuente', paso: 4, pregunta: '¿Qué es el contraste con una segunda fuente?',
      claves: 'segunda fuente contraste comparar nasa pvgis 15 diferencia porcentaje verificar',
      respuesta: 'Compara la irradiación y la potencia pico calculadas con la fuente principal (PVGIS) contra otra base de datos (NASA POWER). Se acepta una diferencia de hasta ±15 % en la potencia pico; la tabla dice si se cumple.\nCon el botón «Consultar NASA POWER para este sitio» se actualiza en línea.', ir: 4 },
    { id: 'temperaturas', paso: 4, pregunta: '¿Para qué piden la temperatura mínima y la de operación?',
      claves: 'temperatura minima operacion ambiente frio calor voc vmp grados',
      respuesta: 'Los paneles cambian de tensión con la temperatura:\n• Con frío la tensión sube: con la temperatura mínima se revisa que no se pase del límite de los equipos.\n• Con calor la tensión baja: con la temperatura de operación se revisa que alcance para que el equipo funcione.\nUse los datos del clima del sitio (por ejemplo, del IDEAM).', ir: 4 },
    { id: 'area', paso: 4, pregunta: '¿Qué pasa si los paneles no caben en el área?',
      claves: 'area no cabe espacio techo metros cuadrados m2 disponible',
      respuesta: 'La plataforma le avisa que el generador no cabe. Puede revisar el área disponible, elegir un módulo de mayor potencia (ocupa menos espacio por kWp) o aceptar un generador más pequeño.', ir: 4 },
    { id: 'baterias', paso: 5, pregunta: '¿Mi sistema lleva baterías?',
      claves: 'baterias bateria almacenamiento con sin rama regulador inversor lleva',
      respuesta: 'Depende del contexto del Paso 1:\n• On-grid: normalmente sin baterías. Se revisa un inversor conectado a la red.\n• Off-grid: con baterías. Se revisan el regulador y el banco de baterías.\nEn el Paso 5 puede cambiar la opción en «¿El sistema tiene baterías?».', ir: 5 },
    { id: 'veredictos', paso: 5, pregunta: '¿Qué significa cumple, alerta y no cumple?',
      claves: 'cumple alerta veredicto verde amarillo rojo significa',
      respuesta: '• Cumple: el equipo funciona con sus paneles.\n• Alerta: funciona, pero con una limitación (por ejemplo, pierde algo de energía en las horas de más sol).\n• No cumple: no se puede usar así; la tarjeta dice por qué.', ir: 5 },
    { id: 'ninguno-sirve', paso: 5, pregunta: '¿Qué hago si ningún equipo sirve?',
      claves: 'ninguno equipo funciona catalogo inversor regulador agregar reorganizar resolver problema',
      respuesta: 'Lea el resumen de arriba del Paso 5: si hay arreglo, aparece un botón para hacerlo («Agregar paneles» o «Reorganizar los paneles»).\nSi no hay arreglo, hace falta otro equipo: descargue el catálogo al final del paso, agregue el equipo con los datos de su ficha técnica y vuelva a cargarlo.', ir: 5 },
    { id: 'dcac', paso: 5, pregunta: '¿Qué es la relación DC/AC?',
      claves: 'dc ac relacion inversor tamano grande pequeno recorte sobredimensionado',
      respuesta: 'Es la potencia de los paneles dividida por la potencia del inversor. Entre 1,0 y 1,3 está bien. Mayor que 1,3, el inversor es pequeño y se pierde energía en las horas de más sol; menor que 1,0, el inversor es más grande de lo necesario.', ir: 5 },
    { id: 'autonomia-noche', paso: 5, pregunta: '¿Días completos sin sol o solo el consumo de la noche?',
      claves: 'autonomia noche nocturno nocturna noches dias completos hibrido cubrir baterias deben cubrir respaldo',
      respuesta: '• Días completos sin sol: el banco alimenta todas las cargas durante N días nublados seguidos. Es el método del curso y el usual en sistemas aislados.\n• Solo el consumo de la noche: el banco cubre la energía de las horas fuera de la ventana solar (tomada del perfil horario) durante N noches; de día los paneles alimentan las cargas. Da un banco más pequeño y sirve en sistemas híbridos.\nSe elige en el Paso 5, en «¿Qué deben cubrir las baterías?».', ir: 5 },
    { id: 'paralelo', paso: 5, pregunta: '¿Qué significa usar reguladores en paralelo?',
      claves: 'paralelo varios reguladores grupos unidades sincronizados 4 x grande generador',
      respuesta: 'Cuando el generador es grande, en vez de un regulador gigante se usan varios iguales: los paneles se reparten en grupos y cada grupo va a su regulador, y todos cargan las mismas baterías.\nLa plataforma busca el menor número de reguladores con el que cada uno cumple, y solo lo propone si la ficha del regulador permite trabajar en paralelo (por ejemplo, los Victron 150/60, 150/70, 250/60 y 250/70 admiten hasta 10).', ir: 5 },
    { id: 'autonomia', paso: 5, pregunta: '¿Qué son la autonomía y el DoD?',
      claves: 'autonomia dias sin sol dod profundidad descarga bateria dura',
      respuesta: '• Autonomía: cuántos días sin sol (o cuántas noches, si eligió «solo el consumo de la noche») deben funcionar las cargas solo con las baterías.\n• DoD (profundidad de descarga): qué parte de la batería se deja usar. Un DoD menor alarga la vida de la batería, pero pide más baterías.', ir: 5 },
    { id: 'arranque', paso: 5, pregunta: '¿Cómo se tiene en cuenta el arranque de una bomba o motor?',
      claves: 'arranque bomba motor compresor corriente pico arranca arrancar nevera aire',
      respuesta: 'Al arrancar, los motores piden más corriente que la nominal.\n• Con red (on-grid): esa corriente la entrega la red, así que no cambia la elección del inversor. Si la red falla, el inversor se apaga por seguridad.\n• Sin red (off-grid): el inversor de baterías debe aguantar el arranque de la carga mayor con las demás encendidas; revise su potencia de sobrecarga en la ficha.', ir: 5 },
    { id: 'costos-equipos', paso: 0, pregunta: '¿La plataforma calcula cuánto cuestan los paneles y equipos?',
      claves: 'cuesta cuestan precio precios comprar compra inversion presupuesto dinero retorno ahorro economico',
      respuesta: 'No. La plataforma calcula el costo de la energía que consume el proyecto (con el CU), pero no el precio de los paneles, del inversor ni de las baterías, ni el retorno de la inversión. Para eso hay que pedir cotizaciones a proveedores.' },
    { id: 'informes', paso: 6, pregunta: '¿Qué diferencia hay entre los dos informes?',
      claves: 'informe pdf una pagina completo resumen reporte imprimir diferencia',
      respuesta: '• Informe de una página: el resumen del proyecto en una hoja, con días de operación, CU, consumo, generador y equipo.\n• Informe completo: además trae la memoria de cálculo, con fórmulas y supuestos.\nLos dos están en el Paso 6.', ir: 6 },
    { id: 'pdf-no-baja', paso: 6, pregunta: 'El PDF no se descarga, ¿qué hago?',
      claves: 'pdf no descarga baja genera informe error internet conexion',
      respuesta: 'Para crear el PDF se necesita conexión a internet. Revise la conexión y vuelva a intentarlo. Si el mensaje dice que faltan datos (por ejemplo, que no hay cargas), complete el paso que indica.', ir: 6 },
    { id: 'exportar', paso: 6, pregunta: '¿Cómo descargo los resultados en Excel?',
      claves: 'exportar excel csv json hoja calculo descargar resultados datos tabla',
      respuesta: 'En el Paso 6 pulse «Resultados en CSV» y abra el archivo con Excel u otra hoja de cálculo: las columnas van separadas por punto y coma y los decimales con coma. «Resultados en JSON» es para otros programas.', ir: 6 },
    { id: 'numeros', paso: 0, pregunta: '¿Por qué los números usan coma?',
      claves: 'coma punto decimal miles numeros formato separador',
      respuesta: 'La plataforma usa la convención de Colombia: coma para los decimales y punto para los miles (por ejemplo 3.942 W y 32,688 kWh). Es igual en la pantalla, en los informes y en el CSV.' },
    { id: 'internet', paso: 0, pregunta: '¿Funciona sin internet?',
      claves: 'internet conexion sin offline red wifi datos',
      respuesta: 'Sí. Los cálculos funcionan sin internet y el recurso solar se toma de la base de datos local. Sin conexión no se puede consultar NASA POWER ni generar el PDF, pero sí exportar el CSV y el JSON.' },
    { id: 'celular', paso: 0, pregunta: '¿Puedo usarla en el celular?',
      claves: 'celular movil telefono tablet pantalla pequena android iphone',
      respuesta: 'Sí. La plataforma se adapta a la pantalla del teléfono. Las tablas anchas se pueden desplazar hacia los lados con el dedo.' },
    { id: 'asistente', paso: 0, pregunta: '¿Este asistente usa inteligencia artificial?',
      claves: 'inteligencia artificial ia chatbot bot asistente quien eres robot',
      respuesta: 'No. Este asistente responde con las preguntas frecuentes del manual de la plataforma: busca las palabras de su pregunta y muestra la respuesta que mejor coincide. Si no encuentra una, se lo dice y le sugiere temas parecidos.' },
  ];

  const SALUDOS = /^(hola|buenas|buenos dias|buenas tardes|buenas noches|hey|saludos)\b/;
  const GRACIAS = /^(gracias|muchas gracias|ok|listo|perfecto|vale)\b/;

  const VACIAS = new Set(('no uso usa a al algo como con cual cuales cuando de del donde el ella en es esta este esto eso hago hay la las le lo los me mi mis o para pero por puedo que quiero se si sin sobre su sus tengo un una uno unos y ya debo hace hacer tiene ver ser son estan esta favor porque cuanto cuanta').split(' '));

  function normalizar(texto) {
    return String(texto || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ]+/g, ' ').trim();
  }

  // Raíz sencilla: quita el plural para que «baterías» y «batería» coincidan.
  function raizDe(palabra) {
    if (palabra.length > 5 && palabra.endsWith('es')) return palabra.slice(0, -2);
    if (palabra.length > 3 && palabra.endsWith('s')) return palabra.slice(0, -1);
    return palabra;
  }

  function palabras(texto) {
    return normalizar(texto).split(' ').filter(p => p && !VACIAS.has(p)).map(raizDe);
  }

  const INDICE = PREGUNTAS.map(e => ({ entrada: e, claves: new Set(palabras(e.claves)), titulo: new Set(palabras(e.pregunta)) }));

  function coincide(palabra, conjunto) {
    if (conjunto.has(palabra)) return true;
    if (palabra.length < 5) return false;
    for (const c of conjunto) {
      if (c.length >= 5 && (c.startsWith(palabra) || palabra.startsWith(c))) return true;
    }
    return false;
  }

  // Devuelve { tipo: 'respuesta' | 'saludo' | 'gracias' | 'sin_respuesta', entrada, sugerencias }
  function responder(texto) {
    const limpio = normalizar(texto);
    if (!limpio) return { tipo: 'sin_respuesta', entrada: null, sugerencias: [] };
    const terminos = Array.from(new Set(palabras(texto)));
    if (SALUDOS.test(limpio) && terminos.length <= 2) return { tipo: 'saludo', entrada: null, sugerencias: [] };
    if (GRACIAS.test(limpio) && terminos.length <= 3) return { tipo: 'gracias', entrada: null, sugerencias: [] };

    const puntajes = INDICE.map(item => {
      let puntos = 0;
      terminos.forEach(t => {
        if (coincide(t, item.claves)) puntos += 2;
        if (coincide(t, item.titulo)) puntos += 1;
      });
      return { entrada: item.entrada, puntos };
    }).filter(x => x.puntos > 0).sort((a, b) => b.puntos - a.puntos);

    if (!puntajes.length || puntajes[0].puntos < 2) {
      return { tipo: 'sin_respuesta', entrada: null, sugerencias: puntajes.slice(0, 3).map(x => x.entrada) };
    }
    const mejor = puntajes[0];
    const sugerencias = puntajes.slice(1).filter(x => x.puntos >= Math.max(2, mejor.puntos - 2)).slice(0, 3).map(x => x.entrada);
    return { tipo: 'respuesta', entrada: mejor.entrada, sugerencias };
  }

  function sugerenciasDelPaso(paso) {
    const delPaso = PREGUNTAS.filter(e => e.paso === paso);
    return (delPaso.length ? delPaso : PREGUNTAS.filter(e => e.paso === 0)).slice(0, 3);
  }

  const Asistente = { PREGUNTAS, responder, normalizar, sugerenciasDelPaso };
  if (typeof module !== 'undefined' && module.exports) module.exports = Asistente;
  if (!raiz || !raiz.document) return;
  raiz.Asistente = Asistente;

  // ---------------------------------------------------------------------
  // Ventana del asistente
  // ---------------------------------------------------------------------
  const doc = raiz.document;
  const boton = doc.getElementById('btnAsistente');
  const panel = doc.getElementById('panelAsistente');
  if (!boton || !panel) return;
  const mensajes = doc.getElementById('asistenteMensajes');
  const chips = doc.getElementById('asistenteSugerencias');
  const formulario = doc.getElementById('formAsistente');
  const entrada = doc.getElementById('entradaAsistente');
  const NOMBRES_PASO = ['la bienvenida', 'el Paso 1', 'el Paso 2', 'el Paso 3', 'el Paso 4', 'el Paso 5', 'el Paso 6'];

  function pasoActual() {
    const activo = doc.querySelector('.panel.is-active');
    if (!activo) return 0;
    const n = Number(String(activo.id).replace('panel-', ''));
    return isNaN(n) ? 0 : n;
  }

  function burbuja(quien, contenido) {
    const div = doc.createElement('div');
    div.className = 'asistente-msj asistente-' + quien;
    if (typeof contenido === 'string') {
      div.textContent = contenido;
    } else {
      div.appendChild(contenido);
    }
    mensajes.appendChild(div);
    mensajes.scrollTop = mensajes.scrollHeight;
    return div;
  }

  // Convierte el texto de la respuesta en párrafos y listas.
  function cuerpoRespuesta(e) {
    const frag = doc.createDocumentFragment();
    const titulo = doc.createElement('strong');
    titulo.textContent = e.pregunta;
    frag.appendChild(titulo);
    let lista = null;
    e.respuesta.split('\n').forEach(linea => {
      if (linea.startsWith('• ')) {
        if (!lista) { lista = doc.createElement('ul'); frag.appendChild(lista); }
        const li = doc.createElement('li');
        li.textContent = linea.slice(2);
        lista.appendChild(li);
      } else {
        lista = null;
        const p = doc.createElement('p');
        p.textContent = linea;
        frag.appendChild(p);
      }
    });
    if (e.ir && e.ir !== pasoActual()) {
      const ir = doc.createElement('button');
      ir.type = 'button';
      ir.className = 'asistente-ir';
      ir.textContent = 'Ir al Paso ' + e.ir + ' →';
      ir.addEventListener('click', () => {
        if (raiz.UIApp && raiz.UIApp.irAPaso) raiz.UIApp.irAPaso(e.ir);
        cerrar();
      });
      frag.appendChild(ir);
    }
    return frag;
  }

  function mostrarSugerencias(lista, titulo) {
    chips.innerHTML = '';
    if (!lista.length) return;
    const t = doc.createElement('span');
    t.className = 'asistente-chips-titulo';
    t.textContent = titulo;
    chips.appendChild(t);
    lista.forEach(e => {
      const b = doc.createElement('button');
      b.type = 'button';
      b.className = 'asistente-chip';
      b.textContent = e.pregunta;
      b.addEventListener('click', () => preguntar(e.pregunta, e));
      chips.appendChild(b);
    });
  }

  function preguntar(texto, directa) {
    burbuja('usuario', texto);
    const r = directa ? { tipo: 'respuesta', entrada: directa, sugerencias: [] } : responder(texto);
    if (r.tipo === 'saludo') {
      burbuja('bot', '¡Hola! Escriba su duda sobre cualquier paso de la plataforma, por ejemplo «¿qué es el CU?» o «¿cómo marco un horario?».');
      mostrarSugerencias(sugerenciasDelPaso(pasoActual()), 'Preguntas frecuentes en ' + NOMBRES_PASO[pasoActual()] + ':');
    } else if (r.tipo === 'gracias') {
      burbuja('bot', 'Con gusto. Si le surge otra duda, escríbala aquí.');
      chips.innerHTML = '';
    } else if (r.tipo === 'sin_respuesta') {
      burbuja('bot', 'No encontré una respuesta para esa pregunta en el manual. Intente con otras palabras' +
        (r.sugerencias.length ? ' o revise estos temas parecidos.' : ', o pulse «? Ayuda» en la barra superior para ver el manual completo.'));
      mostrarSugerencias(r.sugerencias.length ? r.sugerencias : sugerenciasDelPaso(pasoActual()), r.sugerencias.length ? 'Temas parecidos:' : 'Preguntas frecuentes:');
    } else {
      burbuja('bot', cuerpoRespuesta(r.entrada));
      mostrarSugerencias(r.sugerencias, 'También le puede servir:');
    }
  }

  function abrir() {
    panel.hidden = false;
    boton.setAttribute('aria-expanded', 'true');
    if (!mensajes.childElementCount) {
      burbuja('bot', 'Hola, soy el asistente de la plataforma. Respondo dudas sobre cómo usarla con la información del manual. Escriba su pregunta o elija una de abajo.');
    }
    mostrarSugerencias(sugerenciasDelPaso(pasoActual()), 'Preguntas frecuentes en ' + NOMBRES_PASO[pasoActual()] + ':');
    entrada.focus();
  }

  function cerrar() {
    panel.hidden = true;
    boton.setAttribute('aria-expanded', 'false');
    boton.focus();
  }

  boton.addEventListener('click', () => (panel.hidden ? abrir() : cerrar()));
  doc.getElementById('btnCerrarAsistente').addEventListener('click', cerrar);
  panel.addEventListener('keydown', ev => { if (ev.key === 'Escape') cerrar(); });
  formulario.addEventListener('submit', ev => {
    ev.preventDefault();
    const texto = entrada.value.trim();
    if (!texto) return;
    entrada.value = '';
    preguntar(texto);
  });
})(typeof window !== 'undefined' ? window : null);
