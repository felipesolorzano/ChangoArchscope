# Reglas de Desarrollo

Este proyecto sigue un flujo obligatorio basado en **SDD**, **TDD**, **DDD**, **arquitectura hexagonal** y **mutation testing**.

No se debe implementar codigo sin specs. No se deben crear tests sin specs. No se debe cerrar una tarea sin tests verdes y mutation testing validado.

Las mismas reglas aplican para los dos entornos del proyecto:

- `app/modules`: codigo modular del backend en Node.js.
- `resources/js/react`: codigo modular del frontend en React.

## Regla de Diseño SOLID

Todo componente, clase, funcion, hook, servicio, controlador, mapper, helper o modulo nuevo debe diseñarse con principios SOLID desde el inicio.

Esto aplica a cualquier entorno o capa del proyecto:

- React, Node.js o cualquier otro runtime futuro.
- Presentation, infrastructure, application y domain.
- Componentes UI, hooks, controladores, casos de uso, servicios, adaptadores, mappers y utilidades.

Reglas practicas:

- Mantener una sola razon de cambio por archivo o unidad.
- Separar render/UI, orquestacion de estado, reglas puras, mapeos y efectos externos.
- Depender de abstracciones o contratos cuando exista variacion real.
- Evitar componentes o servicios que acumulen responsabilidades por conveniencia.
- Preferir helpers puros y testeables para reglas de negocio, layout, filtrado, transformaciones y decisiones.

## Regla de Estado en React

En `resources/js/react`, cuando un estado de UI deba actualizarse desde otro componente, no se debe pasar el setter ni el callback de actualizacion por props entre padre e hijo o entre componentes hermanos. Ese estado debe vivir en un store de Zustand del modulo correspondiente.

Esta regla aplica cuando:

- Un hijo necesita actualizar estado que vive en un padre.
- Un padre necesita coordinar estado que pertenece a un hijo.
- Dos o mas componentes hermanos deben leer o actualizar el mismo estado.
- Un estado afecta la orquestacion de una vista, panel, canvas, seleccion, filtros, modo activo, foco, edicion o navegacion interna.

Esta regla no prohibe todas las props. Se permiten props cuando:

- Son datos de solo lectura para renderizar UI presentacional.
- Son configuracion estatica o callbacks puramente locales que no actualizan estado compartido.
- El componente es controlado por una libreria externa y la API exige props especificas.

Regla practica: si una prop existe principalmente para cambiar estado observable fuera del propio componente, mover ese estado y sus acciones a Zustand.

## Flujo Obligatorio

Para cualquier cambio funcional se debe seguir este orden:

```text
1. Crear o actualizar specs
2. Crear tests desde las specs
3. Confirmar que los tests fallan
4. Implementar codigo
5. Confirmar que los tests pasan
6. Ejecutar mutation testing
7. Corregir si los mutantes sobreviven
```

No se puede brincar ningun paso.

## 1. Specs

Primero se crea un documento de specs en el modulo correspondiente.

Backend:

```text
app/modules/{Modulo}/specs/
```

Frontend:

```text
resources/js/react/modules/{Modulo}/specs/
```

Ejemplos:

```text
app/modules/projects/specs/create-project.md
resources/js/react/modules/diagramming/specs/create-table-node.md
```

La spec debe describir:

- Objetivo del caso.
- Entradas esperadas.
- Reglas de negocio o comportamiento.
- Salidas esperadas.
- Errores o casos invalidos.
- Capas involucradas.
- Criterios de aceptacion.

Si no existe spec, no se crean tests ni codigo.

## 2. Tests

Despues de la spec se crean los tests correspondientes.

Backend:

```text
tests/modules/{Modulo}/{Capa}/{Tipo}/
```

Frontend:

```text
resources/js/react/tests/modules/{Modulo}/{Capa}/{Tipo}/
```

Ejemplos:

```text
tests/modules/projects/application/unit/create-project.test.ts
tests/modules/projects/presentation/feature/create-project-controller.test.ts
resources/js/react/tests/modules/diagramming/application/unit/create-table-node.test.ts
resources/js/react/tests/modules/diagramming/presentation/component/diagram-canvas.test.tsx
```

Los tests deben cubrir lo escrito en la spec. No se deben agregar tests para comportamiento que no este especificado.

## 3. Tests Rojos

Antes de implementar codigo, se deben ejecutar los tests nuevos y confirmar que fallan.

Esto prueba que los tests realmente detectan el comportamiento faltante.

Si los tests pasan antes de implementar, se debe revisar el test: probablemente no esta validando la regla correcta.

## 4. Implementacion

Solo despues de tener specs y tests fallando se implementa el codigo.

La implementacion debe respetar la arquitectura:

- `domain`: reglas de negocio puras.
- `application`: casos de uso, comandos, queries, DTOs y puertos.
- `infrastructure`: persistencia, APIs externas, clientes tecnicos, almacenamiento y adaptadores.
- `presentation`: HTTP en Node.js; componentes, paginas y hooks de UI en React.

`domain` y `application` no deben depender de frameworks, base de datos, HTTP, React, DOM ni librerias de infraestructura.

## 5. Tests Verdes

Despues de implementar se ejecutan los tests del entorno afectado.

Backend:

```bash
npm run test:node
```

Frontend:

```bash
npm run test:react
```

Si el cambio afecta ambos entornos, se ejecuta toda la suite desde la raiz:

```bash
npm test
```

Para ejecutar un archivo o test especifico, usar los comandos documentados en `docs/npm-commands.md`.

## 6. Mutation Testing

Despues de tener tests verdes se debe ejecutar mutation testing.

Objetivo: comprobar que los tests fallan cuando el codigo cambia de forma incorrecta.

Si los mutantes sobreviven, significa que los tests no son suficientemente fuertes.

Herramienta recomendada:

```text
StrykerJS
```

Backend:

```bash
npm run test:mutation:node
```

Frontend:

```bash
npm run test:mutation:react
```

Toda la suite de mutation testing:

```bash
npm run test:mutation
```

Cuando se agregue mutation testing, la configuracion esperada vivira en:

```text
config/node/stryker.conf.json
config/react/stryker.conf.json
```

Cada configuracion debe definir:

- Archivos fuente que se mutan.
- Tests que validan los mutantes.
- Reportes de mutation testing.
- Mutantes ignorados solo cuando sean falsos positivos justificados.

No se debe bajar el nivel de exigencia de mutation testing para ocultar mutantes sobrevivientes.

### Mutation Testing en Frontend

En `resources/js/react`, el mutation testing general no debe incluir vistas o componentes UI pesados,
especialmente componentes que renderizan React Flow, usan `jsdom` intensivamente o cargan datasets
demo grandes. Estos archivos pueden generar cientos o miles de mutantes, timeouts y ejecuciones de
decenas de minutos sin aportar una senal proporcional.

Reglas para cambios frontend:

- El mutation general (`config/react/stryker.conf.json`) debe enfocarse en codigo pequeño y estable de comportamiento.
- Excluir del mutation general componentes y paginas de presentation cuando sean vistas pesadas o dependan de React Flow.
- Excluir seeds, fixtures o datasets demo grandes, como diagramas iniciales con muchas tablas o relaciones.
- Para un cambio nuevo de UI, crear una configuracion dirigida de Stryker que mute solo el componente o helper recien creado.
- La configuracion dirigida debe correr solo el test o archivo de tests relacionado con ese cambio.
- Ejecutar mutation dirigido con un script o config puntual, como se documenta en `docs/npm-commands.md`.
- Si el mutation dirigido sigue tardando o produce muchos timeouts, extraer la logica nueva a un componente/helper pequeño y mutar solo ese archivo.
- No usar mutation testing de views completas como validacion principal cuando la interaccion ya esta cubierta por tests de componente.

## 7. Correccion

Si mutation testing detecta mutantes sobrevivientes:

1. Revisar que regla no esta cubierta.
2. Ajustar o agregar tests basados en la spec.
3. Confirmar que el test falla con el mutante.
4. Corregir implementacion si hace falta.
5. Repetir tests y mutation testing.

## Reglas para Agentes

- No implementar codigo si no existe spec.
- No crear tests si no existe spec.
- No implementar si los tests nuevos no fallaron primero.
- No terminar una tarea solo con tests verdes.
- Ejecutar mutation testing despues de los tests verdes.
- En frontend, no meter views pesadas, React Flow ni seeds grandes al mutation general; usar configs dirigidas para cambios UI.
- Si mutation testing no falla ante cambios incorrectos, reforzar tests.
- Al crear o modificar componentes, servicios, hooks, controladores, mappers o helpers, aplicar SOLID y separar responsabilidades.
- En React, no pasar setters ni callbacks de estado compartido por props; usar Zustand para estado actualizable entre componentes.
- Mantener specs, tests y codigo dentro del modulo correspondiente.
- Separar claramente cambios de backend en `app/modules` y frontend en `resources/js/react`.
- Mantener la misma arquitectura SDD, TDD, DDD y hexagonal en ambos entornos.
