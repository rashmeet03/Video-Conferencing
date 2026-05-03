import React, { useEffect, useRef, useState } from 'react';

export default function Whiteboard({ roomId, socket }) {
  const canvasRef = useRef();
  const [drawing, setDrawing] = useState(false);
  const [ctx, setCtx] = useState(null);
  const [color, setColor] = useState('#ffffff');
  const [lineWidth, setLineWidth] = useState(2);
  const lastPosRef = useRef(null);
  const remotePathsRef = useRef(new Map()); // track remote user paths

  useEffect(() => {
    if (canvasRef.current && !ctx) {
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      context.lineCap = 'round';
      context.lineJoin = 'round';
      setCtx(context);
    }
  }, [canvasRef, ctx]);

  useEffect(() => {
    if (!socket || !ctx) return;
    
    socket.on('whiteboard-draw', (data) => drawRemote(data));
    socket.on('whiteboard-clear', () => {
      if (ctx && canvasRef.current) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        remotePathsRef.current.clear();
      }
    });
    
    return () => {
      socket.off('whiteboard-draw');
      socket.off('whiteboard-clear');
    };
  }, [socket, ctx]);

  function getScaledPos(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  }

  function start(e) {
    if (!ctx) return;
    setDrawing(true);
    const pos = getScaledPos(e);
    lastPosRef.current = pos;
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    
    // emit start event
    socket.emit('whiteboard-draw', {
      roomId,
      type: 'start',
      x: pos.x,
      y: pos.y,
      color,
      lineWidth
    });
  }

  function move(e) {
    if (!drawing || !ctx) return;
    const pos = getScaledPos(e);
    
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    
    // emit draw event
    socket.emit('whiteboard-draw', {
      roomId,
      type: 'draw',
      x: pos.x,
      y: pos.y
    });
    
    lastPosRef.current = pos;
  }

  function end() {
    if (drawing) {
      setDrawing(false);
      lastPosRef.current = null;
      // emit end event
      socket.emit('whiteboard-draw', {
        roomId,
        type: 'end'
      });
    }
  }

  function drawRemote(data) {
    if (!ctx) return;
    const { type, x, y, color: remoteColor, lineWidth: remoteWidth, from } = data;
    
    if (type === 'start') {
      ctx.strokeStyle = remoteColor || '#00ff00';
      ctx.lineWidth = remoteWidth || 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      remotePathsRef.current.set(from, { x, y });
    } else if (type === 'draw') {
      const lastPos = remotePathsRef.current.get(from);
      if (lastPos) {
        ctx.lineTo(x, y);
        ctx.stroke();
        remotePathsRef.current.set(from, { x, y });
      }
    } else if (type === 'end') {
      remotePathsRef.current.delete(from);
    }
  }

  function clearCanvas() {
    if (ctx && canvasRef.current) {
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      remotePathsRef.current.clear();
      socket.emit('whiteboard-clear', { roomId });
    }
  }

  const colors = ['#ffffff', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'];

  return (
    <div style={{ border: '1px solid var(--color-border)', borderRadius: 4, background: 'var(--color-surface)' }}>
      <div style={{ padding: 8, display: 'flex', gap: 8, alignItems: 'center', borderBottom: '1px solid var(--color-border)' }}>
        <span style={{ fontSize: 12, color: 'var(--color-text-dim)' }}>Color:</span>
        {colors.map(c => (
          <button
            key={c}
            onClick={() => setColor(c)}
            style={{
              width: 24,
              height: 24,
              background: c,
              border: color === c ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
              borderRadius: 3,
              cursor: 'pointer',
              padding: 0
            }}
            title={c}
          />
        ))}
        <span style={{ fontSize: 12, color: 'var(--color-text-dim)', marginLeft: 8 }}>Size:</span>
        <input
          type="range"
          min="1"
          max="10"
          value={lineWidth}
          onChange={(e) => setLineWidth(Number(e.target.value))}
          style={{ width: 80 }}
        />
        <span style={{ fontSize: 12, color: 'var(--color-text-dim)' }}>{lineWidth}px</span>
        <button onClick={clearCanvas} style={{ marginLeft: 'auto' }}>Clear</button>
      </div>
      <canvas
        ref={canvasRef}
        width={800}
        height={400}
        style={{ cursor: 'crosshair', width: '100%', display: 'block', background: '#1a1a1a' }}
        onMouseDown={start}
        onMouseMove={move}
        onMouseUp={end}
        onMouseLeave={end}
      />
    </div>
  );
}
