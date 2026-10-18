import { useEffect, useRef, useState } from 'react';
import { Button, Field } from './Primitives';
export function AvatarPicker({
  current,
  onChange,
  onPending,
}: {
  current?: string;
  onChange: (photo: Blob | null | undefined) => void;
  onPending: (pending: boolean) => void;
}) {
  const [source, setSource] = useState(current || ''),
    [position, setPosition] = useState({ x: 50, y: 50 }),
    [zoom, setZoom] = useState(1),
    [error, setError] = useState('');
  const objectUrl = useRef(''),
    preview = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let disposed = false;
    setReady(false);
    if (!source) return;
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.src = source;
    void image
      .decode()
      .then(() => {
        if (disposed || !preview.current) return;
        const side = Math.min(image.naturalWidth, image.naturalHeight) / zoom;
        const x = ((image.naturalWidth - side) * position.x) / 100,
          y = ((image.naturalHeight - side) * position.y) / 100;
        preview.current.getContext('2d')!.drawImage(image, x, y, side, side, 0, 0, 256, 256);
        setReady(true);
      })
      .catch(() => {
        if (!disposed) setError('Não foi possível ler esta foto.');
      });
    return () => {
      disposed = true;
    };
  }, [source, zoom, position]);
  useEffect(
    () => () => {
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    },
    [],
  );
  const crop = async () => {
    try {
      const canvas = preview.current;
      if (!canvas || !ready) throw new Error('Aguarde a foto carregar.');
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((value) => (value ? resolve(value) : reject(new Error('Não foi possível preparar a foto.'))), 'image/png'),
      );
      onChange(blob);
      onPending(false);
      setError('Foto preparada; salve a conta para confirmar.');
    } catch {
      setError('Não foi possível ler esta foto. Escolha PNG, JPG ou WebP válido.');
    }
  };
  return (
    <div className="stack">
      <Field label="Foto do perfil">
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            if (file.size > 10 * 1024 * 1024) {
              setError('Escolha uma foto de até 10 MB.');
              return;
            }
            if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
            objectUrl.current = URL.createObjectURL(file);
            setSource(objectUrl.current);
            setZoom(1);
            setPosition({ x: 50, y: 50 });
            onChange(undefined);
            onPending(true);
            setError('Ajuste o recorte e clique em Usar esta foto.');
          }}
        />
      </Field>
      {source && (
        <>
          <div className="avatar-preview">
            <canvas
              ref={preview}
              width={256}
              height={256}
              role="img"
              aria-label="Prévia da foto do perfil"
              style={{ width: '100%', height: '100%' }}
            />
          </div>
          <Field label="Zoom da foto">
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={(event) => (setZoom(Number(event.target.value)), onPending(true), onChange(undefined))}
            />
          </Field>
          <Field label="Posição horizontal da foto">
            <input
              type="range"
              min={0}
              max={100}
              value={position.x}
              onChange={(event) => (setPosition({ ...position, x: Number(event.target.value) }), onPending(true), onChange(undefined))}
            />
          </Field>
          <Field label="Posição vertical da foto">
            <input
              type="range"
              min={0}
              max={100}
              value={position.y}
              onChange={(event) => (setPosition({ ...position, y: Number(event.target.value) }), onPending(true), onChange(undefined))}
            />
          </Field>
          <div className="row">
            <Button disabled={!ready} onClick={() => void crop()}>
              Usar esta foto
            </Button>
            <Button
              onClick={() => {
                onChange(null);
                onPending(false);
                setSource('');
                setError('Foto será removida ao salvar a conta.');
              }}
            >
              Remover foto
            </Button>
          </div>
        </>
      )}
      {error && <small role="status">{error}</small>}
    </div>
  );
}
