import { TOUCH_MIN_TARGET } from '../../shared/Constants.js';
import uiSprites from './UISprites.js';

export default class TouchControls {
  constructor(renderer, touchInput) {
    this.renderer = renderer;
    this.touchInput = touchInput;
    this.visible = false;
    this.suppressed = false;
    this.utilityOpen = false;

    this.buttons = [
      { id: 'action',    label: 'A', color: '#e74c3c' },
      { id: 'interact',  label: 'E', color: '#3498db' },
      { id: 'cancel',    label: 'B', color: '#95a5a6' },
      { id: 'dash',      label: 'D', color: '#3498db' },
    ];

    // Secondary screens live behind one thumb-friendly radial hub.
    this.utilityButtons = [
      { id: 'inventory', label: 'I', color: '#f39c12' },
      { id: 'questLog',  label: 'Q', color: '#2ecc71' },
      { id: 'skills',    label: 'K', color: '#9b59b6' },
      { id: 'map',        label: 'M', color: '#1abc9c' },
      { id: 'petTeam',    label: 'P', color: '#e67e22' },
      { id: 'horseAction',label: 'Z', color: '#8e44ad' },
    ];

    this.radialCenter = { x: 0, y: 0, r: 0 };
    this.utilityCenter = { x: 0, y: 0, r: 0 };
    this.touchInput.setButtonZoneHandler((id) => this._handleZonePress(id));
  }

  show() { this.visible = true; this.updateButtonZones(); }
  hide() { this.visible = false; this.touchInput.setButtonZones([]); }

  setSuppressed(suppressed) {
    if (this.suppressed === suppressed) return;
    this.suppressed = suppressed;
    if (suppressed) this.utilityOpen = false;
    this.updateButtonZones();
  }

  _handleZonePress(id) {
    if (id === 'touchMenu') {
      this.utilityOpen = !this.utilityOpen;
      this.updateButtonZones();
    } else if (this.utilityButtons.some(button => button.id === id)) {
      this.utilityOpen = false;
      this.updateButtonZones();
    }
  }

  updateButtonZones() {
    if (!this.visible || this.suppressed) {
      this.buttonZones = [];
      this.touchInput.setButtonZones([]);
      return;
    }

    const w = this.renderer.width;
    const h = this.renderer.height;
    const portrait = h > w;
    const safeBottom = 18;
    const actionRadius = Math.max(TOUCH_MIN_TARGET / 2, portrait ? 24 : 22);
    const radialR = portrait ? 54 : 50;
    const cx = w - (portrait ? 92 : 88);
    const cy = h - safeBottom - (portrait ? 126 : 82);
    const zones = [];

    // Three frequent actions orbit Cancel. Equal 120° spacing guarantees
    // non-overlapping 48px targets even on a 320px portrait viewport.
    const primaryLayout = [
      { id: 'action', angle: 0 },
      { id: 'interact', angle: -Math.PI * 2 / 3 },
      { id: 'dash', angle: Math.PI * 2 / 3 },
    ];
    for (const item of primaryLayout) {
      zones.push({
        id: item.id,
        x: cx + radialR * Math.cos(item.angle),
        y: cy + radialR * Math.sin(item.angle),
        radius: actionRadius,
      });
    }
    zones.push({ id: 'cancel', x: cx, y: cy, radius: actionRadius });

    this.radialCenter = { x: cx, y: cy, r: radialR };

    // Collapsed utility radial replaces the five-button top toolbar.
    const utilityRadius = Math.max(TOUCH_MIN_TARGET / 2, 22);
    const utilityRing = 58;
    const utilityCx = w - 86;
    const utilityCy = portrait ? 152 : 76;
    zones.push({ id: 'touchMenu', x: utilityCx, y: utilityCy, radius: utilityRadius });
    if (this.utilityOpen) {
      for (let i = 0; i < this.utilityButtons.length; i++) {
        const angle = -Math.PI / 2 + i * (Math.PI * 2 / this.utilityButtons.length);
        zones.push({
          id: this.utilityButtons[i].id,
          x: utilityCx + utilityRing * Math.cos(angle),
          y: utilityCy + utilityRing * Math.sin(angle),
          radius: TOUCH_MIN_TARGET / 2,
        });
      }
    }
    this.utilityCenter = { x: utilityCx, y: utilityCy, r: utilityRing };

    this.buttonZones = zones;
    this.touchInput.setButtonZones(zones);
  }

  _drawButton(ctx, zone, btn, pressed, s) {
    const bx = zone.x / s;
    const by = zone.y / s;
    const br = zone.radius / s;

    // Background circle
    ctx.globalAlpha = pressed ? 0.75 : 0.35;
    ctx.fillStyle = btn.color;
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fill();

    // Border ring
    ctx.globalAlpha = pressed ? 0.9 : 0.2;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5 / s;
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.stroke();

    // Icon or text fallback
    const icon = uiSprites.get(zone.id);
    if (icon) {
      ctx.globalAlpha = pressed ? 1.0 : 0.75;
      const iconSize = (zone.radius * 1.4) / s;
      ctx.drawImage(icon, bx - iconSize / 2, by - iconSize / 2, iconSize, iconSize);
    } else {
      ctx.globalAlpha = pressed ? 1.0 : 0.6;
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${14 / s}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(btn.label, bx, by);
    }
  }

  render(ctx) {
    if (!this.visible || this.suppressed) return;

    const s = this.renderer.uiScale;

    // Draw left stick area
    const ls = this.touchInput.leftStick;
    if (ls.active) {
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(ls.originX / s, ls.originY / s, 50 / s, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc((ls.originX + ls.x * 40) / s, (ls.originY + ls.y * 40) / s, 20 / s, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw right stick area
    const rs = this.touchInput.rightStick;
    if (rs.active) {
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(rs.originX / s, rs.originY / s, 50 / s, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc((rs.originX + rs.x * 40) / s, (rs.originY + rs.y * 40) / s, 20 / s, 0, Math.PI * 2);
      ctx.fill();
    }

    // Radial hub connecting ring (subtle visual grouping)
    const rc = this.radialCenter;
    ctx.globalAlpha = 0.08;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2 / s;
    ctx.beginPath();
    ctx.arc(rc.x / s, rc.y / s, rc.r / s, 0, Math.PI * 2);
    ctx.stroke();

    // Draw action buttons (radial layout)
    for (const btn of this.buttons) {
      const zone = this.buttonZones.find(item => item.id === btn.id);
      if (!zone) continue;
      const pressed = this.touchInput.isButtonDown(zone.id);
      this._drawButton(ctx, zone, btn, pressed, s);
    }

    // Utility hub and its expanded radial choices.
    if (this.utilityOpen) {
      const uc = this.utilityCenter;
      ctx.globalAlpha = 0.12;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2 / s;
      ctx.beginPath();
      ctx.arc(uc.x / s, uc.y / s, uc.r / s, 0, Math.PI * 2);
      ctx.stroke();
    }
    const menuZone = this.buttonZones.find(item => item.id === 'touchMenu');
    this._drawButton(ctx, menuZone, {
      id: 'touchMenu', label: this.utilityOpen ? '×' : '☰', color: '#34495e',
    }, this.touchInput.isButtonDown('touchMenu'), s);

    for (const btn of this.utilityButtons) {
      const zone = this.buttonZones.find(item => item.id === btn.id);
      if (!zone) continue;
      const pressed = this.touchInput.isButtonDown(zone.id);
      this._drawButton(ctx, zone, btn, pressed, s);
    }

    ctx.globalAlpha = 1.0;
  }
}
