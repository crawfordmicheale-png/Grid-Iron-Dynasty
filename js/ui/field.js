// The field: a top-down canvas render of the current situation, and the play
// art for whatever is being called.

import { ROUTES } from '../data/routes.js';
import { FORMATIONS, formationSlots } from '../data/formations.js';

const FIELD_W = 1000;   // internal drawing units
const FIELD_H = 460;
const SIDE = 34;        // margin for the end zones is handled separately
const ENDZONE = 78;
const PLAY_W = FIELD_W - ENDZONE * 2;

export class FieldRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const width = this.canvas.clientWidth || FIELD_W;
    const height = width * (FIELD_H / FIELD_W);
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.canvas.style.height = `${height}px`;
    this.scale = (width * dpr) / FIELD_W;
    this.ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    if (this.last) this.draw(this.last);
  }

  /** absolute 0-100 (offense's own goal to opponent's) -> canvas x */
  xFor(absolute, leftToRight = true) {
    const t = leftToRight ? absolute / 100 : 1 - absolute / 100;
    return ENDZONE + t * PLAY_W;
  }

  draw(state) {
    this.last = state;
    const { ctx } = this;
    const {
      absolute = 25, firstDownLine = 35, homeColors = ['#4da3ff', '#fff'],
      awayColors = ['#ef5f6b', '#fff'], leftToRight = true,
      play = null, formationKey = null, offenseAbbr = '', defenseAbbr = '',
      lastResultYards = null,
    } = state;

    ctx.clearRect(0, 0, FIELD_W, FIELD_H);

    // Turf
    ctx.fillStyle = '#173d22';
    ctx.fillRect(0, 0, FIELD_W, FIELD_H);
    // Mowing stripes every five yards
    for (let i = 0; i < 20; i += 1) {
      if (i % 2 === 0) continue;
      ctx.fillStyle = 'rgba(255,255,255,.022)';
      ctx.fillRect(ENDZONE + (i / 20) * PLAY_W, 0, PLAY_W / 20, FIELD_H);
    }

    // End zones
    const drawEndzone = (x, colors, label) => {
      ctx.fillStyle = colors[0];
      ctx.globalAlpha = 0.55;
      ctx.fillRect(x, 0, ENDZONE, FIELD_H);
      ctx.globalAlpha = 1;
      ctx.save();
      ctx.translate(x + ENDZONE / 2, FIELD_H / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = 'rgba(255,255,255,.82)';
      ctx.font = '700 26px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, 0, 0);
      ctx.restore();
    };
    // The offense drives toward the defense's end zone, so the far one carries
    // the defense's mark and the near one the offense's.
    drawEndzone(leftToRight ? 0 : FIELD_W - ENDZONE, homeColors, offenseAbbr || 'END');
    drawEndzone(leftToRight ? FIELD_W - ENDZONE : 0, awayColors, defenseAbbr || 'END');

    // Yard lines
    ctx.strokeStyle = 'rgba(226,240,229,.34)';
    ctx.lineWidth = 1.4;
    for (let y = 0; y <= 100; y += 5) {
      const x = this.xFor(y, leftToRight);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, FIELD_H);
      ctx.stroke();
    }
    // Numbers every ten
    ctx.fillStyle = 'rgba(226,240,229,.5)';
    ctx.font = '700 17px ui-monospace, monospace';
    ctx.textAlign = 'center';
    for (let y = 10; y <= 90; y += 10) {
      const x = this.xFor(y, leftToRight);
      const label = y <= 50 ? y : 100 - y;
      ctx.fillText(String(label), x, 30);
      ctx.fillText(String(label), x, FIELD_H - 16);
    }
    // Hash marks
    ctx.strokeStyle = 'rgba(226,240,229,.26)';
    for (let y = 1; y < 100; y += 1) {
      const x = this.xFor(y, leftToRight);
      for (const hy of [FIELD_H * 0.37, FIELD_H * 0.63]) {
        ctx.beginPath();
        ctx.moveTo(x, hy - 5);
        ctx.lineTo(x, hy + 5);
        ctx.stroke();
      }
    }

    // Line of scrimmage and the line to gain
    const losX = this.xFor(absolute, leftToRight);
    ctx.strokeStyle = '#3fa9f5';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(losX, 0);
    ctx.lineTo(losX, FIELD_H);
    ctx.stroke();

    if (firstDownLine < 100) {
      const fdX = this.xFor(firstDownLine, leftToRight);
      ctx.strokeStyle = '#f6d743';
      ctx.lineWidth = 3;
      ctx.setLineDash([9, 7]);
      ctx.beginPath();
      ctx.moveTo(fdX, 0);
      ctx.lineTo(fdX, FIELD_H);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (play) this.drawPlay(play, absolute, leftToRight, homeColors);
    if (lastResultYards !== null && lastResultYards !== undefined) {
      this.drawResult(absolute, lastResultYards, leftToRight);
    }
  }

  /** Route art for the called play, drawn off the line of scrimmage. */
  drawPlay(play, absolute, leftToRight, colors) {
    const { ctx } = this;
    const formation = FORMATIONS[play.formation];
    if (!formation) return;
    const losX = this.xFor(absolute, leftToRight);
    const dir = leftToRight ? 1 : -1;
    const yardPx = PLAY_W / 100;
    const midY = FIELD_H / 2;
    // Receivers line up across the width of the field; 1 yard of width ~ this.
    const widthPx = FIELD_H / 53.3;

    const slots = formationSlots(formation);

    // Offensive line
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    for (let i = -2; i <= 2; i += 1) {
      ctx.beginPath();
      ctx.arc(losX - dir * 5, midY + i * 13, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Quarterback
    const shotgun = formation.shotgun;
    ctx.fillStyle = colors[0];
    ctx.strokeStyle = 'rgba(255,255,255,.9)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(losX - dir * (shotgun ? 44 : 16), midY, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    for (const slot of slots) {
      const align = formation.slots[slot];
      const sideSign = align.side === 'L' ? -1 : align.side === 'R' ? 1 : 0;
      const y = midY + sideSign * align.width * widthPx;
      const x = losX - dir * (align.los ? 3 : 8 + align.depth * yardPx);

      // The player
      ctx.fillStyle = colors[0];
      ctx.strokeStyle = 'rgba(255,255,255,.85)';
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      if (play.type !== 'pass') continue;
      const routeKey = play.routes?.[slot];
      const route = ROUTES[routeKey];
      if (!route || route.blocker) continue;

      // The route stem and break.
      ctx.strokeStyle = play.progression?.[0] === slot ? '#f6d743' : 'rgba(255,255,255,.72)';
      ctx.lineWidth = play.progression?.[0] === slot ? 2.6 : 1.8;
      ctx.beginPath();
      ctx.moveTo(x, y);
      const depthPx = Math.max(6, route.depth * yardPx);
      const stemX = x + dir * depthPx;
      ctx.lineTo(stemX, y);

      let endX = stemX;
      let endY = y;
      const lateral = 42;
      switch (route.type) {
        case 'in':    endY = y + (sideSign >= 0 ? -lateral : lateral); endX = stemX + dir * 14; break;
        case 'out':   endY = y + (sideSign >= 0 ? lateral : -lateral); endX = stemX + dir * 14; break;
        case 'up':    endX = stemX + dir * 34; break;
        case 'back':  endX = stemX - dir * 16; break;
        case 'across': endY = y + (sideSign >= 0 ? -lateral * 1.7 : lateral * 1.7); endX = stemX + dir * 22; break;
        case 'screen': endX = x - dir * 14; endY = y + (sideSign >= 0 ? 14 : -14); break;
        case 'sit':   endX = stemX + dir * 3; break;
        default: endX = stemX + dir * 10;
      }
      ctx.lineTo(endX, endY);
      ctx.stroke();

      // Arrow head
      const ang = Math.atan2(endY - y, endX - stemX || dir);
      ctx.beginPath();
      ctx.moveTo(endX, endY);
      ctx.lineTo(endX - Math.cos(ang - 0.5) * 9, endY - Math.sin(ang - 0.5) * 9);
      ctx.lineTo(endX - Math.cos(ang + 0.5) * 9, endY - Math.sin(ang + 0.5) * 9);
      ctx.closePath();
      ctx.fillStyle = ctx.strokeStyle;
      ctx.fill();
    }
  }

  drawResult(absolute, yards, leftToRight) {
    const { ctx } = this;
    const from = this.xFor(absolute, leftToRight);
    const to = this.xFor(Math.max(0, Math.min(100, absolute + yards)), leftToRight);
    ctx.strokeStyle = yards >= 0 ? 'rgba(70,209,138,.9)' : 'rgba(239,95,107,.9)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(from, FIELD_H - 34);
    ctx.lineTo(to, FIELD_H - 34);
    ctx.stroke();
    ctx.fillStyle = ctx.strokeStyle;
    ctx.beginPath();
    ctx.arc(to, FIELD_H - 34, 6, 0, Math.PI * 2);
    ctx.fill();
  }
}
