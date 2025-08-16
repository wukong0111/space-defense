// Configuración del juego
const canvas = typeof document !== 'undefined' ? document.getElementById('gameCanvas') : { width: 800, height: 600, style: {} };
const ctx = typeof document !== 'undefined' ? canvas.getContext('2d') : {};

if (typeof window !== 'undefined') {
    canvas.width = window.innerWidth - 250;
    canvas.height = window.innerHeight;
}

// Estado del juego
let gameState = {
    resources: 100,
    totalDroids: 1,
    selectedModuleType: null,
    modules: [],
    connections: [],
    enemies: [],
    projectiles: [],
    gameTime: 0,
    nextWaveTime: 300000, // 5 minutos en milisegundos
    waveNumber: 0,
    gameRunning: true,
    gamePaused: false,
    placingModule: false,
    connectionMode: false,
    destroyMode: false,
    selectedConnection: null, // Conexión seleccionada para transferencia específica
    gameSpeed: 1.0, // Velocidad del juego: 0.5x, 1x, 2x
    // Sistema de cámara
    camera: {
        x: 0,
        y: 0,
        speed: 300, // píxeles por segundo
        zoom: 1.0,  // Factor de zoom (1.0 = 100%, 0.5 = 50%, 2.0 = 200%)
        minZoom: 0.3,
        maxZoom: 3.0
    }
};

// Tipos de módulos
const moduleTypes = {
    energy: { color: '#FFD700', radius: 20, cost: 150, name: 'Energía' },
    recruitment: { color: '#32CD32', radius: 20, cost: 200, name: 'Reclutamiento' },
    production: { color: '#4169E1', radius: 20, cost: 250, name: 'Producción' },
    defense: { color: '#DC143C', radius: 20, cost: 300, name: 'Defensa' }
};

// Clase Projectile
class Projectile {
    constructor(x, y, targetX, targetY, isEnemyProjectile = false) {
        this.x = x;
        this.y = y;
        this.targetX = targetX;
        this.targetY = targetY;
        this.isEnemyProjectile = isEnemyProjectile;
        this.speed = 400; // píxeles por segundo
        this.damage = isEnemyProjectile ? 10 : 25;
        
        // Calcular dirección
        const distance = Math.sqrt(Math.pow(targetX - x, 2) + Math.pow(targetY - y, 2));
        this.vx = (targetX - x) / distance * this.speed;
        this.vy = (targetY - y) / distance * this.speed;
        
        this.life = 3000; // 3 segundos máximo de vida
        this.hasHit = false;
    }
    
    update(deltaTime) {
        if (this.hasHit) return;
        
        this.life -= deltaTime;
        if (this.life <= 0) {
            this.hasHit = true;
            return;
        }
        
        // Mover proyectil
        this.x += this.vx * deltaTime / 1000;
        this.y += this.vy * deltaTime / 1000;
        
        // Verificar colisiones
        if (this.isEnemyProjectile) {
            // Proyectil enemigo: verificar colisión con módulos
            for (let module of gameState.modules) {
                const distance = Math.sqrt(Math.pow(this.x - module.x, 2) + Math.pow(this.y - module.y, 2));
                if (distance <= 20) {
                    module.health -= this.damage;
                    this.hasHit = true;
                    break;
                }
            }
        } else {
            // Proyectil de defensa: verificar colisión con enemigos
            for (let enemy of gameState.enemies) {
                const distance = Math.sqrt(Math.pow(this.x - enemy.x, 2) + Math.pow(this.y - enemy.y, 2));
                if (distance <= 10) {
                    enemy.takeDamage(this.damage);
                    this.hasHit = true;
                    break;
                }
            }
        }
        
        // Verificar si salió de pantalla
        if (this.x < 0 || this.x > canvas.width || this.y < 0 || this.y > canvas.height) {
            this.hasHit = true;
        }
    }
    
    draw() {
        if (this.hasHit) return;
        
        ctx.beginPath();
        ctx.arc(this.x, this.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = this.isEnemyProjectile ? '#ff4444' : '#00ff00';
        ctx.fill();
        
        // Estela del proyectil
        ctx.beginPath();
        ctx.moveTo(this.x - this.vx * 0.02, this.y - this.vy * 0.02);
        ctx.lineTo(this.x, this.y);
        ctx.strokeStyle = this.isEnemyProjectile ? '#ff8888' : '#88ff88';
        ctx.lineWidth = 2;
        ctx.stroke();
    }
}

class Module {
    constructor(x, y, type, id) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.id = id;
        this.level = 1;
        this.droids = 0; // Todos los módulos empiezan sin droides
        this.maxDroids = type === 'energy' ? 0 : 10;
        this.health = 100;
        this.maxHealth = 100;
        this.isConnected = false;
        this.lastAttack = 0;
        this.lastProduction = 0;
        this.lastRecruitment = 0;
    }
    
    getCapacity() {
        if (this.type === 'energy') {
            // Solo retorna cantidad de módulos que puede alimentar
            return [3, 7, 12][this.level - 1];
        }
        
        const baseCapacity = {
            recruitment: 1, // SIEMPRE 1 droide por ciclo (velocidad controlada por getRecruitmentInterval)
            production: 2, // resources per second
            defense: 1 // attacks per round (cada 2 segundos)
        };
        
        if (this.type === 'recruitment') {
            // Reclutamiento: siempre produce 1 droide por ciclo, sin multiplicadores
            return 1;
        } else {
            // Otros módulos: capacidad escalada por droides y nivel
            const multiplier = 1 + (this.level - 1) * 0.5; // +50% per level
            return baseCapacity[this.type] * this.droids * multiplier;
        }
    }
    
    getUpgradeCost() {
        const baseCosts = {
            energy: [0, 225, 300],
            recruitment: [0, 300, 400],
            production: [0, 375, 500],
            defense: [0, 450, 600]
        };
        return baseCosts[this.type][this.level] || 0;
    }
    
    canUpgrade() {
        return this.level < 3 && gameState.resources >= this.getUpgradeCost();
    }
    
    canProduceDroids() {
        // Solo para módulos de reclutamiento
        if (this.type !== 'recruitment') return false;
        
        // Encontrar el índice de este módulo
        const thisModuleIndex = gameState.modules.indexOf(this);
        if (thisModuleIndex === -1) return false;
        
        // Encontrar módulos conectados a este componente usando BFS
        const connectedModules = this.getConnectedComponent(thisModuleIndex);
        
        // Verificar si hay espacio disponible en módulos del mismo componente
        let totalCurrentDroids = 0;
        let totalMaxCapacity = 0;
        
        for (let moduleIndex of connectedModules) {
            const module = gameState.modules[moduleIndex];
            if (module.type !== 'energy') {
                totalCurrentDroids += module.droids;
                totalMaxCapacity += module.maxDroids;
            }
        }
        
        // Solo producir si hay espacio disponible en el componente
        return totalCurrentDroids < totalMaxCapacity;
    }
    
    getConnectedComponent(startIndex) {
        // BFS para encontrar todos los módulos conectados al componente
        const visited = new Set();
        const queue = [startIndex];
        const component = new Set();
        
        while (queue.length > 0) {
            const currentIndex = queue.shift();
            if (visited.has(currentIndex)) continue;
            
            visited.add(currentIndex);
            component.add(currentIndex);
            
            // Buscar conexiones directas
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
    
    getRecruitmentInterval() {
        // Solo para módulos de reclutamiento
        if (this.type !== 'recruitment') return 0;
        
        // Si no hay droides, no produce
        if (this.droids === 0) return 0;
        
        // Progresión de 20s (1 droide) a 5s (10 droides)
        const intervals = [
            0,     // 0 droides - no produce
            20000, // 1 droide - 20 segundos
            17000, // 2 droides - 17 segundos
            15000, // 3 droides - 15 segundos
            13000, // 4 droides - 13 segundos
            11000, // 5 droides - 11 segundos
            9000,  // 6 droides - 9 segundos
            8000,  // 7 droides - 8 segundos
            7000,  // 8 droides - 7 segundos
            6000,  // 9 droides - 6 segundos
            5000   // 10 droides - 5 segundos
        ];
        
        return intervals[Math.min(this.droids, 10)];
    }
    
    produceAndAssignDroids() {
        // Solo para módulos de reclutamiento
        if (this.type !== 'recruitment') return;
        
        const thisModuleIndex = gameState.modules.indexOf(this);
        const connectedModules = this.getConnectedComponent(thisModuleIndex);
        const droidsToAssign = this.getCapacity();
        
        // Encontrar módulos disponibles en el componente (que no sean de energía)
        const availableModules = [];
        for (let moduleIndex of connectedModules) {
            const module = gameState.modules[moduleIndex];
            if (module.type !== 'energy' && module.droids < module.maxDroids) {
                availableModules.push(module);
            }
        }
        
        // Asignar droides directamente, priorizando módulos con menos droides
        let droidsAssigned = 0;
        while (droidsAssigned < droidsToAssign && availableModules.length > 0) {
            // Ordenar por número de droides (ascendente)
            availableModules.sort((a, b) => a.droids - b.droids);
            
            // Asignar al módulo con menos droides
            const targetModule = availableModules[0];
            targetModule.droids++;
            gameState.totalDroids++; // Incrementar contador global solo cuando se asigna
            droidsAssigned++;
            
            // Si el módulo se llenó, quitarlo de la lista
            if (targetModule.droids >= targetModule.maxDroids) {
                availableModules.shift();
            }
        }
        console.log('totalDroids', gameState.totalDroids)
    }
    
    upgrade() {
        if (this.canUpgrade()) {
            gameState.resources -= this.getUpgradeCost();
            this.level++;
        }
    }
    
    draw() {
        const config = moduleTypes[this.type];
        
        // Círculo principal
        ctx.beginPath();
        ctx.arc(this.x, this.y, config.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.isConnected ? config.color : '#666666';
        ctx.fill();
        
        // Borde negro
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Indicador de estado para módulos de reclutamiento
        if (this.type === 'recruitment' && this.isConnected && this.droids > 0) {
            if (!this.canProduceDroids()) {
                // Indicador de producción detenida (borde naranja)
                ctx.beginPath();
                ctx.arc(this.x, this.y, config.radius + 3, 0, Math.PI * 2);
                ctx.strokeStyle = '#ff8800';
                ctx.lineWidth = 3;
                ctx.stroke();
            } else {
                // Indicador de producción activa (borde verde pulsante)
                const timeSinceProduction = gameState.gameTime - this.lastRecruitment;
                const pulseIntensity = Math.sin(gameState.gameTime / 200) * 0.5 + 0.5;
                ctx.beginPath();
                ctx.arc(this.x, this.y, config.radius + 2, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(0, 255, 0, ${0.3 + pulseIntensity * 0.4})`;
                ctx.lineWidth = 2;
                ctx.stroke();
            }
        }
        
        // Indicador de disparo para módulos de defensa
        if (this.type === 'defense' && this.isConnected && this.droids > 0) {
            const timeSinceAttack = gameState.gameTime - this.lastAttack;
            if (timeSinceAttack < 200) { // Mostrar destello por 200ms después de disparar
                ctx.beginPath();
                ctx.arc(this.x, this.y, config.radius + 5, 0, Math.PI * 2);
                ctx.strokeStyle = '#ffff00';
                ctx.lineWidth = 3;
                ctx.stroke();
            }
        }
        
        // Barra de vida
        if (this.health < this.maxHealth) {
            const barWidth = config.radius * 2;
            const barHeight = 4;
            const barX = this.x - barWidth / 2;
            const barY = this.y - config.radius - 10;
            
            ctx.fillStyle = '#333';
            ctx.fillRect(barX, barY, barWidth, barHeight);
            
            ctx.fillStyle = '#ff4444';
            ctx.fillRect(barX, barY, (this.health / this.maxHealth) * barWidth, barHeight);
        }
        
        // Número de droides
        if (this.type !== 'energy' && this.droids > 0) {
            ctx.fillStyle = '#ffffff';
            ctx.font = '12px Courier New';
            ctx.textAlign = 'center';
            ctx.fillText(this.droids.toString(), this.x, this.y + 4);
        }
        
        // Indicador de nivel
        if (this.level > 1) {
            ctx.fillStyle = '#ffffff';
            ctx.font = '10px Courier New';
            ctx.textAlign = 'center';
            ctx.fillText(`L${this.level}`, this.x, this.y - config.radius - 2);
        }
    }
    
    update(deltaTime) {
        if (!this.isConnected) return;
        
        const now = gameState.gameTime;
        
        if (this.type === 'production') {
            if (now - this.lastProduction >= 1000) { // Cada segundo
                gameState.resources += this.getCapacity();
                this.lastProduction = now;
            }
        }
        
        if (this.type === 'recruitment') {
            // Solo producir droides si hay espacio disponible y droides asignados
            const recruitmentInterval = this.getRecruitmentInterval();
            if (recruitmentInterval > 0 && now - this.lastRecruitment >= recruitmentInterval) {
                if (this.canProduceDroids()) {
                    this.produceAndAssignDroids();
                }
                // Siempre resetear el timer, haya producido o no
                this.lastRecruitment = now;
            }
        }
        
        if (this.type === 'defense' && this.droids > 0) {
            if (now - this.lastAttack >= 2000) { // Cada 2 segundos
                this.attackEnemies();
                this.lastAttack = now;
            }
        }
    }
    
    attackEnemies() {
        if (this.droids === 0 || !this.isConnected) return;
        
        const range = 150;
        let attacksThisRound = Math.floor(this.getCapacity());
        let enemiesInRange = [];
        
        // Encontrar todos los enemigos en rango
        for (let enemy of gameState.enemies) {
            const distance = Math.sqrt(
                Math.pow(enemy.x - this.x, 2) + 
                Math.pow(enemy.y - this.y, 2)
            );
            
            if (distance <= range) {
                enemiesInRange.push(enemy);
            }
        }
        
        // Disparar a los enemigos más cercanos
        enemiesInRange.sort((a, b) => {
            const distA = Math.sqrt(Math.pow(a.x - this.x, 2) + Math.pow(a.y - this.y, 2));
            const distB = Math.sqrt(Math.pow(b.x - this.x, 2) + Math.pow(b.y - this.y, 2));
            return distA - distB;
        });
        
        for (let i = 0; i < Math.min(attacksThisRound, enemiesInRange.length); i++) {
            const enemy = enemiesInRange[i];
            // Crear proyectil hacia el enemigo
            const projectile = new Projectile(this.x, this.y, enemy.x, enemy.y, false);
            gameState.projectiles.push(projectile);
        }
    }
}

// Clase Enemy
class Enemy {
    constructor() {
        this.spawnFromEdge();
        this.health = 50 * Math.pow(1.1, gameState.waveNumber);
        this.maxHealth = this.health;
        this.speed = 100 * Math.pow(1.1, gameState.waveNumber);
        this.target = null;
        this.lastAttack = 0;
        this.direction = Math.random() * Math.PI * 2;
        this.changeDirectionTimer = 0;
    }
    
    spawnFromEdge() {
        const edge = Math.floor(Math.random() * 4);
        switch(edge) {
            case 0: // Top
                this.x = Math.random() * canvas.width;
                this.y = -20;
                break;
            case 1: // Right
                this.x = canvas.width + 20;
                this.y = Math.random() * canvas.height;
                break;
            case 2: // Bottom
                this.x = Math.random() * canvas.width;
                this.y = canvas.height + 20;
                break;
            case 3: // Left
                this.x = -20;
                this.y = Math.random() * canvas.height;
                break;
        }
    }
    
    update(deltaTime) {
        // Comportamiento errático como moscas
        this.changeDirectionTimer += deltaTime;
        if (this.changeDirectionTimer > 1000 + Math.random() * 2000) {
            this.direction += (Math.random() - 0.5) * Math.PI;
            this.changeDirectionTimer = 0;
        }
        
        // Buscar módulo más cercano
        let closestModule = null;
        let closestDistance = Infinity;
        
        for (let module of gameState.modules) {
            const distance = Math.sqrt(
                Math.pow(module.x - this.x, 2) + 
                Math.pow(module.y - this.y, 2)
            );
            
            if (distance < closestDistance) {
                closestDistance = distance;
                closestModule = module;
            }
        }
        
        if (closestModule) {
            if (closestDistance < 100) { // Rango de disparo aumentado
                // Disparar al módulo
                this.target = closestModule;
                if (gameState.gameTime - this.lastAttack >= 1000) { // Cada segundo
                    const projectile = new Projectile(this.x, this.y, closestModule.x, closestModule.y, true);
                    gameState.projectiles.push(projectile);
                    this.lastAttack = gameState.gameTime;
                }
            } else {
                // Moverse hacia el módulo con comportamiento errático
                const targetAngle = Math.atan2(
                    closestModule.y - this.y, 
                    closestModule.x - this.x
                );
                
                // Mezclar dirección hacia objetivo con movimiento errático
                this.direction = this.direction * 0.7 + targetAngle * 0.3;
            }
        }
        
        // Mover
        this.x += Math.cos(this.direction) * this.speed * deltaTime / 1000;
        this.y += Math.sin(this.direction) * this.speed * deltaTime / 1000;
        
        // Mantener en pantalla
        this.x = Math.max(10, Math.min(canvas.width - 10, this.x));
        this.y = Math.max(10, Math.min(canvas.height - 10, this.y));
    }
    
    takeDamage(damage) {
        this.health -= damage;
        if (this.health <= 0) {
            const index = gameState.enemies.indexOf(this);
            if (index > -1) {
                gameState.enemies.splice(index, 1);
            }
        }
    }
    
    draw() {
        // Nave enemiga (triángulo rojo)
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.direction);
        
        ctx.beginPath();
        ctx.moveTo(8, 0);
        ctx.lineTo(-8, -5);
        ctx.lineTo(-8, 5);
        ctx.closePath();
        ctx.fillStyle = '#ff4444';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();
        
        ctx.restore();
        
        // Barra de vida
        if (this.health < this.maxHealth) {
            const barWidth = 20;
            const barHeight = 3;
            const barX = this.x - barWidth / 2;
            const barY = this.y - 15;
            
            ctx.fillStyle = '#333';
            ctx.fillRect(barX, barY, barWidth, barHeight);
            
            ctx.fillStyle = '#ff4444';
            ctx.fillRect(barX, barY, (this.health / this.maxHealth) * barWidth, barHeight);
        }
    }
}

// Inicializar el juego
function initGame() {
    // Calcular centro de la pantalla
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    // Crear módulos iniciales centrados
    const energyModule = new Module(centerX - 50, centerY, 'energy', 0);
    const productionModule = new Module(centerX + 50, centerY, 'production', 1);
    
    gameState.modules = [energyModule, productionModule];
    gameState.connections = [{ from: 0, to: 1 }];
    
    // Asignar el único droide inicial al módulo de producción
    productionModule.droids = 1;
    gameState.totalDroids = 1;
    
    updateConnections();
}


// Calcular distancias de grafos desde un módulo de energía usando BFS
function calculateGraphDistances(energyModuleIndex) {
    const distances = new Map();
    const queue = [];
    const visited = new Set();
    
    // Inicializar BFS desde el módulo de energía
    queue.push({ moduleIndex: energyModuleIndex, distance: 0 });
    visited.add(energyModuleIndex);
    distances.set(energyModuleIndex, 0);
    
    while (queue.length > 0) {
        const { moduleIndex, distance } = queue.shift();
        
        // Explorar todas las conexiones desde este módulo
        for (let conn of gameState.connections) {
            let nextModuleIndex = null;
            
            if (conn.from === moduleIndex && !visited.has(conn.to)) {
                nextModuleIndex = conn.to;
            } else if (conn.to === moduleIndex && !visited.has(conn.from)) {
                nextModuleIndex = conn.from;
            }
            
            if (nextModuleIndex !== null) {
                visited.add(nextModuleIndex);
                distances.set(nextModuleIndex, distance + 1);
                queue.push({ moduleIndex: nextModuleIndex, distance: distance + 1 });
            }
        }
    }
    
    return distances;
}

// Priorizar módulos para asignación de energía (resolver empates)
function prioritizeModules(modules, distances) {
    return modules.slice().sort((a, b) => {
        const aIndex = gameState.modules.indexOf(a);
        const bIndex = gameState.modules.indexOf(b);
        
        // 1º: Por distancia de grafos (más cercano primero)
        const aDistance = distances.get(aIndex) || Infinity;
        const bDistance = distances.get(bIndex) || Infinity;
        if (aDistance !== bDistance) {
            return aDistance - bDistance;
        }
        
        // 2º: Empate en distancia - Por tipo de módulo
        const typePriority = { 
            defense: 3,      // Máxima prioridad (crítico en combate)
            production: 2,   // Media prioridad (economía)
            recruitment: 1   // Menor prioridad (crecimiento largo plazo)
        };
        const aPriority = typePriority[a.type] || 0;
        const bPriority = typePriority[b.type] || 0;
        if (aPriority !== bPriority) {
            return bPriority - aPriority; // Mayor prioridad primero
        }
        
        // 3º: Empate en tipo - Por nivel del módulo
        if (a.level !== b.level) {
            return b.level - a.level; // Nivel más alto primero
        }
        
        // 4º: Empate final - Por orden de creación (determinístico)
        return a.id - b.id;
    });
}

function updateConnections() {
    // Resetear conexiones
    gameState.modules.forEach(module => module.isConnected = false);
    
    // Los módulos de energía siempre están "conectados" (se autoalimentan)
    gameState.modules.forEach(module => {
        if (module.type === 'energy') {
            module.isConnected = true;
        }
    });
    
    // Obtener módulos de energía ordenados por prioridad (nivel descendente, luego por orden de creación)
    const energyModules = gameState.modules
        .map((module, index) => ({ module, index }))
        .filter(({ module }) => module.type === 'energy')
        .sort((a, b) => {
            // Primero por nivel (mayor nivel primero)
            if (a.module.level !== b.module.level) {
                return b.module.level - a.module.level;
            }
            // Empate: por orden de creación (id menor primero)
            return a.module.id - b.module.id;
        });
    
    // Procesar cada módulo de energía individualmente
    for (let { module: energyModule, index: energyIndex } of energyModules) {
        // Calcular distancias de grafos desde este módulo de energía
        const distances = calculateGraphDistances(energyIndex);
        
        // Obtener módulos no-energía alcanzables que aún no han sido alimentados
        const reachableModules = gameState.modules
            .filter((module, index) => 
                module.type !== 'energy' && 
                !module.isConnected && 
                distances.has(index)
            );
        
        if (reachableModules.length === 0) continue;
        
        // Priorizar módulos usando el algoritmo de resolución de empates
        const prioritizedModules = prioritizeModules(reachableModules, distances);
        
        // Obtener capacidad de este módulo de energía (solo módulos)
        const moduleCapacity = energyModule.getCapacity();
        let remainingModuleCapacity = moduleCapacity;
        
        // Asignar energía a módulos según prioridad
        for (let module of prioritizedModules) {
            if (remainingModuleCapacity <= 0) break;
            
            // Solo marcar módulo como conectado
            module.isConnected = true;
            remainingModuleCapacity--;
        }
    }
}

// Seleccionar tipo de módulo para construir
function selectModuleType(type) {
    if (gameState.resources >= moduleTypes[type].cost) {
        gameState.selectedModuleType = type;
        gameState.placingModule = true;
        gameState.connectionMode = false;
        gameState.destroyMode = false;
        canvas.style.cursor = 'crosshair';
    }
}

// Activar modo de conexión
function selectConnectionMode() {
    if (gameState.resources >= 50) {
        gameState.connectionMode = true;
        gameState.placingModule = false;
        gameState.destroyMode = false;
        gameState.selectedModuleType = null;
        canvas.style.cursor = 'pointer';
    }
}

// Activar modo de destruir
function selectDestroyMode() {
    gameState.destroyMode = true;
    gameState.placingModule = false;
    gameState.connectionMode = false;
    gameState.selectedModuleType = null;
    canvas.style.cursor = 'crosshair';
}

// Destruir módulo
function destroyModule(moduleIndex) {
    if (moduleIndex < 0 || moduleIndex >= gameState.modules.length) return false;
    
    const module = gameState.modules[moduleIndex];
    
    // Los droides se destruyen junto con el módulo
    if (module.type !== 'energy') {
        gameState.totalDroids -= module.droids;
    }
    
    // Remover el módulo
    gameState.modules.splice(moduleIndex, 1);
    
    // Actualizar conexiones (remover las que involucran este módulo y reindexar)
    gameState.connections = gameState.connections.filter(conn => 
        conn.from !== moduleIndex && conn.to !== moduleIndex
    ).map(conn => ({
        from: conn.from > moduleIndex ? conn.from - 1 : conn.from,
        to: conn.to > moduleIndex ? conn.to - 1 : conn.to
    }));
    
    updateConnections();
    return true;
}

// Verificar si ya existe una conexión entre dos módulos
function connectionExists(moduleA, moduleB) {
    return gameState.connections.some(conn => 
        (conn.from === moduleA && conn.to === moduleB) ||
        (conn.from === moduleB && conn.to === moduleA)
    );
}

// Crear conexión desde un módulo al más cercano
function createConnectionFromModule(sourceModuleIndex) {
    const sourceModule = gameState.modules[sourceModuleIndex];
    let closestModuleIndex = null;
    let closestDistance = Infinity;
    
    // Buscar el módulo más cercano que NO tenga conexión con el módulo fuente
    for (let i = 0; i < gameState.modules.length; i++) {
        if (i === sourceModuleIndex) continue;
        
        // Verificar si ya existe conexión con este módulo
        if (connectionExists(sourceModuleIndex, i)) continue;
        
        const targetModule = gameState.modules[i];
        const distance = Math.sqrt(
            Math.pow(sourceModule.x - targetModule.x, 2) + 
            Math.pow(sourceModule.y - targetModule.y, 2)
        );
        
        if (distance < closestDistance) {
            closestDistance = distance;
            closestModuleIndex = i;
        }
    }
    
    // Crear conexión si se encontró un módulo válido
    if (closestModuleIndex !== null) {
        gameState.connections.push({
            from: sourceModuleIndex,
            to: closestModuleIndex
        });
        
        gameState.resources -= 50;
        updateConnections();
        return true;
    }
    
    return false; // No se encontró ningún módulo para conectar
}

// Función para colocar módulos (disponible tanto en navegador como en tests)
function placeModule(x, y) {
    const type = gameState.selectedModuleType;
    const cost = moduleTypes[type].cost;
    const connectionCost = gameState.modules.length > 0 ? 50 : 0; // Solo cobrar conexión si no es el primer módulo
    const totalCost = cost + connectionCost;
    
    if (gameState.resources < totalCost) return;
    
    // Verificar que no se superponga
    for (let module of gameState.modules) {
        const distance = Math.sqrt(Math.pow(x - module.x, 2) + Math.pow(y - module.y, 2));
        if (distance < 50) return;
    }
    
    // Verificar límites del canvas (solo en navegador)
    if (typeof document !== 'undefined' && (x < 20 || x > canvas.width - 20 || y < 20 || y > canvas.height - 20)) return;
    
    // Crear nuevo módulo
    const newModule = new Module(x, y, type, gameState.modules.length);
    gameState.modules.push(newModule);
    gameState.resources -= cost;
    
    // Conectar al módulo más cercano (SIEMPRE, sin importar la distancia)
    if (gameState.modules.length > 1) {
        let closestModule = null;
        let closestDistance = Infinity;
        
        for (let i = 0; i < gameState.modules.length - 1; i++) {
            const module = gameState.modules[i];
            const distance = Math.sqrt(Math.pow(x - module.x, 2) + Math.pow(y - module.y, 2));
            
            if (distance < closestDistance) {
                closestDistance = distance;
                closestModule = i;
            }
        }
        
        // SIEMPRE conectar al más cercano y cobrar el costo de conexión
        if (closestModule !== null) {
            gameState.connections.push({
                from: closestModule,
                to: gameState.modules.length - 1
            });
            gameState.resources -= 50; // Costo de conexión
        }
    }
    
    updateConnections();
    
    gameState.selectedModuleType = null;
    gameState.placingModule = false;
    if (typeof document !== 'undefined') {
        canvas.style.cursor = 'default';
    }
}

// Función para detectar click en conexión
function getClickedConnection(x, y) {
    const tolerance = 8; // Distancia máxima para considerar un click en la línea
    
    for (let i = 0; i < gameState.connections.length; i++) {
        const conn = gameState.connections[i];
        const moduleA = gameState.modules[conn.from];
        const moduleB = gameState.modules[conn.to];
        
        if (!moduleA || !moduleB) continue;
        
        // Calcular distancia del punto a la línea usando fórmula punto-línea
        const A = y - moduleA.y;
        const B = moduleA.x - x;
        const C = x * moduleA.y - moduleA.x * y;
        
        const lineLength = Math.sqrt(Math.pow(moduleB.x - moduleA.x, 2) + Math.pow(moduleB.y - moduleA.y, 2));
        const distance = Math.abs(A * moduleB.x + B * moduleB.y + C) / lineLength;
        
        // Verificar que el punto esté dentro del segmento (no en la extensión de la línea)
        const dotProduct = (x - moduleA.x) * (moduleB.x - moduleA.x) + (y - moduleA.y) * (moduleB.y - moduleA.y);
        if (dotProduct < 0 || dotProduct > lineLength * lineLength) continue;
        
        if (distance <= tolerance) {
            return i; // Retornar índice de la conexión
        }
    }
    
    return null; // No hay conexión bajo el click
}

// Eventos del canvas
let lastClickTime = 0;
let lastClickedModule = null;

if (typeof document !== 'undefined') {
canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    // Convertir coordenadas de pantalla a coordenadas del mundo
    const x = gameState.camera.x + (e.clientX - rect.left) / gameState.camera.zoom;
    const y = gameState.camera.y + (e.clientY - rect.top) / gameState.camera.zoom;
    
    // Verificar si estamos colocando un módulo
    if (gameState.placingModule && gameState.selectedModuleType) {
        placeModule(x, y);
        return;
    }
    
    // Buscar módulo bajo el cursor
    let clickedModule = null;
    let clickedModuleIndex = -1;
    for (let i = 0; i < gameState.modules.length; i++) {
        const module = gameState.modules[i];
        const distance = Math.sqrt(Math.pow(x - module.x, 2) + Math.pow(y - module.y, 2));
        if (distance <= moduleTypes[module.type].radius) {
            clickedModule = module;
            clickedModuleIndex = i;
            break;
        }
    }
    
    if (clickedModule) {
        // Modo destruir: eliminar módulo
        if (gameState.destroyMode) {
            if (destroyModule(clickedModuleIndex)) {
                gameState.destroyMode = false;
                canvas.style.cursor = 'default';
            }
            return;
        }
        
        // Modo conexión: crear conexión al módulo más cercano
        if (gameState.connectionMode) {
            if (createConnectionFromModule(clickedModuleIndex)) {
                gameState.connectionMode = false;
                canvas.style.cursor = 'default';
            }
            return;
        }
        
        // Modo normal: solo doble-click para transferir droides
        const currentTime = Date.now();
        
        // Verificar doble clic en el mismo módulo
        if (currentTime - lastClickTime < 300 && lastClickedModule === clickedModule) {
            // Si hay conexión seleccionada, usar transferencia específica
            if (gameState.selectedConnection !== null) {
                transferDroidByConnection(clickedModule, gameState.selectedConnection);
            } else {
                // Transferencia normal por distancia de grafo
                transferDroid(clickedModule);
            }
            lastClickTime = 0;
            lastClickedModule = null;
        } else {
            lastClickTime = currentTime;
            lastClickedModule = clickedModule;
        }
    } else {
        // Click en área vacía - verificar si clickeamos una conexión
        const clickedConnectionIndex = getClickedConnection(x, y);
        if (clickedConnectionIndex !== null) {
            // Seleccionar/deseleccionar conexión
            if (gameState.selectedConnection === clickedConnectionIndex) {
                gameState.selectedConnection = null; // Deseleccionar si ya estaba seleccionada
            } else {
                gameState.selectedConnection = clickedConnectionIndex; // Seleccionar nueva conexión
            }
        } else {
            // Click en área realmente vacía - cancelar modos activos y deseleccionar conexión
            if (gameState.connectionMode || gameState.destroyMode) {
                gameState.connectionMode = false;
                gameState.destroyMode = false;
                canvas.style.cursor = 'default';
            }
            gameState.selectedConnection = null; // Deseleccionar conexión
            lastClickTime = 0;
            lastClickedModule = null;
        }
    }
});

canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    // Convertir coordenadas de pantalla a coordenadas del mundo
    const x = gameState.camera.x + (e.clientX - rect.left) / gameState.camera.zoom;
    const y = gameState.camera.y + (e.clientY - rect.top) / gameState.camera.zoom;
    
    // Actualizar posición del mouse para preview
    mouseX = x;
    mouseY = y;
});

canvas.addEventListener('mouseup', (e) => {
    // Evento mouseup simplificado - ya no hay arrastre
});

// Prevenir el menú contextual del clic derecho
canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
});

// Control de zoom con scroll del mouse
canvas.addEventListener('wheel', (e) => {
    e.preventDefault(); // Evitar scroll de página
    
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Calcular punto del mundo que está bajo el mouse antes del zoom
    const worldXBefore = gameState.camera.x + mouseX / gameState.camera.zoom;
    const worldYBefore = gameState.camera.y + mouseY / gameState.camera.zoom;
    
    // Aplicar zoom
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1; // Zoom out / Zoom in
    const oldZoom = gameState.camera.zoom;
    gameState.camera.zoom *= zoomFactor;
    
    // Limitar zoom
    gameState.camera.zoom = Math.max(gameState.camera.minZoom, 
                                   Math.min(gameState.camera.maxZoom, gameState.camera.zoom));
    
    // Calcular punto del mundo que estaría bajo el mouse después del zoom
    const worldXAfter = gameState.camera.x + mouseX / gameState.camera.zoom;
    const worldYAfter = gameState.camera.y + mouseY / gameState.camera.zoom;
    
    // Ajustar cámara para mantener el mismo punto del mundo bajo el mouse
    gameState.camera.x += worldXBefore - worldXAfter;
    gameState.camera.y += worldYBefore - worldYAfter;
});

// Transferir droide usando conexión específica seleccionada
function transferDroidByConnection(targetModule, connectionIndex) {
    if (targetModule.type === 'energy' || targetModule.droids >= targetModule.maxDroids) return;
    
    const connection = gameState.connections[connectionIndex];
    if (!connection) return;
    
    // Encontrar el índice del módulo objetivo
    const targetModuleIndex = gameState.modules.indexOf(targetModule);
    if (targetModuleIndex === -1) return;
    
    // Determinar cuál módulo de la conexión es el fuente
    let sourceModuleIndex = null;
    if (connection.from === targetModuleIndex) {
        sourceModuleIndex = connection.to;
    } else if (connection.to === targetModuleIndex) {
        sourceModuleIndex = connection.from;
    } else {
        // El módulo objetivo no está conectado por esta conexión
        return;
    }
    
    const sourceModule = gameState.modules[sourceModuleIndex];
    if (!sourceModule || sourceModule.type === 'energy' || sourceModule.droids === 0) {
        // No hay droides para transferir en el módulo fuente
        return;
    }
    
    // Realizar transferencia
    sourceModule.droids--;
    targetModule.droids++;
    
    // Si el módulo objetivo es de reclutamiento, resetear su timer
    if (targetModule.type === 'recruitment') {
        targetModule.lastRecruitment = gameState.gameTime;
    }
}

function transferDroid(targetModule) {
    if (targetModule.type === 'energy' || targetModule.droids >= targetModule.maxDroids) return;
    
    // Encontrar el índice del módulo objetivo
    const targetModuleIndex = gameState.modules.indexOf(targetModule);
    if (targetModuleIndex === -1) return;
    
    // Calcular distancias de grafo desde el módulo objetivo
    const distances = calculateGraphDistances(targetModuleIndex);
    
    // Buscar módulo más cercano por grafo con droides disponibles para mover
    let sourceModule = null;
    let closestGraphDistance = Infinity;
    
    for (let i = 0; i < gameState.modules.length; i++) {
        const module = gameState.modules[i];
        if (module === targetModule || module.type === 'energy' || module.droids === 0) continue;
        
        // Solo considerar módulos conectados al objetivo
        const graphDistance = distances.get(i);
        if (graphDistance === undefined) continue; // No hay conexión
        
        if (graphDistance < closestGraphDistance) {
            closestGraphDistance = graphDistance;
            sourceModule = module;
        }
    }
    
    // Solo mover droide si encontramos un módulo fuente
    if (sourceModule) {
        sourceModule.droids--;
        targetModule.droids++;
        
        // Si el módulo objetivo es de reclutamiento, resetear su timer para evitar producción inmediata
        if (targetModule.type === 'recruitment') {
            targetModule.lastRecruitment = gameState.gameTime;
        }
    }
}

function connectionsIntersect() {
    // Verificar intersecciones entre conexiones
    for (let i = 0; i < gameState.connections.length; i++) {
        for (let j = i + 1; j < gameState.connections.length; j++) {
            const conn1 = gameState.connections[i];
            const conn2 = gameState.connections[j];
            
            // Verificar que los módulos existan
            if (!gameState.modules[conn1.from] || !gameState.modules[conn1.to] ||
                !gameState.modules[conn2.from] || !gameState.modules[conn2.to]) {
                continue;
            }
            
            const m1a = gameState.modules[conn1.from];
            const m1b = gameState.modules[conn1.to];
            const m2a = gameState.modules[conn2.from];
            const m2b = gameState.modules[conn2.to];
            
            // No verificar si las conexiones comparten un módulo
            if (conn1.from === conn2.from || conn1.from === conn2.to ||
                conn1.to === conn2.from || conn1.to === conn2.to) {
                continue;
            }
            
            if (linesIntersect(m1a.x, m1a.y, m1b.x, m1b.y, m2a.x, m2a.y, m2b.x, m2b.y)) {
                return true;
            }
        }
    }
    
    // Verificar si alguna conexión intersecta algún módulo (que no sea sus extremos)
    for (let i = 0; i < gameState.connections.length; i++) {
        const conn = gameState.connections[i];
        
        // Verificar que los módulos existan
        if (!gameState.modules[conn.from] || !gameState.modules[conn.to]) {
            continue;
        }
        
        const ma = gameState.modules[conn.from];
        const mb = gameState.modules[conn.to];
        
        for (let j = 0; j < gameState.modules.length; j++) {
            const module = gameState.modules[j];
            
            // No verificar contra los extremos de la conexión
            if (j === conn.from || j === conn.to) continue;
            
            if (lineIntersectsCircle(ma.x, ma.y, mb.x, mb.y, module.x, module.y, 20)) {
                return true;
            }
        }
    }
    
    return false;
}

function linesIntersect(x1, y1, x2, y2, x3, y3, x4, y4) {
    const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (Math.abs(denom) < 0.0001) return false; // Líneas paralelas o coincidentes
    
    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
    const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;
    
    // Intersección solo si ambos parámetros están entre 0 y 1 (excluyendo extremos)
    return t > 0.01 && t < 0.99 && u > 0.01 && u < 0.99;
}

function lineIntersectsCircle(x1, y1, x2, y2, cx, cy, radius) {
    const A = y2 - y1;
    const B = x1 - x2;
    const C = x2 * y1 - x1 * y2;
    
    const distance = Math.abs(A * cx + B * cy + C) / Math.sqrt(A * A + B * B);
    return distance <= radius;
}

// Generar oleada de enemigos
function spawnWave() {
    gameState.waveNumber++;
    const enemyCount = 3 + (gameState.waveNumber - 1) * 2;
    
    for (let i = 0; i < enemyCount; i++) {
        gameState.enemies.push(new Enemy());
    }
    
    gameState.nextWaveTime = gameState.gameTime + 180000; // 3 minutos después
}

// TODO: Remover en producción - Función de desarrollo para invocar oleadas
function forceSpawnWave() {
    if (gameState.waveNumber < 10) {
        spawnWave();
    }
}

// Actualizar interfaz
function updateUI() {
    // Calcular droides asignados
    let assignedDroids = 0;
    gameState.modules.forEach(module => {
        if (module.type !== 'energy') {
            assignedDroids += module.droids;
        }
    });
    
    document.getElementById('resources').textContent = Math.floor(gameState.resources);
    document.getElementById('droids').textContent = `${assignedDroids}/${gameState.totalDroids}`;
    
    // Calcular energía disponible y usada (solo módulos)
    let totalEnergyCapacity = 0;
    let usedModules = 0;
    
    for (let module of gameState.modules) {
        if (module.type === 'energy' && module.isConnected) {
            totalEnergyCapacity += module.getCapacity();
        } else if (module.type !== 'energy' && module.isConnected) {
            usedModules++; // Solo contar módulos conectados no-energía
        }
    }
    
    document.getElementById('energy').textContent = `${usedModules}/${totalEnergyCapacity}`;
    document.getElementById('wave').textContent = gameState.waveNumber;
    document.getElementById('gameSpeedDisplay').textContent = `${gameState.gameSpeed}x`;
    
    // Mostrar nivel de zoom (si el elemento existe)
    const zoomDisplay = document.getElementById('zoomDisplay');
    if (zoomDisplay) {
        zoomDisplay.textContent = `${Math.round(gameState.camera.zoom * 100)}%`;
    }
    
    // Actualizar botón de pausa
    const pauseButton = document.getElementById('pauseButton');
    if (pauseButton) {
        pauseButton.textContent = gameState.gamePaused ? 'Reanudar Juego' : 'Pausar Juego';
        pauseButton.style.background = gameState.gamePaused ? '#28a745' : '#0f3460';
    }
    
    // Timer
    const timeToWave = Math.max(0, gameState.nextWaveTime - gameState.gameTime);
    const minutes = Math.floor(timeToWave / 60000);
    const seconds = Math.floor((timeToWave % 60000) / 1000);
    document.getElementById('timer').textContent = 
        `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    // Lista de módulos
    const modulesList = document.getElementById('modulesList');
    modulesList.innerHTML = '';
    
    gameState.modules.forEach((module, index) => {
        const div = document.createElement('div');
        div.className = 'module-item';
        
        const status = module.isConnected ? '🟢' : '🔴';
        const health = Math.floor(module.health);
        const droids = module.type === 'energy' ? 'N/A' : `${module.droids}/${module.maxDroids}`;
        
        let statusText = '';
        if (module.type === 'recruitment' && module.isConnected && module.droids > 0) {
            statusText = module.canProduceDroids() ? 
                '<br><small style="color: #90EE90;">▶ Produciendo</small>' : 
                '<br><small style="color: #FFA500;">⏸ Sin espacio</small>';
        }
        
        div.innerHTML = `
            ${status} ${moduleTypes[module.type].name} L${module.level}<br>
            Vida: ${health}/100 | Droides: ${droids}${statusText}
            ${module.canUpgrade() ? 
                `<button class="upgrade-btn" onclick="upgradeModule(${index})">
                    Mejorar (${module.getUpgradeCost()})
                </button>` : ''}
        `;
        
        modulesList.appendChild(div);
    });
    
    // Actualizar botones de construcción usando IDs específicos
    const buildingButtons = [
        { id: 'energyButton', type: 'energy', color: 'Amarillo' },
        { id: 'recruitmentButton', type: 'recruitment', color: 'Verde' },
        { id: 'productionButton', type: 'production', color: 'Azul' },
        { id: 'defenseButton', type: 'defense', color: 'Rojo' }
    ];
    
    buildingButtons.forEach(({ id, type, color }) => {
        const button = document.getElementById(id);
        if (button && moduleTypes[type]) {
            const cost = moduleTypes[type].cost;
            const connectionCost = gameState.modules.length > 0 ? 50 : 0;
            const totalCost = cost + connectionCost;
            
            button.disabled = gameState.resources < totalCost;
            
            // Actualizar texto del botón para mostrar costo total
            const costText = connectionCost > 0 ? `${cost}+${connectionCost}` : cost.toString();
            button.textContent = `${moduleTypes[type].name} (${costText}) - ${color}`;
        }
    });
    
    // Actualizar botón de conexión
    const connectionButton = document.getElementById('connectionButton');
    if (connectionButton) {
        connectionButton.disabled = gameState.resources < 50;
    }
}

function upgradeModule(index) {
    const module = gameState.modules[index];
    if (module.canUpgrade()) {
        module.upgrade();
        updateConnections();
    }
}

// Cambiar velocidad del juego
function changeGameSpeed() {
    const speeds = [1.0, 2.0, 4.0];
    const currentIndex = speeds.indexOf(gameState.gameSpeed);
    const nextIndex = (currentIndex + 1) % speeds.length;
    gameState.gameSpeed = speeds[nextIndex];
}

// Alternar pausa del juego
function togglePause() {
    gameState.gamePaused = !gameState.gamePaused;
}

// Remover módulos destruidos
function removeDestroyedModules() {
    const destroyedModules = [];
    
    gameState.modules.forEach((module, index) => {
        if (module.health <= 0) {
            destroyedModules.push(index);
            // Los droides se destruyen junto con el módulo
            gameState.totalDroids -= module.droids;
        }
    });
    
    // Remover módulos destruidos (en orden inverso para mantener índices)
    destroyedModules.reverse().forEach(index => {
        gameState.modules.splice(index, 1);
        
        // Actualizar conexiones
        gameState.connections = gameState.connections.filter(conn => 
            conn.from !== index && conn.to !== index
        ).map(conn => ({
            from: conn.from > index ? conn.from - 1 : conn.from,
            to: conn.to > index ? conn.to - 1 : conn.to
        }));
    });
    
    if (destroyedModules.length > 0) {
        updateConnections();
    }
}

// Verificar condiciones de victoria/derrota
function checkGameEnd() {
    if (gameState.modules.length === 0) {
        alert('¡DERROTA! Todos tus módulos han sido destruidos.');
        gameState.gameRunning = false;
        return;
    }
    
    if (gameState.waveNumber >= 10 && gameState.enemies.length === 0) {
        alert('¡VICTORIA! Has sobrevivido a todas las oleadas.');
        gameState.gameRunning = false;
        return;
    }
}

// Dibujar estrellas de fondo
function drawStars() {
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 100; i++) {
        const x = (i * 73) % canvas.width;
        const y = (i * 97) % canvas.height;
        const size = (i % 3) + 1;
        
        ctx.beginPath();
        ctx.arc(x, y, size * 0.5, 0, Math.PI * 2);
        ctx.fill();
    }
}

// Renderizar el juego
function render() {
    // Limpiar canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Aplicar transformación de zoom y cámara
    ctx.save();
    ctx.scale(gameState.camera.zoom, gameState.camera.zoom);
    ctx.translate(-gameState.camera.x, -gameState.camera.y);
    
    // Dibujar estrellas
    drawStars();
    
    // Dibujar conexiones
    ctx.lineWidth = 4;
    for (let i = 0; i < gameState.connections.length; i++) {
        const conn = gameState.connections[i];
        const moduleA = gameState.modules[conn.from];
        const moduleB = gameState.modules[conn.to];
        
        if (moduleA && moduleB) {
            // Colorear diferente si está seleccionada
            if (gameState.selectedConnection === i) {
                ctx.strokeStyle = '#ffff00'; // Amarillo para conexión seleccionada
                ctx.lineWidth = 6; // Más gruesa cuando está seleccionada
            } else {
                ctx.strokeStyle = '#ffffff'; // Blanco normal
                ctx.lineWidth = 4;
            }
            
            ctx.beginPath();
            ctx.moveTo(moduleA.x, moduleA.y);
            ctx.lineTo(moduleB.x, moduleB.y);
            ctx.stroke();
        }
    }
    
    // Dibujar módulos
    for (let module of gameState.modules) {
        module.draw();
    }
    
    // Dibujar enemigos
    for (let enemy of gameState.enemies) {
        enemy.draw();
    }
    
    // Dibujar proyectiles
    for (let projectile of gameState.projectiles) {
        projectile.draw();
    }
    
    // Dibujar preview del módulo a colocar (dentro de la transformación de cámara)
    if (gameState.placingModule && gameState.selectedModuleType) {
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = moduleTypes[gameState.selectedModuleType].color;
        ctx.beginPath();
        ctx.arc(mouseX, mouseY, 20, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }
    
    // Restaurar transformación de cámara
    ctx.restore();
    
    // Mostrar indicador de pausa
    if (gameState.gamePaused) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = '#ffffff';
        ctx.font = '48px Courier New';
        ctx.textAlign = 'center';
        ctx.fillText('PAUSADO', canvas.width / 2, canvas.height / 2);
        
        ctx.font = '24px Courier New';
        ctx.fillText('Presiona ESPACIO o click en "Reanudar" para continuar', canvas.width / 2, canvas.height / 2 + 60);
    }
}

// Variables para seguimiento del mouse
let mouseX = 0;
let mouseY = 0;

// Sistema de control de cámara
const keys = {
    w: false,
    a: false,
    s: false,
    d: false
};

// Función para actualizar la posición de la cámara
function updateCamera(deltaTime) {
    // Ajustar velocidad por zoom para mantener velocidad visual consistente
    const speed = (gameState.camera.speed * deltaTime / 1000) / gameState.camera.zoom;
    
    if (keys.w) gameState.camera.y -= speed;
    if (keys.s) gameState.camera.y += speed;
    if (keys.a) gameState.camera.x -= speed;
    if (keys.d) gameState.camera.x += speed;
}

// Bucle principal del juego
let lastTime = 0;
function gameLoop(currentTime) {
    if (!gameState.gameRunning) return;
    
    // Si está pausado, solo renderizar y salir
    if (gameState.gamePaused) {
        render();
        updateUI();
        requestAnimationFrame(gameLoop);
        return;
    }
    
    const deltaTime = (currentTime - lastTime) * gameState.gameSpeed;
    lastTime = currentTime;
    
    gameState.gameTime += deltaTime;
    
    // Actualizar cámara
    updateCamera(deltaTime);
    
    // Generar oleadas
    if (gameState.gameTime >= gameState.nextWaveTime && gameState.waveNumber < 10) {
        spawnWave();
    }
    
    // Actualizar módulos
    for (let module of gameState.modules) {
        module.update(deltaTime);
    }
    
    // Actualizar enemigos
    for (let enemy of gameState.enemies) {
        enemy.update(deltaTime);
    }
    
    // Actualizar proyectiles
    for (let i = gameState.projectiles.length - 1; i >= 0; i--) {
        const projectile = gameState.projectiles[i];
        projectile.update(deltaTime);
        
        // Remover proyectiles que han impactado o expirado
        if (projectile.hasHit || projectile.life <= 0) {
            gameState.projectiles.splice(i, 1);
        }
    }
    
    // Remover módulos destruidos
    removeDestroyedModules();
    
    // Verificar fin del juego
    checkGameEnd();
    
    // Renderizar
    render();
    updateUI();
    
    requestAnimationFrame(gameLoop);
}

// Eventos de teclado para cancelar modos, pausar y controlar cámara
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        gameState.selectedModuleType = null;
        gameState.placingModule = false;
        gameState.connectionMode = false;
        gameState.destroyMode = false;
        gameState.selectedConnection = null; // Deseleccionar conexión
        canvas.style.cursor = 'default';
    }
    
    if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault(); // Evitar scroll de página
        togglePause();
    }
    
    // Control de cámara con WASD
    const key = e.key.toLowerCase();
    if (key === 'w' || key === 'a' || key === 's' || key === 'd') {
        e.preventDefault(); // Evitar scroll de página
        keys[key] = true;
    }
});

// Evento keyup para dejar de mover la cámara
document.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    if (key === 'w' || key === 'a' || key === 's' || key === 'd') {
        keys[key] = false;
    }
});

// Redimensionar canvas
window.addEventListener('resize', () => {
    canvas.width = window.innerWidth - 250;
    canvas.height = window.innerHeight;
});

} // Fin del if (typeof document !== 'undefined')

// Solo ejecutar en navegador, no en Node.js (tests)
if (typeof document !== 'undefined') {
    // Inicializar y comenzar el juego
    initGame();
    updateConnections();
    requestAnimationFrame(gameLoop);
}

// Exportar para tests (solo en Node.js)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        Module,
        gameState,
        moduleTypes,
        initGame,
        updateConnections,
        transferDroid,
        placeModule
    };
}
