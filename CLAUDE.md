# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Description

Space Defense es un juego de estrategia en tiempo real implementado como una aplicación web de una sola página (Single Page Application). El juego simula la defensa de una estación espacial contra oleadas de enemigos usando módulos conectados y droides para automatizar la recolección de recursos, producción y defensa.

## Architecture and Code Structure

### Single File Architecture
- **index.html**: Contiene toda la aplicación (HTML, CSS, JavaScript) en un solo archivo
- Todo el juego está implementado usando Vanilla JavaScript con HTML5 Canvas para rendering
- No utiliza frameworks externos ni dependencias - es completamente autónomo

### Game Components

#### Core Classes
- **Module**: Representa módulos de la estación espacial (energía, reclutamiento, producción, defensa)
  - Ubicación: líneas 262-477
  - Maneja niveles, droides asignados, salud, y lógica específica por tipo
  - Método `getCapacity()` calcula capacidad basada en nivel y droides
  - Método `update()` maneja producción de recursos y ataques

- **Enemy**: Enemigos que atacan la estación espacial
  - Ubicación: líneas 479-611
  - Comportamiento errático similar a moscas, buscan módulos más cercanos
  - Spawning desde bordes del canvas, ataque a distancia con proyectiles

- **Projectile**: Sistema de proyectiles para combate
  - Ubicación: líneas 183-261
  - Maneja tanto proyectiles de defensa como enemigos
  - Detección de colisiones y sistema de vida temporal

#### Game State Management
- **gameState**: Objeto global que contiene todo el estado del juego
  - Ubicación: líneas 158-173
  - Recursos, droides totales, módulos, conexiones, enemigos, proyectiles
  - Timers para oleadas y modos de interacción

#### Key Systems

**Connection System** (líneas 662-761):
- Algoritmo DFS para determinar componentes conectados
- Verificación de capacidad energética vs módulos/droides
- Redistribución automática de droides entre módulos conectados

**Energy Management**:
- Módulos de energía determinan cuántos módulos y droides pueden operar
- Sistema de niveles que aumenta capacidad
- Droides sin asignar se distribuyen automáticamente

**Combat System**:
- Módulos de defensa atacan enemigos en rango (150 píxeles)
- Sistema de proyectiles con detección de colisiones
- Enemigos atacan módulos más cercanos a distancia

**Wave System**:
- 10 oleadas progresivamente más difíciles
- Enemigos más fuertes y rápidos en oleadas posteriores
- Timer de 3-5 minutos entre oleadas

### UI and Interaction
- **Canvas Interaction**: Click para colocar módulos, doble-click para transferir droides
- **Sidebar**: Estadísticas en tiempo real, botones de construcción, lista de módulos
- **Modos especiales**: Construcción, conexión, destrucción (activados por botones)

## Development Features

### Debug/Development Code
- Recursos iniciales aumentados: 10,000 (línea 159)
- Botón "Invocar Oleada" para pruebas (líneas 138-140)
- Comentarios TODO marcando código temporal (líneas 136, 159, 1147)

### Game Balance
- Costos de módulos: Energía (150), Reclutamiento (200), Producción (250), Defensa (300)
- Costo de conexiones: 50 recursos
- Capacidades por nivel con multiplicadores del 50%
- Sistema de salud: 100 HP para módulos, escalado para enemigos

## Key Functions

### Core Game Loop
- **gameLoop()** (líneas 1381-1432): Bucle principal con 60 FPS usando requestAnimationFrame
- **render()** (líneas 1326-1372): Renderizado de todos los elementos del juego
- **updateUI()** (líneas 1155-1256): Actualización de estadísticas en sidebar

### Module Management
- **placeModule()** (líneas 959-1011): Colocación de nuevos módulos con validación
- **updateConnections()** (líneas 662-761): Recalcula conectividad y distribución de droides
- **redistributeUnassignedDroids()** (líneas 625-661): Asigna droides automáticamente

### Combat
- **spawnWave()** (líneas 1136-1145): Genera nuevas oleadas de enemigos
- **attackEnemies()** (líneas 444-476): Lógica de ataque de módulos de defensa

## Conventions

### Code Style
- Uso de ES6+ features (classes, arrow functions, const/let)
- Funciones globales para eventos y inicialización
- Métodos de clase para lógica específica de entidades
- Comentarios en español

### Canvas Rendering
- Coordenadas absolutas para posicionamiento
- Sistema de colores hexadecimales para diferentes tipos de módulos
- Renderizado por capas: fondo → conexiones → módulos → enemigos → proyectiles

### Event Handling
- Event listeners en canvas para interacción con mouse
- Sistema de modos mutuamente excluyentes
- Tecla Escape para cancelar modos activos

## Testing and Validation

No hay sistema de testing automatizado implementado. Las pruebas se realizan mediante:
- Funciones de desarrollo como `forceSpawnWave()`
- Validación visual en tiempo real
- Balancing manual de mecánicas de juego

Para probar funcionalidades:
1. Abrir index.html en navegador web
2. Usar botón "Invocar Oleada" para testing de combate
3. Verificar lógica de conexiones construyendo redes complejas
4. Validar balance económico en sesiones de juego completas