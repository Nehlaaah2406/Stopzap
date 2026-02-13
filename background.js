/**
 * React Bits - Inspired Background Animation
 * "Connectivity Grid" / "Particles"
 * A lightweight particle system with connection lines and subtle interactivity.
 */

const canvas = document.getElementById('bg-canvas');
const ctx = canvas.getContext('2d');

let particlesArray;
let mouse = {
    x: null,
    y: null,
    radius: 150
};

// Handle Resize
window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    mouse.radius = (canvas.height / 80) * (canvas.width / 80);
    init();
});

// Handle Mouse Move
window.addEventListener('mousemove', (event) => {
    mouse.x = event.x;
    mouse.y = event.y;
});

// Handle Mouse Out
window.addEventListener('mouseout', () => {
    mouse.x = undefined;
    mouse.y = undefined;
});

// Particle Class
class Particle {
    constructor(x, y, responsiveX, responsiveY, size, color) {
        this.x = x;
        this.y = y;
        this.responsiveX = responsiveX;
        this.responsiveY = responsiveY;
        this.size = size;
        this.color = color;
        this.baseX = this.x;
        this.baseY = this.y;
        this.density = (Math.random() * 30) + 1;
        
        // Velocity for subtle ambient movement
        this.directionX = (Math.random() * 0.4) - 0.2;
        this.directionY = (Math.random() * 0.4) - 0.2;
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2, false);
        ctx.fillStyle = this.color;
        ctx.fill();
    }

    update() {
        // Check mouse position/particle position - collision detection
        let dx = mouse.x - this.x;
        let dy = mouse.y - this.y;
        let distance = Math.sqrt(dx * dx + dy * dy);
        let forceDirectionX = dx / distance;
        let forceDirectionY = dy / distance;
        let maxDistance = mouse.radius;
        let force = (maxDistance - distance) / maxDistance;
        let directionX = forceDirectionX * force * this.density;
        let directionY = forceDirectionY * force * this.density;

        if (distance < mouse.radius) {
            // Repulse
            this.x -= directionX;
            this.y -= directionY;
        } else {
            // Return to base position (Grid effect) or Ambient Float (Particle effect)
            
            // Let's do Ambient Float with minimal return
            // Keep within bounds
            if (this.x + this.size > canvas.width || this.x - this.size < 0) {
                this.directionX = -this.directionX;
            }
            if (this.y + this.size > canvas.height || this.y - this.size < 0) {
                this.directionY = -this.directionY;
            }
            
            this.x += this.directionX;
            this.y += this.directionY;
        }
        
        this.draw();
    }
}

// Initializer
function init() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    particlesArray = [];
    
    // Create particles
    // Density calculation: fewer particles on mobile
    let numberOfParticles = (canvas.height * canvas.width) / 9000;
    
    for (let i = 0; i < numberOfParticles * 1.5; i++) {
        let size = (Math.random() * 2) + 0.5; // Small dots
        let x = (Math.random() * ((innerWidth - size * 2) - (size * 2)) + size * 2);
        let y = (Math.random() * ((innerHeight - size * 2) - (size * 2)) + size * 2);
        let responsiveX = x;
        let responsiveY = y;
        
        // Colors: tech blue/cyan/purple
        // let color = '#6366F1'; 
        let color = Math.random() > 0.5 ? 'rgba(99, 102, 241, 0.6)' : 'rgba(34, 211, 238, 0.6)';
        
        particlesArray.push(new Particle(x, y, responsiveX, responsiveY, size, color));
    }
}

// Animation Loop
function animate() {
    requestAnimationFrame(animate);
    ctx.clearRect(0, 0, innerWidth, innerHeight);

    for (let i = 0; i < particlesArray.length; i++) {
        particlesArray[i].update();
    }
    
    connect();
}

// Connect particles with lines if close enough
function connect() {
    let opacityValue = 1;
    for (let a = 0; a < particlesArray.length; a++) {
        for (let b = a; b < particlesArray.length; b++) {
            let distance = ((particlesArray[a].x - particlesArray[b].x) * (particlesArray[a].x - particlesArray[b].x)) + 
                           ((particlesArray[a].y - particlesArray[b].y) * (particlesArray[a].y - particlesArray[b].y));
            
            // Connection distance (squared)
            if (distance < (canvas.width / 7) * (canvas.height / 7)) {
                opacityValue = 1 - (distance / 20000); // fade out
                if (opacityValue > 0) {
                    ctx.strokeStyle = 'rgba(99, 102, 241,' + (opacityValue * 0.15) + ')'; // faint lines
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(particlesArray[a].x, particlesArray[a].y);
                    ctx.lineTo(particlesArray[b].x, particlesArray[b].y);
                    ctx.stroke();
                }
            }
        }
    }
}

// Start
init();
animate();
