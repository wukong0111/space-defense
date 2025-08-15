// Configuración del juego
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth - 250;
canvas.height = window.innerHeight;

// Estado del juego
let gameState = {
    resources: 10000, // TODO: Cambiar a 0 en producción
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
    placingModule: false,
    connectionMode: false,
    destroyMode: false
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
        this.droids = type === 'production' ? 1 : 0; // Módulo inicial tiene 1 droide
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
            return [
                { modules: 3, droids: 10 },
                { modules: 7, droids: 22 },
                { modules: 12, droids: 35 }
            ][this.level - 1];
        }
        
        const baseCapacity = {
            recruitment: 1, // droides per 10 seconds
            production: 5, // resources per second
            defense: 1 // attacks per round (cada 2 segundos)
        };
        
        const multiplier = 1 + (this.level - 1) * 0.5; // +50% per level
        return baseCapacity[this.type] * this.droids * multiplier;
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
        
        // Verificar si hay espacio disponible en algún módulo conectado
        let totalCurrentDroids = 0;
        let totalMaxCapacity = 0;
        
        for (let module of gameState.modules) {
            if (module.type !== 'energy' && module.isConnected) {
                totalCurrentDroids += module.droids;
                totalMaxCapacity += module.maxDroids;
            }
        }
        
        // Solo producir si hay espacio disponible
        return totalCurrentDroids < totalMaxCapacity;
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
            // Solo producir droides si hay espacio disponible en módulos conectados
            if (now - this.lastRecruitment >= 10000 && this.canProduceDroids()) {
                gameState.totalDroids += this.getCapacity();
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
    
    updateConnections();
}

// Redistribuir droides no asignados automáticamente
function redistributeUnassignedDroids() {
    // Calcular droides asignados
    let assignedDroids = 0;
    gameState.modules.forEach(module => {
        if (module.type !== 'energy') {
            assignedDroids += module.droids;
        }
    });
    
    let unassignedDroids = gameState.totalDroids - assignedDroids;
    
    if (unassignedDroids <= 0) return; // No hay droides sin asignar
    
    // Encontrar módulos conectados que puedan recibir droides
    let availableModules = gameState.modules.filter(module => 
        module.type !== 'energy' && 
        module.isConnected && 
        module.droids < module.maxDroids
    );
    
    // Distribuir SOLO droides no asignados, priorizando módulos con menos droides
    while (unassignedDroids > 0 && availableModules.length > 0) {
        // Ordenar por número de droides (ascendente)
        availableModules.sort((a, b) => a.droids - b.droids);
        
        // Asignar al módulo con menos droides
        let targetModule = availableModules[0];
        targetModule.droids++;
        unassignedDroids--;
        
        // Si el módulo se llenó, quitarlo de la lista
        if (targetModule.droids >= targetModule.maxDroids) {
            availableModules = availableModules.filter(m => m !== targetModule);
        }
    }
}

function updateConnections() {
    // Resetear conexiones
    gameState.modules.forEach(module => module.isConnected = false);
    
    // Encontrar componentes conectados usando DFS
    const visited = new Set();
    
    function dfs(moduleId, energyModules) {
        if (visited.has(moduleId)) return;
        visited.add(moduleId);
        
        const module = gameState.modules[moduleId];
        if (module.type === 'energy') {
            energyModules.push(module);
        }
        
        // Buscar conexiones
        for (let conn of gameState.connections) {
            if (conn.from === moduleId && !visited.has(conn.to)) {
                dfs(conn.to, energyModules);
            } else if (conn.to === moduleId && !visited.has(conn.from)) {
                dfs(conn.from, energyModules);
            }
        }
    }
    
    // Para cada componente conectado
    const processedModules = new Set();
    
    for (let i = 0; i < gameState.modules.length; i++) {
        if (processedModules.has(i)) continue;
        
        const componentEnergyModules = [];
        const componentModules = [];
        
        // Encontrar todos los módulos en este componente
        const componentVisited = new Set();
        function findComponent(moduleId) {
            if (componentVisited.has(moduleId)) return;
            componentVisited.add(moduleId);
            componentModules.push(gameState.modules[moduleId]);
            
            for (let conn of gameState.connections) {
                if (conn.from === moduleId && !componentVisited.has(conn.to)) {
                    findComponent(conn.to);
                } else if (conn.to === moduleId && !componentVisited.has(conn.from)) {
                    findComponent(conn.from);
                }
            }
        }
        
        findComponent(i);
        
        // Encontrar módulos de energía en este componente
        componentEnergyModules.push(...componentModules.filter(m => m.type === 'energy'));
        
        // Calcular capacidad total de energía
        let totalModuleCapacity = 0;
        let totalDroidCapacity = 0;
        
        for (let energyModule of componentEnergyModules) {
            const capacity = energyModule.getCapacity();
            totalModuleCapacity += capacity.modules;
            totalDroidCapacity += capacity.droids;
        }
        
        // Contar módulos no-energía y droides
        const nonEnergyModules = componentModules.filter(m => m.type !== 'energy');
        const totalDroids = nonEnergyModules.reduce((sum, m) => sum + m.droids, 0);
        
        // Verificar si hay suficiente energía
        if (nonEnergyModules.length <= totalModuleCapacity && totalDroids <= totalDroidCapacity) {
            // Marcar todos los módulos como conectados
            componentModules.forEach(module => module.isConnected = true);
        }
        
        // Redistribuir droides equitativamente
        if (componentEnergyModules.length > 0 && totalDroids <= totalDroidCapacity) {
            let availableDroids = Math.min(gameState.totalDroids, totalDroidCapacity);
            
            // Resetear droides en este componente
            nonEnergyModules.forEach(module => module.droids = 0);
            
            // Distribuir equitativamente
            let moduleIndex = 0;
            while (availableDroids > 0 && nonEnergyModules.length > 0) {
                const module = nonEnergyModules[moduleIndex];
                if (module.droids < module.maxDroids) {
                    module.droids++;
                    availableDroids--;
                }
                moduleIndex = (moduleIndex + 1) % nonEnergyModules.length;
                
                // Evitar bucle infinito
                if (nonEnergyModules.every(m => m.droids >= m.maxDroids)) break;
            }
        }
        
        componentModules.forEach(module => processedModules.add(gameState.modules.indexOf(module)));
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
    
    // Devolver droides al pool
    if (module.type !== 'energy') {
        gameState.totalDroids += module.droids;
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

// Eventos del canvas
let lastClickTime = 0;
let lastClickedModule = null;

canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
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
            transferDroid(clickedModule);
            lastClickTime = 0;
            lastClickedModule = null;
        } else {
            lastClickTime = currentTime;
            lastClickedModule = clickedModule;
        }
    } else {
        // Click en área vacía - cancelar modos activos
        if (gameState.connectionMode || gameState.destroyMode) {
            gameState.connectionMode = false;
            gameState.destroyMode = false;
            canvas.style.cursor = 'default';
        }
        lastClickTime = 0;
        lastClickedModule = null;
    }
});

canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
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
    
    // Verificar límites del canvas
    if (x < 20 || x > canvas.width - 20 || y < 20 || y > canvas.height - 20) return;
    
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
    canvas.style.cursor = 'default';
}

function transferDroid(targetModule) {
    if (targetModule.type === 'energy' || targetModule.droids >= targetModule.maxDroids) return;
    if (!targetModule.isConnected) return;
    
    // Calcular droides asignados y no asignados
    let assignedDroids = 0;
    gameState.modules.forEach(module => {
        if (module.type !== 'energy') {
            assignedDroids += module.droids;
        }
    });
    
    let unassignedDroids = gameState.totalDroids - assignedDroids;
    
    // Si hay droides no asignados, usar uno de esos primero
    if (unassignedDroids > 0) {
        targetModule.droids++;
        return;
    }
    
    // Si no hay droides no asignados, buscar módulo más cercano con droides disponibles
    let sourceModule = null;
    let closestDistance = Infinity;
    
    for (let module of gameState.modules) {
        if (module === targetModule || module.type === 'energy' || module.droids === 0) continue;
        if (!module.isConnected) continue;
        
        const distance = Math.sqrt(
            Math.pow(targetModule.x - module.x, 2) + 
            Math.pow(targetModule.y - module.y, 2)
        );
        
        if (distance < closestDistance) {
            closestDistance = distance;
            sourceModule = module;
        }
    }
    
    if (sourceModule) {
        sourceModule.droids--;
        targetModule.droids++;
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
    
    // Calcular energía disponible
    let totalEnergyCapacity = 0;
    let usedModules = 0;
    let usedDroids = 0;
    
    for (let module of gameState.modules) {
        if (module.type === 'energy' && module.isConnected) {
            const capacity = module.getCapacity();
            totalEnergyCapacity += capacity.droids;
        } else if (module.type !== 'energy' && module.isConnected) {
            usedModules++; // Solo contar módulos conectados no-energía
            usedDroids += module.droids;
        }
    }
    
    document.getElementById('energy').textContent = `${usedDroids}/${totalEnergyCapacity}`;
    document.getElementById('wave').textContent = gameState.waveNumber;
    
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
    
    // Actualizar botones de construcción
    const buttons = document.querySelectorAll('.module-button');
    const types = ['energy', 'recruitment', 'production', 'defense'];
    
    // Solo actualizar los primeros 4 botones (los de construcción)
    for (let index = 0; index < Math.min(4, buttons.length); index++) {
        const button = buttons[index];
        const type = types[index];
        
        if (type && moduleTypes[type]) {
            const cost = moduleTypes[type].cost;
            const connectionCost = gameState.modules.length > 0 ? 50 : 0;
            const totalCost = cost + connectionCost;
            
            button.disabled = gameState.resources < totalCost;
            
            // Actualizar texto del botón para mostrar costo total
            const costText = connectionCost > 0 ? `${cost}+${connectionCost}` : cost.toString();
            const colorText = button.textContent.includes(' - ') ? 
                button.textContent.split(' - ')[1] : 
                (type === 'energy' ? 'Amarillo' : 
                 type === 'recruitment' ? 'Verde' : 
                 type === 'production' ? 'Azul' : 'Rojo');
            
            button.textContent = `${moduleTypes[type].name} (${costText}) - ${colorText}`;
        }
    }
    
    // Actualizar botón de conexión (índice 4)
    if (buttons.length > 4) {
        const connectionButton = buttons[4];
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

// Remover módulos destruidos
function removeDestroyedModules() {
    const destroyedModules = [];
    
    gameState.modules.forEach((module, index) => {
        if (module.health <= 0) {
            destroyedModules.push(index);
            // Devolver droides al pool
            gameState.totalDroids += module.droids;
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
    
    // Dibujar estrellas
    drawStars();
    
    // Dibujar conexiones
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    for (let conn of gameState.connections) {
        const moduleA = gameState.modules[conn.from];
        const moduleB = gameState.modules[conn.to];
        
        if (moduleA && moduleB) {
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
    
    // Dibujar preview del módulo a colocar
    if (gameState.placingModule && gameState.selectedModuleType) {
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = moduleTypes[gameState.selectedModuleType].color;
        ctx.beginPath();
        ctx.arc(mouseX, mouseY, 20, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }
}

// Variables para seguimiento del mouse
let mouseX = 0;
let mouseY = 0;

// Bucle principal del juego
let lastTime = 0;
let lastRedistribution = 0;
function gameLoop(currentTime) {
    if (!gameState.gameRunning) return;
    
    const deltaTime = currentTime - lastTime;
    lastTime = currentTime;
    
    gameState.gameTime += deltaTime;
    
    // Redistribuir droides no asignados cada 2 segundos
    if (currentTime - lastRedistribution >= 2000) {
        redistributeUnassignedDroids();
        lastRedistribution = currentTime;
    }
    
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

// Eventos de teclado para cancelar modos
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        gameState.selectedModuleType = null;
        gameState.placingModule = false;
        gameState.connectionMode = false;
        gameState.destroyMode = false;
        canvas.style.cursor = 'default';
    }
});

// Redimensionar canvas
window.addEventListener('resize', () => {
    canvas.width = window.innerWidth - 250;
    canvas.height = window.innerHeight;
});

// Inicializar y comenzar el juego
initGame();
updateConnections();
requestAnimationFrame(gameLoop);