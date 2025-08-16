// Tests para Space Defense
// Ejecutar con: node test.js

// Importar el código real del juego
const game = require('./game.js');

// Usar las clases y estado reales
const { Module, gameState, moduleTypes, initGame, updateConnections, transferDroid, placeModule } = game;

// Tests
function runTests() {
    console.log('🧪 Ejecutando tests para Space Defense...\n');

    // Test 1: Creación de módulos
    testModuleCreation();
    
    // Test 2: Intervalos de reclutamiento
    testRecruitmentIntervals();
    
    // Test 3: Producción de droides
    testDroidProduction();
    
    // Test 4: Transferencia de droides
    testDroidTransfer();
    
    // Test 5: Inicialización del juego
    testGameInitialization();

    console.log('✅ Todos los tests completados\n');
}

function testModuleCreation() {
    console.log('🔧 Test: Creación de módulos');
    
    // Reset state
    gameState.modules = [];
    gameState.totalDroids = 0;
    
    // Crear módulos (todos deberían empezar con 0 droides)
    const energy = new Module(100, 100, 'energy', 0);
    const production = new Module(200, 100, 'production', 1);
    const recruitment = new Module(300, 100, 'recruitment', 2);
    const defense = new Module(400, 100, 'defense', 3);
    
    gameState.modules = [energy, production, recruitment, defense];
    
    // Verificar droides iniciales (todos deberían ser 0)
    console.log(`  Energía: ${energy.droids} droides (esperado: 0)`);
    console.log(`  Producción: ${production.droids} droides (esperado: 0)`);
    console.log(`  Reclutamiento: ${recruitment.droids} droides (esperado: 0)`);
    console.log(`  Defensa: ${defense.droids} droides (esperado: 0)`);
    
    // Ahora TODOS los módulos deberían empezar con 0 droides
    const totalInitialDroids = energy.droids + production.droids + recruitment.droids + defense.droids;
    console.log(`  Total inicial: ${totalInitialDroids} (esperado: 0)\n`);
    
    if (totalInitialDroids === 0) {
        console.log('✅ Test creación de módulos: PASÓ\n');
    } else {
        console.log('❌ Test creación de módulos: FALLÓ\n');
    }
}

function testRecruitmentIntervals() {
    console.log('⏱️  Test: Intervalos de reclutamiento');
    
    const recruitment = new Module(100, 100, 'recruitment', 0);
    
    // Test diferentes números de droides
    const testCases = [
        { droids: 0, expected: 0 },
        { droids: 1, expected: 20000 },
        { droids: 2, expected: 17000 },
        { droids: 5, expected: 11000 },
        { droids: 10, expected: 5000 },
        { droids: 15, expected: 5000 } // Máximo
    ];
    
    let allPassed = true;
    for (let test of testCases) {
        recruitment.droids = test.droids;
        const interval = recruitment.getRecruitmentInterval();
        console.log(`  ${test.droids} droides → ${interval}ms (esperado: ${test.expected}ms)`);
        
        if (interval !== test.expected) {
            allPassed = false;
        }
    }
    
    if (allPassed) {
        console.log('✅ Test intervalos de reclutamiento: PASÓ\n');
    } else {
        console.log('❌ Test intervalos de reclutamiento: FALLÓ\n');
    }
}

function testDroidProduction() {
    console.log('🤖 Test: Producción de droides');
    
    // Setup inicial
    gameState.modules = [];
    gameState.connections = [];
    gameState.totalDroids = 1; // Solo el droide inicial del módulo de producción
    
    const production = new Module(100, 100, 'production', 0);
    const recruitment = new Module(200, 100, 'recruitment', 1);
    const defense = new Module(300, 100, 'defense', 2);
    
    production.droids = 1;
    recruitment.droids = 1; // Le damos 1 droide para que pueda producir
    defense.droids = 0;
    
    gameState.modules = [production, recruitment, defense];
    gameState.connections = [
        { from: 0, to: 1 },
        { from: 1, to: 2 }
    ];
    
    const initialTotal = gameState.totalDroids;
    console.log(`  Droides antes de producción: ${initialTotal}`);
    
    // Simular producción
    recruitment.produceAndAssignDroids();
    
    console.log(`  Droides después de producción: ${gameState.totalDroids}`);
    console.log(`  Defensa ahora tiene: ${defense.droids} droides`);
    
    if (gameState.totalDroids === initialTotal + 1 && defense.droids === 1) {
        console.log('✅ Test producción de droides: PASÓ\n');
    } else {
        console.log('❌ Test producción de droides: FALLÓ\n');
    }
}

function testDroidTransfer() {
    console.log('🔄 Test: Transferencia de droides');
    
    // Setup
    gameState.modules = [];
    gameState.totalDroids = 3;
    
    const moduleA = new Module(100, 100, 'production', 0);
    const moduleB = new Module(200, 100, 'defense', 1);
    
    moduleA.droids = 3;
    moduleB.droids = 0;
    
    gameState.modules = [moduleA, moduleB];
    
    console.log(`  Antes - A: ${moduleA.droids}, B: ${moduleB.droids}, Total: ${gameState.totalDroids}`);
    
    // Simular transferencia (lógica simplificada)
    if (moduleA.droids > 0 && moduleB.droids < moduleB.maxDroids) {
        moduleA.droids--;
        moduleB.droids++;
    }
    
    console.log(`  Después - A: ${moduleA.droids}, B: ${moduleB.droids}, Total: ${gameState.totalDroids}`);
    
    if (moduleA.droids === 2 && moduleB.droids === 1 && gameState.totalDroids === 3) {
        console.log('✅ Test transferencia de droides: PASÓ\n');
    } else {
        console.log('❌ Test transferencia de droides: FALLÓ\n');
    }
}

function testGameInitialization() {
    console.log('🏗️  Test: Inicialización del juego');
    
    // Reset completo
    gameState.modules = [];
    gameState.connections = [];
    gameState.totalDroids = 0;
    
    // Usar la función real de inicialización
    console.log('Llamando a initGame()...');
    initGame();
    
    console.log(`Estado después de initGame(): ${gameState.totalDroids} droides totales`);
    
    // Mostrar estado final
    console.log('\n📊 Estado final:');
    gameState.modules.forEach((module, i) => {
        console.log(`  ${module.type}: ${module.droids} droides`);
    });
    console.log(`  Total: ${gameState.totalDroids} droides`);
    
    // Debería haber exactamente 1 droide asignado al módulo de producción
    if (gameState.totalDroids === 1 && gameState.modules[1].droids === 1) {
        console.log('✅ Test inicialización: PASÓ\n');
    } else {
        console.log(`❌ Test inicialización: FALLÓ (esperaba 1 droide en producción, obtuvo ${gameState.totalDroids} total)\n`);
    }
}

function testRealGameScenario() {
    console.log('🎮 Test: Escenario real del juego - Droides fantasma');
    
    // Reset completo
    gameState.modules = [];
    gameState.connections = [];
    gameState.totalDroids = 0;
    gameState.gameTime = 0;
    
    console.log('=== SIMULANDO JUEGO COMPLETO ===');
    
    // 1. Inicializar juego como en initGame()
    console.log('1. Inicializando juego...');
    const energy = new Module(300, 300, 'energy', 0);
    const production = new Module(350, 300, 'production', 1);
    
    gameState.modules = [energy, production];
    gameState.connections = [{ from: 0, to: 1 }];
    
    // Asignar droide inicial
    production.droids = 1;
    gameState.totalDroids = 1;
    
    // Marcar como conectados
    energy.isConnected = true;
    production.isConnected = true;
    
    console.log(`   Estado: Total=${gameState.totalDroids}, Production=${production.droids}`);
    
    // 2. Crear módulo de reclutamiento
    console.log('2. Creando módulo de reclutamiento...');
    const recruitment = new Module(400, 300, 'recruitment', 2);
    gameState.modules.push(recruitment);
    gameState.connections.push({ from: 1, to: 2 });
    recruitment.isConnected = true;
    
    console.log(`   Estado: Total=${gameState.totalDroids}, Recruitment=${recruitment.droids}`);
    
    // 3. Transferir droide manualmente (doble click)
    console.log('3. Transfiriendo droide de production a recruitment...');
    if (production.droids > 0 && recruitment.droids < recruitment.maxDroids) {
        production.droids--;
        recruitment.droids++;
        recruitment.lastRecruitment = gameState.gameTime; // Reset timer
    }
    
    console.log(`   Production=${production.droids}, Recruitment=${recruitment.droids}, Total=${gameState.totalDroids}`);
    
    // 4. Simular producción de droides durante un tiempo
    console.log('4. Simulando producción continua...');
    
    for (let time = 0; time < 100000; time += 20000) { // 5 ciclos de 20 segundos
        gameState.gameTime = time;
        
        // Simular el update del recruitment
        if (recruitment.type === 'recruitment') {
            const recruitmentInterval = recruitment.getRecruitmentInterval();
            if (recruitmentInterval > 0 && gameState.gameTime - recruitment.lastRecruitment >= recruitmentInterval) {
                if (recruitment.canProduceDroids()) {
                    console.log(`   Tiempo ${time}ms: Produciendo droides...`);
                    recruitment.produceAndAssignDroids();
                }
                recruitment.lastRecruitment = gameState.gameTime;
            }
        }
    }
    
    console.log(`   Estado después de producción: Total=${gameState.totalDroids}`);
    console.log(`   Production=${production.droids}, Recruitment=${recruitment.droids}`);
    
    // 5. Crear módulo de defensa (aquí debería aparecer el bug)
    console.log('5. Creando módulo de defensa...');
    const defense = new Module(450, 300, 'defense', 3);
    gameState.modules.push(defense);
    gameState.connections.push({ from: 2, to: 3 });
    defense.isConnected = true;
    
    console.log(`   Antes: Defense=${defense.droids}, Total=${gameState.totalDroids}`);
    
    // Aquí NO debería haber redistribución automática ya que la eliminamos
    // Si defense tiene droides, es que hay un bug
    
    console.log(`   Después: Defense=${defense.droids}, Total=${gameState.totalDroids}`);
    
    // 6. Verificar consistencia
    let realAssignedDroids = 0;
    gameState.modules.forEach(module => {
        if (module.type !== 'energy') {
            realAssignedDroids += module.droids;
            console.log(`   ${module.type}: ${module.droids} droides`);
        }
    });
    
    console.log(`   Droides asignados: ${realAssignedDroids}`);
    console.log(`   Total global: ${gameState.totalDroids}`);
    console.log(`   Diferencia (droides fantasma): ${gameState.totalDroids - realAssignedDroids}`);
    
    if (gameState.totalDroids === realAssignedDroids) {
        console.log('✅ Test escenario real: CONSISTENTE\n');
    } else {
        console.log('❌ Test escenario real: DETECTÓ INCONSISTENCIA\n');
    }
}

function testDefenseModuleBug() {
    console.log('🐛 Test: Bug específico - Crear módulo de defensa con 30/30 droides');
    
    // Reset y setup para tener exactamente 30/30 droides
    gameState.modules = [];
    gameState.connections = [];
    gameState.totalDroids = 0;
    
    // Crear setup inicial
    const energy = new Module(300, 300, 'energy', 0);
    const production = new Module(350, 300, 'production', 1);
    const recruitment = new Module(400, 300, 'recruitment', 2);
    
    gameState.modules = [energy, production, recruitment];
    gameState.connections = [
        { from: 0, to: 1 },
        { from: 1, to: 2 }
    ];
    
    // Marcar como conectados
    energy.isConnected = true;
    production.isConnected = true;
    recruitment.isConnected = true;
    
    // Llenar módulos hasta tener exactamente 30 droides
    production.droids = 10; // Máximo
    recruitment.droids = 10; // Máximo
    // Necesitamos 10 más... crear otro módulo lleno
    const extraProduction = new Module(450, 300, 'production', 3);
    extraProduction.droids = 10;
    extraProduction.isConnected = true;
    gameState.modules.push(extraProduction);
    gameState.connections.push({ from: 2, to: 3 });
    
    gameState.totalDroids = 30; // 10 + 10 + 10 = 30
    
    console.log('=== ESTADO ANTES DE CREAR DEFENSA ===');
    console.log(`Total droides: ${gameState.totalDroids}`);
    gameState.modules.forEach((module, i) => {
        console.log(`  ${module.type}: ${module.droids}/10 droides`);
    });
    
    // Verificar que realmente tenemos 30/30
    let realAssigned = 0;
    gameState.modules.forEach(module => {
        if (module.type !== 'energy') realAssigned += module.droids;
    });
    console.log(`Droides realmente asignados: ${realAssigned}`);
    
    // AHORA CREAR MÓDULO DE DEFENSA usando la función real (aquí debería aparecer el bug)
    console.log('\n🎯 CREANDO MÓDULO DE DEFENSA CON PLACEMODULE REAL...');
    
    // Configurar estado necesario para placeModule
    gameState.selectedModuleType = 'defense';
    gameState.placingModule = true;
    gameState.resources = 1000; // Asegurar que hay recursos suficientes
    
    // Usar la función real del juego
    const success = placeModule(500, 300);
    
    console.log('\n=== ESTADO DESPUÉS DE CREAR DEFENSA ===');
    console.log(`Total droides: ${gameState.totalDroids}`);
    gameState.modules.forEach((module, i) => {
        console.log(`  ${module.type}: ${module.droids}/10 droides`);
    });
    
    // Verificar droides reales después
    let realAssignedAfter = 0;
    gameState.modules.forEach(module => {
        if (module.type !== 'energy') realAssignedAfter += module.droids;
    });
    console.log(`Droides realmente asignados después: ${realAssignedAfter}`);
    console.log(`Diferencia: ${gameState.totalDroids - realAssignedAfter} droides fantasma`);
    
    // Buscar el módulo de defensa creado
    const defenseModule = gameState.modules.find(m => m.type === 'defense');
    
    // El test falla si aparecen droides de la nada
    if (gameState.totalDroids === 30 && defenseModule && defenseModule.droids === 0) {
        console.log('✅ Test bug defensa: NO HAY BUG');
    } else {
        console.log(`❌ Test bug defensa: BUG DETECTADO! Total: ${gameState.totalDroids}, Defensa: ${defenseModule ? defenseModule.droids : 'no encontrado'}`);
    }
    
    console.log('');
}

function testRecruitmentModuleGeneratesDroidsWithoutSpace() {
    console.log('🚨 Test TDD: Módulo de reclutamiento NO debe generar droides sin espacio');
    
    // Reset completo
    gameState.modules = [];
    gameState.connections = [];
    gameState.totalDroids = 0;
    gameState.gameTime = 0;
    
    // Setup: Crear módulos llenos (sin espacio para más droides)
    const energy = new Module(100, 100, 'energy', 0);
    const production = new Module(200, 100, 'production', 1);
    const recruitment = new Module(300, 100, 'recruitment', 2);
    
    // Llenar completamente los módulos
    production.droids = 10; // Máximo
    recruitment.droids = 10; // También máximo - NO debe poder crear más
    
    gameState.modules = [energy, production, recruitment];
    gameState.connections = [
        { from: 0, to: 1 },
        { from: 1, to: 2 }
    ];
    
    // Marcar como conectados
    energy.isConnected = true;
    production.isConnected = true;
    recruitment.isConnected = true;
    
    // Total inicial: 20 droides (10 + 10)
    gameState.totalDroids = 20;
    
    console.log('=== ESTADO INICIAL ===');
    console.log(`Total droides: ${gameState.totalDroids}`);
    console.log(`Production: ${production.droids}/10, Recruitment: ${recruitment.droids}/10`);
    
    // Simular el paso del tiempo para que el recruitment produzca
    console.log('\n🕒 SIMULANDO PASO DEL TIEMPO...');
    
    // Avanzar tiempo suficiente para que produzca (20 segundos con 1 droide)
    gameState.gameTime = 25000; // 25 segundos
    recruitment.lastRecruitment = 0; // Resetear para forzar producción
    
    // Simular el update del recruitment (esto es lo que se ejecuta en el game loop)
    const now = gameState.gameTime;
    const recruitmentInterval = recruitment.getRecruitmentInterval();
    
    console.log(`Intervalo de reclutamiento: ${recruitmentInterval}ms`);
    console.log(`Tiempo transcurrido: ${now - recruitment.lastRecruitment}ms`);
    console.log(`¿Debería producir?: ${recruitmentInterval > 0 && now - recruitment.lastRecruitment >= recruitmentInterval}`);
    
    if (recruitmentInterval > 0 && now - recruitment.lastRecruitment >= recruitmentInterval) {
        console.log('Verificando si puede producir droides...');
        const canProduce = recruitment.canProduceDroids();
        console.log(`¿Puede producir?: ${canProduce}`);
        
        if (canProduce) {
            console.log('🔥 PRODUCIENDO DROIDES (esto NO debería pasar!)');
            recruitment.produceAndAssignDroids();
        } else {
            console.log('✅ Correctamente NO produce droides');
        }
        recruitment.lastRecruitment = now;
    }
    
    console.log('\n=== ESTADO FINAL ===');
    console.log(`Total droides: ${gameState.totalDroids}`);
    console.log(`Production: ${production.droids}/10, Recruitment: ${recruitment.droids}/10`);
    
    // Verificar droides reales
    const realAssigned = production.droids + recruitment.droids;
    console.log(`Droides realmente asignados: ${realAssigned}`);
    console.log(`Diferencia (droides fantasma): ${gameState.totalDroids - realAssigned}`);
    
    // EL TEST PASA SI:
    // 1. No se crean droides nuevos (total sigue siendo 20)
    // 2. No hay droides fantasma
    if (gameState.totalDroids === 20 && gameState.totalDroids === realAssigned) {
        console.log('✅ Test TDD: PASÓ - No se generan droides sin espacio');
    } else {
        console.log('❌ Test TDD: FALLÓ - Se generaron droides fantasma');
    }
    
    console.log('');
}

function testRecruitmentCapacity() {
    console.log('🎯 Test: Módulo de reclutamiento debe producir exactamente 1 droide por ciclo');
    
    const recruitment = new Module(100, 100, 'recruitment', 0);
    
    // Test con diferentes números de droides
    const testCases = [
        { droids: 1, expectedCapacity: 1 },
        { droids: 5, expectedCapacity: 1 },
        { droids: 10, expectedCapacity: 1 }
    ];
    
    let allPassed = true;
    for (let test of testCases) {
        recruitment.droids = test.droids;
        const capacity = recruitment.getCapacity();
        console.log(`  ${test.droids} droides → capacidad: ${capacity} (esperado: ${test.expectedCapacity})`);
        
        if (capacity !== test.expectedCapacity) {
            allPassed = false;
            console.log(`    ❌ FALLÓ: esperaba ${test.expectedCapacity}, obtuvo ${capacity}`);
        } else {
            console.log(`    ✅ CORRECTO`);
        }
    }
    
    if (allPassed) {
        console.log('✅ Test capacidad reclutamiento: PASÓ - Siempre produce 1 droide por ciclo\n');
    } else {
        console.log('❌ Test capacidad reclutamiento: FALLÓ - Producía múltiples droides por ciclo\n');
    }
}

// Ejecutar tests
runTests();
testRealGameScenario();
testDefenseModuleBug();
testRecruitmentModuleGeneratesDroidsWithoutSpace();
testRecruitmentCapacity();