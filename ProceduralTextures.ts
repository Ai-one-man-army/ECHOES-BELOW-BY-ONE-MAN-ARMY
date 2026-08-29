import * as THREE from 'three';

/**
 * Procedural texture & normal map generator for dark underground research facility.
 * Generates textures at runtime on HTML5 Canvas to keep the application lightweight,
 * fast-loading, and completely self-contained.
 */

export class TextureGenerator {
  private static cache = new Map<string, THREE.CanvasTexture>();

  /**
   * Gritty, stained concrete floor/wall texture with expansion seams and grunge
   */
  public static createConcreteTexture(color: string = '#2d3136', darkColor: string = '#181b1e'): THREE.CanvasTexture {
    const key = `concrete_${color}_${darkColor}`;
    if (this.cache.has(key)) return this.cache.get(key)!;

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Base tone
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 512, 512);

    // Fine aggregate noise
    const imgData = ctx.getImageData(0, 0, 512, 512);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const noise = (Math.random() - 0.5) * 28;
      data[i] = Math.min(255, Math.max(0, data[i] + noise));
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
    }
    ctx.putImageData(imgData, 0, 0);

    // Stains and water drips
    for (let s = 0; s < 10; s++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const radius = 25 + Math.random() * 70;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
      grad.addColorStop(0, darkColor + 'aa');
      grad.addColorStop(0.6, darkColor + '44');
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Concrete slab tile grid
    ctx.strokeStyle = '#121416';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, 512, 512);
    ctx.beginPath();
    ctx.moveTo(256, 0);
    ctx.lineTo(256, 512);
    ctx.moveTo(0, 256);
    ctx.lineTo(512, 256);
    ctx.stroke();

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = 4;
    this.cache.set(key, texture);
    return texture;
  }

  /**
   * Procedural bump map for concrete surface micro-relief
   */
  public static createConcreteBumpMap(): THREE.CanvasTexture {
    const key = 'concrete_bump';
    if (this.cache.has(key)) return this.cache.get(key)!;

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    // Mid-gray baseline (128, 128, 128)
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, 256, 256);

    const imgData = ctx.getImageData(0, 0, 256, 256);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const n = (Math.random() - 0.5) * 45;
      const val = Math.min(255, Math.max(0, 128 + n));
      data[i] = val;
      data[i + 1] = val;
      data[i + 2] = val;
    }
    ctx.putImageData(imgData, 0, 0);

    // Expansion joint recess (darker = recessed)
    ctx.strokeStyle = '#202020';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(128, 0);
    ctx.lineTo(128, 256);
    ctx.moveTo(0, 128);
    ctx.lineTo(256, 128);
    ctx.stroke();

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = 4;
    this.cache.set(key, texture);
    return texture;
  }

  /**
   * Industrial metal panel texture with rivets and seams
   */
  public static createMetalPanelTexture(): THREE.CanvasTexture {
    const key = 'metal_panel';
    if (this.cache.has(key)) return this.cache.get(key)!;

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Dark steel base
    ctx.fillStyle = '#22262a';
    ctx.fillRect(0, 0, 512, 512);

    // Brushed metal streaks
    for (let i = 0; i < 350; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? '#32373c' : '#191b1e';
      ctx.fillRect(0, Math.random() * 512, 512, 1 + Math.random() * 2);
    }

    // Panel divisions & beveled border
    ctx.strokeStyle = '#101214';
    ctx.lineWidth = 6;
    ctx.strokeRect(0, 0, 512, 512);

    ctx.strokeStyle = '#2d3339';
    ctx.lineWidth = 2;
    ctx.strokeRect(12, 12, 488, 488);

    // Rivets along edges
    const drawRivet = (x: number, y: number) => {
      ctx.fillStyle = '#4c5258';
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#121416';
      ctx.beginPath();
      ctx.arc(x + 1, y + 1, 2, 0, Math.PI * 2);
      ctx.fill();
    };

    for (let x = 30; x <= 482; x += 38) {
      drawRivet(x, 24);
      drawRivet(x, 488);
    }
    for (let y = 30; y <= 482; y += 38) {
      drawRivet(24, y);
      drawRivet(488, y);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = 4;
    this.cache.set(key, texture);
    return texture;
  }

  /**
   * Procedural bump map for metal panel rivets and seams
   */
  public static createMetalBumpMap(): THREE.CanvasTexture {
    const key = 'metal_bump';
    if (this.cache.has(key)) return this.cache.get(key)!;

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, 256, 256);

    // Inset border seam
    ctx.strokeStyle = '#303030';
    ctx.lineWidth = 3;
    ctx.strokeRect(6, 6, 244, 244);

    // Raised rivets (bright = protruding)
    const drawRaisedRivet = (x: number, y: number) => {
      const grad = ctx.createRadialGradient(x - 1, y - 1, 0, x, y, 3);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.7, '#a0a0a0');
      grad.addColorStop(1, '#606060');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    };

    for (let x = 15; x <= 241; x += 19) {
      drawRaisedRivet(x, 12);
      drawRaisedRivet(x, 244);
    }
    for (let y = 15; y <= 241; y += 19) {
      drawRaisedRivet(12, y);
      drawRaisedRivet(244, y);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = 4;
    this.cache.set(key, texture);
    return texture;
  }

  /**
   * Yellow and black hazard safety stripes
   */
  public static createHazardStripeTexture(): THREE.CanvasTexture {
    const key = 'hazard_stripe';
    if (this.cache.has(key)) return this.cache.get(key)!;

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#c89211'; // Dark weathered safety yellow
    ctx.fillRect(0, 0, 256, 256);

    ctx.fillStyle = '#141414'; // Charcoal black
    const stripeWidth = 32;
    for (let x = -256; x < 512; x += stripeWidth * 2) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + stripeWidth, 0);
      ctx.lineTo(x + stripeWidth + 256, 256);
      ctx.lineTo(x + 256, 256);
      ctx.closePath();
      ctx.fill();
    }

    // Weathering/scratches
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    for (let i = 0; i < 25; i++) {
      ctx.fillRect(Math.random() * 256, Math.random() * 256, 40, 2);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = 4;
    this.cache.set(key, texture);
    return texture;
  }

  /**
   * Sector 9 Heavy Blast Door Sign Texture
   */
  public static createSector9DoorTexture(): THREE.CanvasTexture {
    const key = 'sector9_door_sign';
    if (this.cache.has(key)) return this.cache.get(key)!;

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Heavy reinforced dark steel
    ctx.fillStyle = '#1a1d20';
    ctx.fillRect(0, 0, 512, 512);

    // Inner beveled blast plate
    ctx.fillStyle = '#26292d';
    ctx.fillRect(24, 24, 464, 464);
    ctx.strokeStyle = '#0f1113';
    ctx.lineWidth = 10;
    ctx.strokeRect(24, 24, 464, 464);

    // Hazard top bar
    ctx.fillStyle = '#9e2a2b';
    ctx.fillRect(40, 40, 432, 60);

    // Warning text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('RESTRICTED ACCESS', 256, 78);

    // Big SECTOR 9 label
    ctx.fillStyle = '#d9d9d9';
    ctx.font = 'bold 56px monospace';
    ctx.fillText('SECTOR 9', 256, 210);

    ctx.fillStyle = '#8a929a';
    ctx.font = 'bold 18px monospace';
    ctx.fillText('BIO-CONTAINMENT & SUB-DEEP ANOMALY', 256, 250);

    // Security warning box
    ctx.strokeStyle = '#c89211';
    ctx.lineWidth = 3;
    ctx.strokeRect(80, 290, 352, 90);
    ctx.fillStyle = '#c89211';
    ctx.font = '14px monospace';
    ctx.fillText('WARNING: SEAL INTEGRITY MONITORED', 256, 325);
    ctx.fillText('AUTHORIZATION KEYCARD LEVEL 4 REQ.', 256, 355);

    // Hydraulic lock vents
    ctx.fillStyle = '#101214';
    for (let y = 410; y <= 460; y += 14) {
      ctx.fillRect(60, y, 392, 6);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = 4;
    this.cache.set(key, texture);
    return texture;
  }

  /**
   * Computer terminal screen with retro phosphor lines
   */
  public static createTerminalTexture(textLines: string[], title: string = 'SYS_TERMINAL'): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // CRT dark green-black background
    ctx.fillStyle = '#06130b';
    ctx.fillRect(0, 0, 512, 512);

    // Scanlines
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    for (let y = 0; y < 512; y += 4) {
      ctx.fillRect(0, y, 512, 2);
    }

    // Terminal header
    ctx.fillStyle = '#1fe86b';
    ctx.font = 'bold 22px monospace';
    ctx.fillText(`[ ${title} ]`, 30, 50);

    ctx.strokeStyle = '#1fe86b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(30, 65);
    ctx.lineTo(482, 65);
    ctx.stroke();

    // Body lines
    ctx.font = '16px monospace';
    let yPos = 110;
    for (const line of textLines) {
      ctx.fillText(line, 30, yPos);
      yPos += 30;
    }

    // Blinking cursor indicator
    ctx.fillStyle = '#1fe86b';
    ctx.fillRect(30, yPos + 10, 14, 20);

    const texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = 4;
    return texture;
  }
}

