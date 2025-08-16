// Tests para Space Defense
// Ejecutar con: node test.js

// Mock del gameState para tests
let gameState = {
    modules: [],
    connections: [],
    totalDroids: 0,
    gameTime: 0,
    resources: 1000
};

// Mock del canvas y contexto
global.canvas = { width: 800, height: 600 };
global.ctx = {
    fillRect: () => {},
    strokeRect: () => {},
    arc: () => {},
    fill: () => {},
    stroke: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    fillText: () => {},
    save: () => {},
    restore: () => {}
};

// Importar las clases y funciones (simulado)
class Module {
    constructor(x, y, type, id) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.id = id;
        this.level = 1;
        this.droids = type === 'production' ? 1 : 0;
        this.maxDroids = type === 'energy' ? 0 : 10;
        this.health = 100;
        this.maxHealth = 100;
        this.isConnected = false;
        this.lastAttack = 0;
        this.lastProduction = 0;
        this.lastRecruitment = 0;
    }

    getRecruitmentInterval() {
        if (this.type !== 'recruitment') return 0;
        if (this.droids === 0) return 0;
        
        const intervals = [
            0, 20000, 17000, 15000, 13000, 11000, 9000, 8000, 7000, 6000, 5000
        ];
        
        return intervals[Math.min(this.droids, 10)];
    }

    canProduceDroids() {
        if (this.type !== 'recruitment') return false;
        
        const thisModuleIndex = gameState.modules.indexOf(this);
        if (thisModuleIndex === -1) return false;
        
        const connectedModules = this.getConnectedComponent(thisModuleIndex);
        
        let totalCurrentDroids = 0;
        let totalMaxCapacity = 0;
        
        for (let moduleIndex of connectedModules) {
            const module = gameState.modules[moduleIndex];
            if (module.type !== 'energy') {
                totalCurrentDroids += module.droids;
                totalMaxCapacity += module.maxDroids;
            }
        }
        
        return totalCurrentDroids < totalMaxCapacity;
    }

    getConnectedComponent(startIndex) {
        const visited = new Set();
        const queue = [startIndex];
        const component = new Set();
        
        while (queue.length > 0) {
            const currentIndex = queue.shift();
            if (visited.has(currentIndex)) continue;
            
            visited.add(currentIndex);
            component.add(currentIndex);
            
            for (let connection of gameState.connections) {
                const otherIndex = connection.from === currentIndex ? connection.to : 
                                 connection.to === currentIndex ? connection.from : null;
                
                if (otherIndex !== null && !visited.has(otherIndex)) {
                    queue.push(otherIndex);
                }
            }
        }
        
        return component;
    }

    produceAndAssignDroids() {
        if (this.type !== 'recruitment') return;
        
        const thisModuleIndex = gameState.modules.indexOf(this);
        const connectedModules = this.getConnectedComponent(thisModuleIndex);
        const droidsToAssign = 1; // Simplified for testing
        
        const availableModules = [];
        for (let moduleIndex of connectedModules) {
            const module = gameState.modules[moduleIndex];
            if (module.type !== 'energy' && module.droids < module.maxDroids) {
                availableModules.push(module);
            }
        }
        
        let droidsAssigned = 0;
        while (droidsAssigned < droidsToAssign && availableModules.length > 0) {
            availableModules.sort((a, b) => a.droids - b.droids);
            
            const targetModule = availableModules[0];
            targetModule.droids++;
            gameState.totalDroids++;
            droidsAssigned++;
            
            if (targetModule.droids >= targetModule.maxDroids) {
                availableModules.shift();
            }
        }
    }
}

// Simular la función placeModule del juego real
function placeModule(x, y, type) {
    console.log(`*** SIMULANDO CREACIÓN DE MÓDULO ${type.toUpperCase()} ***`);
    console.log(`Antes - Total droides: ${gameState.totalDroids}`);
    
    // Crear nuevo módulo (igual que en el juego real)
    const newModule = new Module(x, y, type, gameState.modules.length);
    gameState.modules.push(newModule);
    
    console.log(`Módulo creado con ${newModule.droids} droides`);
    
    // Simular conexión automática (igual que en el juego real)
    if (gameState.modules.length > 1) {
        let closestModule = 0; // Simplificado para test
        gameState.connections.push({
            from: closestModule,
            to: gameState.modules.length - 1
        });
        console.log(`Conectado al módulo ${closestModule}`);
    }
    
    // Simular updateConnections() (esto podría estar causando el problema)
    console.log('Simulando updateConnections()...');
    updateConnections();
    
    console.log(`Después - Total droides: ${gameState.totalDroids}`);
    console.log('*** FIN SIMULACIÓN ***\n');
}

function updateConnections() {
    // Resetear conexiones (simplificado)
    gameState.modules.forEach(module => module.isConnected = false);
    
    // Los módulos de energía siempre están conectados
    gameState.modules.forEach(module => {
        if (module.type === 'energy') {
            module.isConnected = true;
        }
    });
    
    // Marcar otros módulos como conectados (simplificado para test)
    gameState.modules.forEach(module => {
        if (module.type !== 'energy') {
            module.isConnected = true; // Simplificado
        }
    });
    
    console.log('updateConnections() ejecutado');
}

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
    
    // Test 5: Simulación completa de creación de módulo (como en el juego real)
    testFullModuleCreation();

    console.log('✅ Todos los tests completados\n');
}

function testModuleCreation() {
    console.log('🔧 Test: Creación de módulos');
    
    // Reset state
    gameState.modules = [];
    gameState.totalDroids = 0;
    
    // Crear módulos
    const energy = new Module(100, 100, 'energy', 0);
    const production = new Module(200, 100, 'production', 1);
    const recruitment = new Module(300, 100, 'recruitment', 2);
    const defense = new Module(400, 100, 'defense', 3);
    
    gameState.modules = [energy, production, recruitment, defense];
    
    // Verificar droides iniciales
    console.log(`  Energía: ${energy.droids} droides (esperado: 0)`);
    console.log(`  Producción: ${production.droids} droides (esperado: 1)`);
    console.log(`  Reclutamiento: ${recruitment.droids} droides (esperado: 0)`);
    console.log(`  Defensa: ${defense.droids} droides (esperado: 0)`);
    
    // Solo el módulo de producción debería tener 1 droide inicial
    const totalInitialDroids = energy.droids + production.droids + recruitment.droids + defense.droids;
    console.log(`  Total inicial: ${totalInitialDroids} (esperado: 1)\n`);
    
    if (totalInitialDroids === 1) {
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

function testFullModuleCreation() {
    console.log('🏗️  Test: Simulación completa de creación de módulo');
    
    // Reset y setup inicial como en el juego
    gameState.modules = [];
    gameState.connections = [];
    gameState.totalDroids = 0;
    
    // Crear setup inicial del juego (energía + producción)
    console.log('Creando setup inicial...');
    placeModule(200, 200, 'energy');
    placeModule(300, 200, 'production');
    
    console.log(`Estado después del setup: ${gameState.totalDroids} droides totales`);
    
    // Crear módulo de reclutamiento (debería empezar con 0 droides)
    console.log('Creando módulo de reclutamiento...');
    placeModule(400, 200, 'recruitment');
    
    // Crear módulo de defensa (debería empezar con 0 droides)  
    console.log('Creando módulo de defensa...');
    placeModule(500, 200, 'defense');
    
    // Mostrar estado final
    console.log('\n📊 Estado final:');
    gameState.modules.forEach((module, i) => {
        console.log(`  ${module.type}: ${module.droids} droides`);
    });
    console.log(`  Total: ${gameState.totalDroids} droides`);
    
    // El total debería ser 1 (solo el módulo de producción inicial)
    if (gameState.totalDroids === 1) {
        console.log('✅ Test creación completa: PASÓ\n');
    } else {
        console.log(`❌ Test creación completa: FALLÓ (esperaba 1, obtuvo ${gameState.totalDroids})\n`);
    }
}

// Ejecutar tests
runTests();